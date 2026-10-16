import {test} from 'node:test';import assert from 'node:assert/strict';
import {splitVoiceTurn,chooseAudioType,nameSuggestions,requestTranscription,voiceConfig} from '../docs/voice-input.js';
import {transcribe,VoiceUsage} from '../push-service/transcribe.mjs';
import worker from '../push-service/worker.mjs';
const origin='https://example.org',token='a'.repeat(48);
function environment(limit=20){const map=new Map();let queue=Promise.resolve();const ctx={blockConcurrencyWhile:callback=>{const next=queue.then(callback);queue=next.catch(()=>{});return next;},storage:{get:async key=>structuredClone(map.get(key)),put:async(key,value)=>map.set(key,structuredClone(value))}};const usage=new VoiceUsage(ctx);return {APP_ORIGIN:origin,TRANSCRIBE_TOKEN:token,OPENAI_API_KEY:'fake-openai-key',TRANSCRIBE_DAILY_LIMIT:String(limit),VOICE_USAGE:{idFromName:x=>x,get:()=>usage},map};}
function audioRequest({auth=token,names=['Paola Hernández'],blob=new Blob(['recording'],{type:'audio/webm'}),duration='5'}={}){const form=new FormData();form.set('audio',blob,'clip.webm');form.set('duration',duration);form.set('names',JSON.stringify(names));return new Request('https://service/transcribe',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+auth},body:form});}
test('end-of-turn commands are recognized only at the end and preserve the actual instruction',()=>{
 assert.deepEqual(splitVoiceTurn('Agrega a Elena. Respóndeme ahora.'),{ended:true,text:'Agrega a Elena.'});
 assert.deepEqual(splitVoiceTurn('Hola. Respóndeme, ahora,'),{ended:true,text:'Hola.'});
 assert.deepEqual(splitVoiceTurn('Agrega a Elena, Carterita, responde ahora'),{ended:true,text:'Agrega a Elena'});
 assert.equal(splitVoiceTurn('Le dije responde ahora pero no contestó').ended,false);
 assert.equal(splitVoiceTurn('Fin del mensaje').text,'');assert.equal(splitVoiceTurn('Guarda el dato hasta aquí deja el mensaje').ended,true);
});
test('client name matches are suggestions and preserve exact known names',()=>{
 const text='Agrega a Paula Hernandes, busca casa.';assert.ok(nameSuggestions(text,['Paola Hernández']).some(x=>x.from==='Paula Hernandes'&&x.to==='Paola Hernández'));assert.equal(text,'Agrega a Paula Hernandes, busca casa.');
 assert.equal(nameSuggestions('Agrega a Paola Hernández',['Paola Hernández','Paula Hernández']).length,0);
 assert.equal(chooseAudioType({isTypeSupported:t=>t==='audio/mp4'}),'audio/mp4');
 assert.equal(voiceConfig({getItem:()=>null}).includeNames,false);
});
test('voice worker validates auth and audio before consuming quota, proxies once and returns only text',async()=>{
 const env=environment(1);await assert.rejects(transcribe(audioRequest({auth:'wrong'}),env),e=>e.status===401);assert.equal(env.map.size,0);
 await assert.rejects(transcribe(audioRequest({blob:new Blob([],{type:'audio/mp4'})}),env),e=>e.status===400);assert.equal(env.map.size,0);
 let calls=0;const response=await transcribe(audioRequest(),env,async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(options.redirect,'manual');assert.equal(options.body.get('language'),'es');assert.equal(options.body.get('model'),'gpt-4o-mini-transcribe');assert.match(options.body.get('prompt'),/Paola Hernández/);return Response.json({text:'Agrega a Paola Hernández.'});});
 assert.equal(await response.text(),'Agrega a Paola Hernández.');assert.equal(calls,1);assert.equal(response.headers.get('X-Transcription-Remaining'),'0');assert.deepEqual([...env.map.keys()],['daily']);
 await assert.rejects(transcribe(audioRequest(),env),e=>e.status===429);
});
test('daily counter is atomic across concurrent requests and audio errors are bounded',async()=>{
 const env=environment(3),stub=env.VOICE_USAGE.get('owner');const results=await Promise.all(Array.from({length:10},()=>stub.fetch(new Request('https://counter/reserve',{method:'POST',body:JSON.stringify({limit:3})}))));assert.equal(results.filter(r=>r.ok).length,3);
 await assert.rejects(transcribe(audioRequest({blob:new Blob([new Uint8Array(2*1024*1024+1)],{type:'audio/webm'})}),environment()),e=>e.status===413);
 await assert.rejects(transcribe(audioRequest({names:Array(101).fill('Name')}),environment()),e=>e.status===400);
 await assert.rejects(transcribe(audioRequest(),environment(),async()=>Response.json({error:'provider details'},{status:429})),e=>e.status===429&&!e.message.includes('provider details'));
});
test('CORS restricts voice route and leaves the existing reminder configuration requirement independent',async()=>{
 const env=environment();const denied=await worker.fetch(new Request('https://service/transcribe',{method:'POST',headers:{Origin:'https://other.org'}}),env);assert.equal(denied.status,403);
 const options=await worker.fetch(new Request('https://service/transcribe',{method:'OPTIONS',headers:{Origin:origin}}),env);assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),origin);
 const missing=await worker.fetch(audioRequest(),{APP_ORIGIN:origin});assert.equal(missing.status,503);assert.match((await missing.json()).error,/transcripción/);
});
test('client sends one recording and selected names without a provider key and does not retry a failure',async()=>{
 let calls=0;const text=await requestTranscription({blob:new Blob(['audio'],{type:'audio/mp4'}),duration:4,names:['Ana'],config:{url:'https://service',token},fetcher:async(url,options)=>{calls++;assert.equal(url.pathname,'/transcribe');assert.equal(options.headers.Authorization,'Bearer '+token);assert.deepEqual(JSON.parse(options.body.get('names')),['Ana']);return new Response('Texto reconocido');}});assert.equal(text,'Texto reconocido');assert.equal(calls,1);
 await assert.rejects(requestTranscription({blob:new Blob(['audio'],{type:'audio/mp4'}),duration:4,config:{url:'https://service',token},fetcher:async()=>{calls++;throw new TypeError('network');}}),/No pude conectar/);assert.equal(calls,2);
});
