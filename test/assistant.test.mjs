import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantPrompt,parseAssistantPlan,applyAssistantPlan,requestAssistantPlan} from '../docs/assistant.js';
import {cleanRecord,INITIAL_WRITING_PROFILE} from '../docs/core.js';
const client=cleanRecord({id:'a',name:'Elena',status:'Nuevo',intent:'Por definir',createdAt:'2026-10-16T10:00:00.000Z',businessArea:'Leasing',phone:'56911111111',email:'secret@example.org',notes:'NOTA PRIVADA',documents:[],updatedAt:'2026-10-16T10:00:00.000Z'});
const plan=item=>JSON.stringify({summary:'Propuesta para revisar',questions:[],items:[item]});
test('only opted-in summarized client data goes into the assistant prompt',()=>{
 const text=assistantPrompt('Recuérdame mañana a las diez',client,INITIAL_WRITING_PROFILE,new Date(2026,9,16,12));
 assert.match(text,/2026-10-17/);assert.match(text,/Elena/);assert.doesNotMatch(text,/56911111111|secret@example|NOTA PRIVADA/);
 assert.doesNotMatch(assistantPrompt('Hola',null,INITIAL_WRITING_PROFILE),/Elena/);
 assert.throws(()=>assistantPrompt('',null,INITIAL_WRITING_PROFILE));
});
test('selected proposal is atomic, preserves omitted data, saves draft and reminder only after apply',()=>{
 const p=parseAssistantPlan(plan({mode:'selected',client:{nextAction:'Llamar',followup:'2026-10-17',followupTime:'10:00'},draft:'Buenos días, ¿cómo está?'}),client);
 assert.equal(p.items[0].entry.data.businessArea,'Leasing');
 const next=applyAssistantPlan([client],[{...p.items[0],choice:'a'}],{a:client.updatedAt},()=> 'new','2026-10-16T12:00:00.000Z');
 assert.equal(client.followup,'');assert.equal(next[0].phone,client.phone);assert.equal(next[0].draft,'Buenos días, ¿cómo está?');assert.equal(next[0].followupTime,'10:00');
 assert.throws(()=>applyAssistantPlan([client],[{...p.items[0],choice:'a'}],{a:'stale'}),/cambió/);
 assert.throws(()=>applyAssistantPlan([client],[{...p.items[0],choice:'review'}],{a:client.updatedAt}),/Elige/);
});
test('unapproved actions, unknown fields and conflicting completion are rejected',()=>{
 for(const item of [{mode:'delete',client:{name:'Elena'}},{mode:'new',client:{name:'Elena',execute:'code'}},{mode:'selected',client:{name:'Elena',followup:'2026-10-17'},completeFollowup:true}])assert.throws(()=>parseAssistantPlan(plan(item),client));
 assert.throws(()=>parseAssistantPlan(plan({mode:'selected',client:{name:'Elena'}})));
 assert.throws(()=>parseAssistantPlan('not JSON'));
});
test('completion and creation use local bounded actions without sending messages',()=>{
 const p=parseAssistantPlan(plan({mode:'selected',client:{},completeFollowup:true}),client),now='2026-10-16T12:00:00.000Z';
 const next=applyAssistantPlan([client],[{...p.items[0],choice:'a'}],{a:client.updatedAt},()=> 'new',now);assert.equal(next[0].followupDoneAt,now);
 const create=parseAssistantPlan(plan({mode:'new',client:{name:'Ana',businessArea:'Corretaje'}}));assert.equal(applyAssistantPlan([], [{...create.items[0],choice:'new'}],{},()=> 'new',now)[0].name,'Ana');
});
test('assistant makes one bounded request, shares no key in prompt, and rejects incomplete responses',async()=>{
 let calls=0;const raw=plan({mode:'new',client:{name:'Ana'}});
 const fetcher=async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.response_format.type,'json_object');assert.equal(body.messages.length,2);assert.equal(body.max_completion_tokens,2400);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:raw}}]})};};
 assert.equal(await requestAssistantPlan({key:'test',prompt:'Petición',fetcher}),raw);assert.equal(calls,1);
 await assert.rejects(requestAssistantPlan({key:'test',prompt:'Hola',fetcher:async()=>({ok:false,status:429,json:async()=>({})})}),/límite/);
 await assert.rejects(requestAssistantPlan({key:'test',prompt:'Hola',fetcher:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:raw}}]})})}),/incompleta/);
});
