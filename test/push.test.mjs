import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{ReminderService,validateSubscription,validateJobs} from '../push-service/worker.mjs';
import {buildPushJobs,serviceURL} from '../docs/push.js';
class Storage{
 constructor(){this.data=new Map();this.alarmAt=null;}
 async get(k){return structuredClone(this.data.get(k));}
 async put(k,v){if(typeof k==='object'){for(const [key,value] of Object.entries(k))this.data.set(key,structuredClone(value));}else this.data.set(k,structuredClone(v));}
 async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])this.data.delete(k);}
 async list({prefix}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]));}
 async transaction(fn){const before=structuredClone(this.data);try{return await fn(this);}catch(err){this.data=before;throw err;}}
 async setAlarm(at){this.alarmAt=at;}
 async deleteAlarm(){this.alarmAt=null;}
}
const b64=b=>Buffer.from(b).toString('base64url');
async function fixture(){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);return {endpoint:'https://fcm.googleapis.com/fcm/send/test-endpoint',keys:{p256dh:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}};}
async function service(){const storage=new Storage(),ctx={storage,blockConcurrencyWhile:fn=>fn()},env={PAIRING_CODE:'test-only-pairing-code-not-production',APP_ORIGIN:'https://example.org',APP_URL:'https://example.org/cartera_propiedades/'};const instance=new ReminderService(ctx,env);env.REMINDERS={idFromName:x=>x,get:()=>instance};const request=(path,token=env.PAIRING_CODE,method='GET',body)=>worker.fetch(new Request('https://test.workers.dev'+path,{method,headers:{Origin:env.APP_ORIGIN,Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return {storage,env,instance,request};}
test('push server enrolls, authenticates devices, replaces snapshots and cancels alarms',async()=>{
 const {storage,request}=await service();assert.equal((await request('/config','wrong')).status,401);const config=await(await request('/config')).json();assert.equal(Buffer.from(config.publicKey,'base64url').length,65);assert.equal(config.privateKey,undefined);
 const subscription=await fixture(),registered=await request('/devices',undefined,'POST',{subscription});assert.equal(registered.status,201);const d=await registered.json();assert.ok(d.deviceToken);const path='/devices/'+d.deviceId;
 assert.equal((await request(path+'/jobs','wrong','PUT',{revision:1,jobs:[]})).status,401);
 const at=Date.now()+60000;assert.equal((await request(path+'/jobs',d.deviceToken,'PUT',{revision:1,jobs:[{id:'client-1',at,name:'ignored-private-data'}]})).status,200);assert.ok(storage.alarmAt);
 const stored=JSON.stringify([...storage.data.values()]);assert.doesNotMatch(stored,/ignored-private-data/);assert.doesNotMatch(stored,new RegExp(d.deviceToken));
 assert.equal((await request(path+'/jobs',d.deviceToken,'PUT',{revision:1,jobs:[]})).status,409);
 assert.equal((await request(path+'/jobs',d.deviceToken,'PUT',{revision:2,jobs:[]})).status,200);assert.equal(storage.alarmAt,null);
 assert.equal((await request(path,d.deviceToken,'DELETE')).status,200);assert.equal((await request(path+'/jobs',d.deviceToken,'PUT',{revision:3,jobs:[]})).status,401);
});
test('alarms use encrypted Web Push, retire gone subscriptions, retry temporary errors and avoid resending accepted jobs',async()=>{
 const {instance,request,storage}=await service(),sub=await fixture();const d=await(await request('/devices',undefined,'POST',{subscription:sub})).json();const path='/devices/'+d.deviceId;const at=Date.now()-1000;await request(path+'/jobs',d.deviceToken,'PUT',{revision:1,jobs:[{id:'opaque-id',at}]});
 const realFetch=globalThis.fetch;let calls=0,status=201;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,sub.endpoint);assert.equal(options.method.toUpperCase(),'POST');assert.equal(new Headers(options.headers).get('content-encoding'),'aes128gcm');assert.equal(options.redirect,'manual');assert.doesNotMatch(new TextDecoder().decode(options.body),/opaque-id/);return new Response(null,{status});};
 try{await instance.alarm();assert.equal(calls,1);await instance.alarm();assert.equal(calls,1);await request(path+'/jobs',d.deviceToken,'PUT',{revision:2,jobs:[{id:'opaque-id',at}]});assert.equal((await instance.readDevices())[0].jobs.length,0);
  status=302;await request(path+'/jobs',d.deviceToken,'PUT',{revision:3,jobs:[{id:'retry-id',at}]});await instance.alarm();const retry=(await instance.readDevices())[0].jobs[0];assert.equal(retry.attempts,1);assert.ok(retry.nextAttempt>Date.now());
  status=410;await request(path+'/jobs',d.deviceToken,'PUT',{revision:4,jobs:[{id:'gone-id',at}]});await instance.alarm();assert.equal((await instance.readDevices()).length,0);assert.equal(storage.alarmAt,null);
 }finally{globalThis.fetch=realFetch;}
});
test('push boundary rejects SSRF, bad dates, unknown origins and unconfigured service',async()=>{
 const s=await fixture();assert.throws(()=>validateSubscription({...s,endpoint:'https://127.0.0.1/private'}),/Proveedor/);assert.throws(()=>validateSubscription({...s,endpoint:'https://fcm.googleapis.com.evil.test/'}),/Proveedor/);assert.throws(()=>validateSubscription({...s,endpoint:'https://user:pass@fcm.googleapis.com/'}),/Proveedor/);
 assert.throws(()=>validateJobs([{id:'x',at:Date.now()+400*86400000}]),/fechas/);assert.throws(()=>validateJobs([{id:'x',at:Date.now()},{id:'x',at:Date.now()}]),/fechas/);
 const {env}=await service();assert.equal((await worker.fetch(new Request('https://test.workers.dev/config',{headers:{Origin:'https://evil.test'}}),env)).status,403);assert.equal((await worker.fetch(new Request('https://test.workers.dev/config',{headers:{Origin:env.APP_ORIGIN}}),{...env,PAIRING_CODE:''})).status,503);
});
test('browser schedules only future pending cases with an explicit valid local time',()=>{
 const now=Date.now(),future=new Date(now+86400000),date=[future.getFullYear(),String(future.getMonth()+1).padStart(2,'0'),String(future.getDate()).padStart(2,'0')].join('-');
 const c={id:'case-1',status:'Nuevo',followup:date,followupTime:'12:00',followupDoneAt:'',name:'Never uploaded',phone:'+56123456789'};
 const result=buildPushJobs([c,{...c,id:'done',followupDoneAt:'yes'},{...c,id:'closed',status:'Cerrado'},{...c,id:'missing',followupTime:''}],now);assert.equal(result.jobs.length,1);assert.equal(result.missingTime,1);assert.deepEqual(Object.keys(result.jobs[0]),['id','at']);assert.equal(serviceURL('https://carterita-avisos.example.workers.dev/'),'https://carterita-avisos.example.workers.dev');assert.throws(()=>serviceURL('https://evil.test'),/Cloudflare/);
});

import {reminderState} from '../docs/push.js';
test('per-client reminder status requires server acknowledgement and distinguishes cancellation pending from completed',()=>{
 const now=Date.now(),future=new Date(now+86400000),followup=[future.getFullYear(),String(future.getMonth()+1).padStart(2,'0'),String(future.getDate()).padStart(2,'0')].join('-'),c={id:'state-case',status:'Nuevo',followup,followupTime:'12:00',followupDoneAt:''};const at=+new Date(followup+'T12:00:00');
 assert.equal(reminderState(c,null,now).kind,'inactive');assert.equal(reminderState(c,{disabled:false,lastSyncedJobs:[]},now).kind,'pending');
 const connection={disabled:false,lastSyncedJobs:[{id:c.id,at}]};assert.equal(reminderState(c,connection,now).kind,'scheduled');assert.equal(reminderState({...c,followupTime:'13:00'},connection,now).kind,'pending');assert.equal(reminderState({...c,followupDoneAt:'yes'},connection,now).kind,'pending');assert.equal(reminderState({...c,followupDoneAt:'yes'},{...connection,lastSyncedJobs:[]},now).kind,'done');
 assert.equal(reminderState({...c,followupTime:''},connection,now).kind,'missing');assert.equal(reminderState(c,connection,at+60000).kind,'overdue');assert.equal(reminderState({...c,followup:''},connection,now).kind,'pending');assert.equal(reminderState({...c,followup:''},null,now).kind,'none');
});
