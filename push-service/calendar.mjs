// Google credentials are encrypted in a separate per-device Durable Object.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
async function key(env){if(!/^[a-fA-F0-9]{64}$/.test(env.CALENDAR_ENCRYPTION_KEY||''))fail('Falta configurar CALENDAR_ENCRYPTION_KEY en Cloudflare.',503);return crypto.subtle.importKey('raw',Uint8Array.from(env.CALENDAR_ENCRYPTION_KEY.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(value))))};}
export async function unseal(value,env){return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(value.iv),c=>c.charCodeAt(0))},await key(env),Uint8Array.from(atob(value.data),c=>c.charCodeAt(0)))));}
export async function calendarRoute(request,env){
 const device=request.headers.get('X-Carterita-Device')||'';
 if(!/^[A-Za-z0-9_-]{20,100}$/.test(device))fail('Activa primero la conexión de avisos de este teléfono para identificarlo de forma segura.',401);
 if(!env.REMINDERS||!env.CALENDAR_AUTH)fail('Falta preparar el servicio de calendario.',503);
 // Authenticate through the existing device capability, never a browser-supplied account ID.
 const stub=env.REMINDERS.get(env.REMINDERS.idFromName('carterita-single-owner'));
 const checked=await stub.fetch(new Request('https://internal/devices/'+device+'/calendar-auth',{headers:{Authorization:request.headers.get('Authorization')||''}}));
 if(!checked.ok)fail('La conexión de este teléfono venció. Vuelve a activar sus avisos.',401);
 return env.CALENDAR_AUTH.get(env.CALENDAR_AUTH.idFromName(device)).fetch(request);
}
export class CalendarAuth {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{try{return await this.handle(request);}catch(error){return json({error:error.status?error.message:'No se pudo renovar la conexión con Google. Inténtalo más tarde.'},error.status||503);}});}
 async tokens(body){
  if(!this.env.GOOGLE_CLIENT_ID||!this.env.GOOGLE_CLIENT_SECRET)fail('Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Cloudflare.',503);
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...body,client_id:this.env.GOOGLE_CLIENT_ID,client_secret:this.env.GOOGLE_CLIENT_SECRET}),signal:AbortSignal.timeout(15000)});
  const value=await r.json();if(!r.ok){if(value.error==='invalid_grant')fail('Google pide autorizar de nuevo. Toca «Conectar Google».',401);fail('Google no pudo autorizar la conexión. Revisa el cliente OAuth de Cloudflare.',502);}return value;
 }
 async handle(request){
  const path=new URL(request.url).pathname;
  if(path==='/calendar/disconnect'&&request.method==='DELETE'){await this.ctx.storage.delete('grant');return json({ok:true});}
  await key(this.env);
  if(path==='/calendar/authorize'&&request.method==='POST'){
   if(request.headers.get('X-Requested-With')!=='XmlHttpRequest')fail('Solicitud de autorización inválida.',403);
   const text=await request.text();if(text.length>10000)fail('Solicitud demasiado grande.',413);let data;try{data=JSON.parse(text);}catch{fail('Solicitud inválida.');}
   if(typeof data.code!=='string'||!data.code||data.code.length>8000)fail('El código de Google no es válido.');
   const rate=await this.ctx.storage.get('rate')||{at:Date.now(),count:0};if(Date.now()-rate.at>3600000){rate.at=Date.now();rate.count=0;}if(++rate.count>10)fail('Espera una hora antes de volver a autorizar.',429);await this.ctx.storage.put('rate',rate);
   const value=await this.tokens({grant_type:'authorization_code',code:data.code,redirect_uri:this.env.APP_ORIGIN});
   if(!value.access_token)fail('Google no entregó acceso al calendario.',502);
   if(!String(value.scope||'').split(' ').includes('https://www.googleapis.com/auth/calendar.app.created'))fail('Falta autorizar el calendario creado por Carterita.',403);
   const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+value.access_token},signal:AbortSignal.timeout(15000)});if(!r.ok)fail('Google no confirmó la cuenta.',502);const user=await r.json();if(!user.sub)fail('Google no confirmó la cuenta.',502);
   let previous;const saved=await this.ctx.storage.get('grant');if(saved)previous=await unseal(saved,this.env);
   const refresh=value.refresh_token||(previous?.account.sub===user.sub&&previous?.clientId===this.env.GOOGLE_CLIENT_ID?previous.refresh:null);
   if(!refresh)fail('Google no entregó el permiso duradero. Revoca el acceso de Carterita en tu cuenta de Google y vuelve a autorizar.',409);
   const grant={clientId:this.env.GOOGLE_CLIENT_ID,refresh,access:value.access_token,expires:Date.now()+Number(value.expires_in||3600)*1000,account:{sub:user.sub,email:user.email||'Cuenta de Google'}};
   await this.ctx.storage.put('grant',await seal(grant,this.env));return this.session(grant);
  }
  if(path==='/calendar/session'&&request.method==='GET'){
   const saved=await this.ctx.storage.get('grant');if(!saved)fail('Conecta Google una vez para activar la conexión persistente.',401);
   const grant=await unseal(saved,this.env);if(grant.clientId!==this.env.GOOGLE_CLIENT_ID)fail('Cambió el cliente de Google. Vuelve a autorizar.',401);
   if(grant.expires<Date.now()+90000){let value;try{value=await this.tokens({grant_type:'refresh_token',refresh_token:grant.refresh});}catch(e){if(e.status===401)await this.ctx.storage.delete('grant');throw e;}if(!value.access_token)fail('Google no pudo renovar el acceso.',502);grant.access=value.access_token;grant.expires=Date.now()+Number(value.expires_in||3600)*1000;if(value.refresh_token)grant.refresh=value.refresh_token;await this.ctx.storage.put('grant',await seal(grant,this.env));}
   return this.session(grant);
  }
  fail('Ruta de calendario no encontrada.',404);
 }
 session(grant){return json({accessToken:grant.access,expiresIn:Math.max(0,Math.floor((grant.expires-Date.now())/1000)),account:grant.account,clientId:grant.clientId});}
}
