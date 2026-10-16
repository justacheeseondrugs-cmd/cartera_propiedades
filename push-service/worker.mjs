import {buildPushPayload} from '@block65/webcrypto-web-push';
const DAY=86400000,DEVICE_TTL=30*DAY,MAX_JOBS=200;
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const sha=async s=>b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const json=(body,status=200)=>Response.json(body,{status});
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function validateSubscription(s){
 if(!s||typeof s.endpoint!=='string'||s.endpoint.length>4096)fail('Suscripción inválida.');let u;try{u=new URL(s.endpoint);}catch{fail('Suscripción inválida.');}
 const host=u.hostname;
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||!(host==='fcm.googleapis.com'||host==='web.push.apple.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com')))fail('Proveedor de notificaciones no admitido.');
 const decode=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))fail('Claves de suscripción inválidas.');try{return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}catch{fail('Claves de suscripción inválidas.');}};
 const publicKey=decode(s.keys?.p256dh),auth=decode(s.keys?.auth);if(publicKey.length!==65||publicKey[0]!==4||auth.length!==16)fail('Claves de suscripción inválidas.');
 return {endpoint:u.href,expirationTime:null,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}};
}
export function validateJobs(jobs,now=Date.now()){
 if(!Array.isArray(jobs)||jobs.length>MAX_JOBS)fail('Demasiados avisos.');const ids=new Set();
 return jobs.map(j=>{if(!j||typeof j.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(j.id)||ids.has(j.id)||!Number.isSafeInteger(j.at)||j.at<now-5*60000||j.at>now+366*DAY)fail('Revisa las fechas y horas de los avisos (máximo un año).');ids.add(j.id);return {id:j.id,at:j.at,attempts:0,nextAttempt:j.at};});
}
async function bodyOf(request){const text=await request.text();if(text.length>200000)fail('Solicitud demasiado grande.',413);try{return JSON.parse(text);}catch{fail('Solicitud inválida.');}}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'),url=new URL(request.url);const cors={'Access-Control-Allow-Origin':env.APP_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Vary':'Origin','Cache-Control':'no-store'};
  if(origin!==env.APP_ORIGIN)return json({error:'Origen no permitido.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  let response;
  try{
   if(!env.PAIRING_CODE||env.PAIRING_CODE.length<24)fail('Falta configurar PAIRING_CODE (mínimo 24 caracteres) en el servicio.',503);
   if(!['/config','/devices'].includes(url.pathname)&&!/^\/devices\/[a-zA-Z0-9_-]{20,100}(?:\/(?:jobs|test))?$/.test(url.pathname))fail('Ruta no encontrada.',404);
   const stub=env.REMINDERS.get(env.REMINDERS.idFromName('carterita-single-owner'));response=await stub.fetch(request);
  }catch(err){response=json({error:err.status?err.message:'El servicio de avisos no está disponible.'},err.status||503);}
  const headers=new Headers(response.headers);for(const [k,v] of Object.entries(cors))headers.set(k,v);return new Response(response.body,{status:response.status,headers});
 }
};
export class ReminderService {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{try{return await this.handle(request);}catch(err){return json({error:err.status?err.message:'No se pudo completar la operación.'},err.status||503);}});}
 async readDevices(){return [...(await this.ctx.storage.list({prefix:'device:'})).values()];}
 async writeDevices(devices){await this.ctx.storage.transaction(async tx=>{const previous=await tx.list({prefix:'device:'}),values=Object.fromEntries(devices.map(d=>['device:'+d.id,d]));if(devices.length)await tx.put(values);const stale=[...previous.keys()].filter(k=>!Object.hasOwn(values,k));if(stale.length)await tx.delete(stale);});}
 async config(){let config=await this.ctx.storage.get('vapid');if(!config){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey);config={subject:this.env.APP_URL,publicKey:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),privateKey:privateKey.d};await this.ctx.storage.put('vapid',config);}return config;}
 async handle(request){
  const url=new URL(request.url),authorization=request.headers.get('Authorization')||'',token=authorization.startsWith('Bearer ')?authorization.slice(7):'';if(token.length>1000)fail('Acceso no válido.',401);
  const pairing=url.pathname==='/config'||url.pathname==='/devices';let devices=await this.readDevices();
  if(pairing){if(await sha(token)!==await sha(this.env.PAIRING_CODE))fail('El código de conexión no es correcto.',401);const now=Date.now(),rate=await this.ctx.storage.get('pair-rate')||{start:now,count:0};if(now-rate.start>3600000){rate.start=now;rate.count=0;}if(++rate.count>60)fail('Demasiados intentos. Espera una hora.',429);await this.ctx.storage.put('pair-rate',rate);}
  if(url.pathname==='/config'&&request.method==='GET'){const vapid=await this.config();return json({publicKey:vapid.publicKey,appURL:this.env.APP_URL});}
  if(url.pathname==='/devices'&&request.method==='POST'){
   const body=await bodyOf(request),subscription=validateSubscription(body.subscription);devices=devices.filter(d=>Date.now()-d.lastSeen<DEVICE_TTL&&d.subscription.endpoint!==subscription.endpoint);if(devices.length>=10)fail('Máximo de 10 dispositivos. Desactiva alguno primero.');
   const id=b64(crypto.getRandomValues(new Uint8Array(24))),deviceToken=b64(crypto.getRandomValues(new Uint8Array(32)));devices.push({id,tokenHash:await sha(deviceToken),subscription,jobs:[],sent:[],revision:0,lastSeen:Date.now(),lastTest:0});await this.writeDevices(devices);await this.rearm(devices);return json({deviceId:id,deviceToken},201);
  }
  const parts=url.pathname.split('/'),device=devices.find(d=>d.id===parts[2]);if(!device||await sha(token)!==device.tokenHash)fail('La conexión del dispositivo ya no está activa. Vuelve a activarla.',401);
  if(parts.length===3&&request.method==='DELETE'){devices=devices.filter(d=>d!==device);await this.writeDevices(devices);await this.rearm(devices);return json({ok:true});}
  if(parts[3]==='jobs'&&request.method==='PUT'){
   const body=await bodyOf(request);if(!Number.isSafeInteger(body.revision)||body.revision<=device.revision)fail('La lista cambió en otra petición. Vuelve a sincronizar.',409);
   const previous=new Map(device.jobs.map(j=>[j.id+':'+j.at,j]));const jobs=validateJobs(body.jobs).map(j=>previous.get(j.id+':'+j.at)||j);device.jobs=jobs.filter(j=>!device.sent.includes(j.id+':'+j.at));device.revision=body.revision;device.lastSeen=Date.now();await this.writeDevices(devices);await this.rearm(devices);return json({ok:true,count:device.jobs.length,revision:device.revision});
  }
  if(parts[3]==='test'&&request.method==='POST'){
   if(Date.now()-device.lastTest<60000)fail('Espera un minuto entre pruebas.',429);device.lastTest=Date.now();device.lastSeen=Date.now();await this.writeDevices(devices);const status=await this.deliver(device,{test:true});if(status!==201&&status!==200&&status!==202)fail('El proveedor no aceptó la prueba. Comprueba los permisos del teléfono.',502);return json({ok:true});
  }
  fail('Ruta no encontrada.',404);
 }
 async deliver(device,payload){
  const vapid=await this.config(),options=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:3600}},device.subscription,vapid);
  const response=await fetch(device.subscription.endpoint,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});await response.body?.cancel();return response.status;
 }
 async rearm(devices){const now=Date.now(),times=devices.filter(d=>now-d.lastSeen<DEVICE_TTL).flatMap(d=>d.jobs.map(j=>j.nextAttempt));if(times.length)await this.ctx.storage.setAlarm(Math.max(now+1000,Math.min(...times)));else await this.ctx.storage.deleteAlarm();}
 async alarm(){return this.ctx.blockConcurrencyWhile(async()=>{
  let devices=await this.readDevices();const now=Date.now();devices=devices.filter(d=>now-d.lastSeen<DEVICE_TTL);let budget=2;
  for(const d of devices){const remaining=[];let expired=false;
   for(const j of d.jobs){if(j.nextAttempt>now||budget<=0){remaining.push(j);continue;}budget--;
    if(now-j.at>DAY){d.sent.push(j.id+':'+j.at);continue;}
    let status=503;try{status=await this.deliver(d,{clientId:j.id,reminderId:j.id+':'+j.at});}catch{}
    if([404,410].includes(status)){expired=true;break;}
    if([200,201,202].includes(status)){d.sent.push(j.id+':'+j.at);}
    else if(++j.attempts<5){j.nextAttempt=now+Math.min(3600000,60000*2**j.attempts);remaining.push(j);}
    else d.sent.push(j.id+':'+j.at);
   }
   d.jobs=remaining;d.sent=d.sent.slice(-300);if(expired)d.expired=true;
  }
  devices=devices.filter(d=>!d.expired);await this.writeDevices(devices);await this.rearm(devices);
 });}
}
