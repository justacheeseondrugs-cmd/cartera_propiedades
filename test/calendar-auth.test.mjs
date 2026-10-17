import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CalendarAuth,calendarRoute,seal,unseal} from '../push-service/calendar.mjs';
const origin='https://example.org';
function fixture(){const data=new Map(),env={APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'private-client-secret',CALENDAR_ENCRYPTION_KEY:'ab'.repeat(32)},ctx={storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k)},blockConcurrencyWhile:fn=>fn()};const instance=new CalendarAuth(ctx,env);return {env,data,instance,request:(path,method='GET',body,headers={})=>instance.fetch(new Request('https://worker.test/calendar/'+path,{method,headers:{Origin:origin,'X-Requested-With':'XmlHttpRequest',...headers},...(body?{body:JSON.stringify(body)}:{})}))};}
test('refresh permissions are encrypted and tampering fails closed',async()=>{const {env}=fixture();const cipher=await seal({refresh:'refresh-secret'},env);assert.doesNotMatch(JSON.stringify(cipher),/refresh-secret/);assert.deepEqual(await unseal(cipher,env),{refresh:'refresh-secret'});await assert.rejects(unseal({...cipher,data:cipher.data.slice(0,-4)+'AAAA'},env));});
test('authorize, reload, expire, renew and disconnect without exposing refresh or client secret',async()=>{
 const f=fixture(),oldFetch=globalThis.fetch;let refreshes=0;
 globalThis.fetch=async(url,options)=>{if(url.endsWith('userinfo'))return Response.json({sub:'google-account',email:'test@example.org'});const body=new URLSearchParams(options.body);assert.equal(body.get('client_secret'),f.env.GOOGLE_CLIENT_SECRET);if(body.get('grant_type')==='refresh_token')refreshes++;return Response.json({access_token:refreshes?'access-renewed':'access-initial',expires_in:3600,refresh_token:'refresh-private',scope:'openid email https://www.googleapis.com/auth/calendar.app.created'});};
 try{
  const authorized=await f.request('authorize','POST',{code:'one-use-code'});assert.equal(authorized.status,200);const session=await authorized.json();assert.equal(session.accessToken,'access-initial');assert.equal(session.account.sub,'google-account');assert.doesNotMatch(JSON.stringify(session),/refresh-private|private-client-secret/);assert.doesNotMatch(JSON.stringify([...f.data.values()]),/refresh-private|access-initial/);
  assert.equal((await f.request('session')).status,200);assert.equal(refreshes,0);
  const grant=await unseal(f.data.get('grant'),f.env);grant.expires=0;f.data.set('grant',await seal(grant,f.env));assert.equal((await(await f.request('session')).json()).accessToken,'access-renewed');assert.equal(refreshes,1);
  assert.equal((await f.request('disconnect','DELETE')).status,200);assert.equal((await f.request('session')).status,401);
 }finally{globalThis.fetch=oldFetch;}
});
test('revoked refresh returns reconnect guidance and deletes the grant',async()=>{const f=fixture(),old=globalThis.fetch;f.data.set('grant',await seal({clientId:f.env.GOOGLE_CLIENT_ID,refresh:'old',access:'old',expires:0,account:{sub:'a'}},f.env));globalThis.fetch=async()=>Response.json({error:'invalid_grant'},{status:400});try{const response=await f.request('session');assert.equal(response.status,401);assert.match((await response.json()).error,/autorizar/);assert.ok(!f.data.has('grant'));}finally{globalThis.fetch=old;}});
test('calendar access requires an authenticated existing device, and missing secrets fail clearly',async()=>{
 const f=fixture();await assert.rejects(calendarRoute(new Request('https://worker.test/calendar/session'),f.env),/avisos/);
 let calendarCalled=false;f.env.REMINDERS={idFromName:x=>x,get:()=>({fetch:async()=>Response.json({error:'wrong'},{status:401})})};f.env.CALENDAR_AUTH={idFromName:x=>x,get:()=>({fetch:()=>{calendarCalled=true;}})};
 await assert.rejects(calendarRoute(new Request('https://worker.test/calendar/session',{headers:{'X-Carterita-Device':'a'.repeat(30),Authorization:'Bearer wrong'}}),f.env),/venció/);assert.equal(calendarCalled,false);
 f.env.CALENDAR_ENCRYPTION_KEY='';const response=await f.request('session');assert.equal(response.status,503);assert.match((await response.json()).error,/CALENDAR_ENCRYPTION_KEY/);
});
test('OAuth callback rejects missing custom CSRF header without exchanging code',async()=>{const f=fixture();assert.equal((await f.request('authorize','POST',{code:'code'},{'X-Requested-With':''})).status,403);});

test('Google OAuth errors explain the configuration to check without exposing provider details or secrets',async()=>{
 const original=globalThis.fetch;
 try{for(const [code,expected] of [['invalid_client',/mismo cliente web/],['unauthorized_client',/Aplicación web/],['redirect_uri_mismatch',/APP_ORIGIN/],['invalid_request',/incompleta/]]){
 const f=fixture();globalThis.fetch=async()=>Response.json({error:code,error_description:'SENSITIVE PROVIDER DETAIL'},{status:400});
 const response=await f.request('authorize','POST',{code:'one-use-code'});assert.equal(response.status,502);const result=await response.json();assert.match(result.error,expected);assert.doesNotMatch(JSON.stringify(result),/SENSITIVE|private-client-secret|one-use-code/);
 }}finally{globalThis.fetch=original;}
});
