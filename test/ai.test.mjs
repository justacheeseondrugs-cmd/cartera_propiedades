import {test} from 'node:test';
import assert from 'node:assert/strict';
import {correctMessage,reserveCorrection,AI_USAGE,AI_MODEL} from '../docs/ai.js';
test('one bounded correction request uses mini with no storage or reasoning and returns text',async()=>{
 let calls=0;const text=await correctMessage({key:'sk-example',prompt:'Corrige este mensaje',fetcher:async(url,options)=>{
 calls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer sk-example');const body=JSON.parse(options.body);assert.equal(body.model,AI_MODEL);assert.equal(body.store,false);assert.equal(body.reasoning_effort,'none');assert.equal(body.service_tier,'default');assert.equal(body.max_completion_tokens,800);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'  Buenas tardes.  '}}]}));}});
 assert.equal(text,'Buenas tardes.');assert.equal(calls,1);
});
test('quota errors do not retry or expose provider payloads',async()=>{
 let calls=0;await assert.rejects(correctMessage({key:'sk-example',prompt:'Mensaje',fetcher:async()=>{calls++;return new Response(JSON.stringify({error:{message:'private provider details'}}),{status:429});}}),/límite de uso/);assert.equal(calls,1);
});
test('rejects empty and truncated output without replacing original',async()=>{
 for(const choice of [{finish_reason:'length',message:{content:'incompleto'}},{finish_reason:'stop',message:{content:''}}])await assert.rejects(correctMessage({key:'sk-example',prompt:'Mensaje',fetcher:async()=>new Response(JSON.stringify({choices:[choice]}))}),/vacía o incompleta/);
});
test('daily attempt cap includes failures, resets by local day, fails closed if storage fails',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 for(let i=1;i<=20;i++)assert.equal(reserveCorrection(storage,'2026-10-15'),i);
 assert.throws(()=>reserveCorrection(storage,'2026-10-15'),/límite/);assert.equal(reserveCorrection(storage,'2026-10-16'),1);
 data.set(AI_USAGE,'broken');assert.throws(()=>reserveCorrection(storage,'2026-10-16'),/contador/);
 assert.throws(()=>reserveCorrection({getItem:()=>null,setItem:()=>{throw new Error('storage blocked');}},'2026-10-16'),/storage blocked/);
});
test('invalid configuration and long input do not call API',async()=>{
 const fetcher=()=>{throw new Error('should not call');};await assert.rejects(correctMessage({key:'',prompt:'Hola',fetcher}),/Configura/);await assert.rejects(correctMessage({key:'sk-example',prompt:'a'.repeat(14001),fetcher}),/demasiado largo/);
});
