const KEY='carterita-push-v1';
let saved,readClients=()=>[],notify=()=>{},syncing=false,dirty=false,timer,testReceived=false;
const $=s=>document.querySelector(s);
export function serviceURL(value){const url=new URL(value);if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.port||!['','/'].includes(url.pathname)||url.search||url.hash)throw new Error('Pega la dirección HTTPS de tu Worker de Cloudflare, terminada en .workers.dev, sin rutas extra.');return url.origin;}
export function buildPushJobs(clients,now=Date.now()){
 const jobs=[];let missingTime=0,outOfRange=0;
 for(const c of clients.flatMap(c=>[c,...(c.calendarEvents||[]).map(e=>({id:e.id,status:c.status,followup:e.date,followupTime:e.time,followupDoneAt:e.doneAt}))])){if(c.status==='Cerrado'||c.followupDoneAt||!c.followup)continue;if(!c.followupTime){missingTime++;continue;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(c.followup)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.followupTime)){outOfRange++;continue;}
  const date=new Date(c.followup+'T'+c.followupTime+':00'),at=+date;
  if(!Number.isFinite(at)||date.getHours()!==Number(c.followupTime.slice(0,2))||date.getMinutes()!==Number(c.followupTime.slice(3))){outOfRange++;continue;}
  if(at<=now)continue;if(at>now+366*86400000){outOfRange++;continue;}jobs.push({id:c.id,at});
 }
 if(jobs.length>200)throw new Error('Puedes programar hasta 200 seguimientos futuros por dispositivo.');
 return {jobs,missingTime,outOfRange};
}
function load(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(!value)return null;if(!/^[A-Za-z0-9_-]{20,100}$/.test(value.deviceId)||!/^[A-Za-z0-9_-]{40,100}$/.test(value.deviceToken))throw new Error();value.url=serviceURL(value.url);return value;}catch{return null;}}
function store(value){localStorage.setItem(KEY,JSON.stringify(value));saved=value;}
async function api(url,path,token,method='GET',body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(url+path,{method,keepalive:method==='PUT',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(data?.error||'No se pudo contactar con el servicio de avisos.'),{status:response.status});return data;}
 catch(err){if(err.name==='AbortError')throw new Error('El servicio tardó demasiado. No se confirmó la actualización de los avisos.');if(err instanceof TypeError)throw new Error('No se pudo conectar. Los cambios de los avisos siguen pendientes de enviar.');throw err;}finally{clearTimeout(timeout);}
}
function testStatus(text){const el=$('#push-test-state');if(el){el.hidden=false;el.textContent=text;}}
export function reminderState(c,connection,now=Date.now()){
 const acknowledged=Array.isArray(connection?.lastSyncedJobs)?connection.lastSyncedJobs.filter(j=>j&&typeof j.id==='string'&&Number.isFinite(j.at)):[],previous=acknowledged.some(j=>j.id===c.id&&j.at>now);
 if(c.followupDoneAt||c.status==='Cerrado')return previous&&!connection?.disabled?{kind:'pending',label:'Hecho · falta sincronizar la retirada del aviso.'}:{kind:'done',label:'Seguimiento hecho.'};
 if(!c.followup&&previous&&!connection?.disabled)return {kind:'pending',label:'Recordatorio quitado · falta sincronizar la retirada del aviso.'};
 if(!c.followup)return {kind:'none',label:'Sin recordatorio. Pulsa Recordarme para elegir fecha y hora.'};
 if(!c.followupTime)return {kind:'missing',label:'Por hacer · falta elegir la hora del aviso.'};
 let result;try{result=buildPushJobs([c],now);}catch{return {kind:'missing',label:'Revisa la fecha y la hora del recordatorio.'};}
 const at=+new Date(c.followup+'T'+c.followupTime+':00');
 if(result.outOfRange||!Number.isFinite(at))return {kind:'missing',label:'Revisa la fecha y la hora (hasta un año por adelantado).'};
 if(at<=now)return {kind:'overdue',label:'Por hacer · la fecha y hora del recordatorio ya pasaron.'};
 if(!connection||connection.disabled)return {kind:'inactive',label:'Recordatorio guardado · activa los avisos de este teléfono para recibirlo.'};
 if(acknowledged.some(j=>j.id===c.id&&j.at===at))return {kind:'scheduled',label:'Aviso programado en este teléfono.'};
 return {kind:'pending',label:'Guardado · falta sincronizar el aviso'+(typeof navigator!=='undefined'&&navigator.onLine===false?' al recuperar conexión.':'.')};
}
export function getClientReminderState(c){return reminderState(c,saved);}
function setStatus(text){window.dispatchEvent(new Event('carterita-reminder-state'));const el=$('#push-state');if(el)el.textContent=text;const hint=$('#push-sync-state');if(hint){hint.hidden=!saved;hint.textContent=text;}}
async function registration(){if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Este navegador no ofrece notificaciones push. En iPhone instala la PWA; en HONOR prueba Chrome actualizado.');return navigator.serviceWorker.ready;}
function decodeKey(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
export function queuePushSync(){if(!saved||saved.disabled)return;dirty=true;clearTimeout(timer);timer=setTimeout(syncPush,500);setStatus('Avisos: cambios pendientes de enviar al servicio.');}
export async function syncPush(){
 if(syncing||!saved||saved.disabled)return;syncing=true;
 try{do{dirty=false;if(navigator.onLine===false)throw new Error('Sin conexión: cambios de avisos pendientes. Un aviso ya programado aún podría llegar.');
  const config=saved,{jobs,missingTime,outOfRange}=buildPushJobs(readClients());const revision=Math.max(Date.now(),Number(config.revision||0)+1);store({...config,revision});
  const result=await api(config.url,'/devices/'+config.deviceId+'/jobs',config.deviceToken,'PUT',{revision,jobs});
  if(saved?.deviceId===config.deviceId){store({...saved,lastSync:new Date().toISOString(),count:result?.count??jobs.length,lastSyncedJobs:result?.scheduled||jobs});setStatus('Avisos sincronizados: '+jobs.length+' próximo(s).'+(missingTime?' '+missingTime+' sin hora: añade una hora para recibir push.':'')+(outOfRange?' Hay fechas no válidas o a más de un año.':''));}
 }while(dirty&&saved&&!saved.disabled);
 }catch(err){dirty=true;if(err.status===401&&saved){store({...saved,disabled:true});refresh();}setStatus(err.message);}finally{syncing=false;}
}
async function activate(){
 const button=$('#push-enable');if(button.disabled)return;button.disabled=true;
 let subscription,device;
 try{
  const url=serviceURL($('#push-url').value.trim()),code=$('#push-code').value.trim();if(code.length<24)throw new Error('Introduce el código secreto de conexión que configuraste en Cloudflare (mínimo 24 caracteres).');
  // Request permission directly from the explicit activation click (required on iOS).
  if(!('Notification' in window))throw new Error('Este navegador no ofrece permisos de notificación.');
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted')throw new Error('Permiso no concedido. Puedes cambiarlo en los ajustes de notificaciones del navegador.');
  const config=await api(url,'/config',code);if(config.appURL!==new URL('./',location.href).href)throw new Error('El servicio está configurado para otra aplicación.');
  const reg=await registration();let existing=await reg.pushManager.getSubscription();const expected=decodeKey(config.publicKey),current=existing?.options?.applicationServerKey;if(existing&&(!current||new Uint8Array(current).length!==expected.length||!expected.every((n,i)=>new Uint8Array(current)[i]===n))){await existing.unsubscribe();existing=null;}subscription=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(config.publicKey)});
  device=await api(url,'/devices',code,'POST',{subscription:subscription.toJSON()});
  try{store({url,...device,revision:0,disabled:false});}catch{await api(url,'/devices/'+device.deviceId,device.deviceToken,'DELETE').catch(()=>{});await subscription.unsubscribe().catch(()=>{});throw new Error('No se pudo guardar la conexión. No se activaron los avisos.');}
  $('#push-code').value='';await refresh();dirty=true;await syncPush();notify('Avisos activados. Pulsa Enviar prueba para comprobar el teléfono.');
 }catch(err){setStatus(err.message);}finally{button.disabled=Boolean(saved&&!saved.disabled);$('#push-code').value='';}
}
async function deactivate(){
 const button=$('#push-disable');button.disabled=true;
 try{const config=saved;if(!config)return;const reg=await registration(),subscription=await reg.pushManager.getSubscription();if(subscription)await subscription.unsubscribe();store({...config,disabled:true});
  await api(config.url,'/devices/'+config.deviceId,config.deviceToken,'DELETE');localStorage.removeItem(KEY);saved=null;setStatus('Avisos desactivados en este dispositivo.');notify('Avisos desactivados.');
 }catch(err){setStatus('No se confirmó la retirada en el servidor. Vuelve a pulsar Desactivar con conexión. '+err.message);}finally{button.disabled=false;refresh();}
}
async function refresh(){
 $('#push-url').value=saved?.url||$('#push-url').value;$('#push-enable').disabled=Boolean(saved&&!saved.disabled);$('#push-disable').hidden=!saved;$('#push-test').hidden=!saved||saved.disabled;$('#push-sync').hidden=!saved||saved.disabled;
 $('#push-credentials').hidden=Boolean(saved&&!saved.disabled);
 if(!saved)setStatus('Sin activar. Necesita el servicio de Cloudflare configurado y permiso en este teléfono.');
}
export function openPushSettings(){$('#push-code').value='';refresh();$('#push-dialog').showModal();}
export function initPush(getClients,toast){
 readClients=getClients;notify=toast;saved=load();
 $('#push-enable').onclick=activate;$('#push-disable').onclick=deactivate;$('#push-sync').onclick=()=>{dirty=true;syncPush();};
 $('#push-test').onclick=async()=>{
  const button=$('#push-test');if(button.disabled)return;button.disabled=true;button.textContent='Enviando prueba…';testReceived=false;testStatus('Enviando la prueba a Cloudflare… Puede tardar hasta 15 segundos.');
  try{if(!saved||saved.disabled)throw new Error('Primero activa las notificaciones en este dispositivo.');await api(saved.url,'/devices/'+saved.deviceId+'/test',saved.deviceToken,'POST');if(!testReceived)testStatus('Cloudflare y el proveedor aceptaron la prueba. Baja la cortina de notificaciones del teléfono. Si no aparece, pulsa Probar aviso local.');}
  catch(err){testStatus('No se envió la prueba: '+err.message);}
  finally{button.disabled=false;button.textContent='Enviar prueba desde Cloudflare';}
 };
 $('#push-local-test').onclick=async()=>{
  const button=$('#push-local-test');if(button.disabled)return;button.disabled=true;testStatus('Probando si este navegador puede mostrar avisos en el dispositivo…');
  try{
   if(!('Notification' in window))throw new Error('Este navegador no ofrece notificaciones. Prueba en Chrome del HONOR.');
   if(Notification.permission!=='granted')throw new Error('El permiso está en «'+Notification.permission+'». Activa los avisos para Carterita en el navegador.');
   const reg=await registration();await reg.showNotification('Carterita · prueba local',{body:'Esta prueba viene del teléfono, sin pasar por Cloudflare.',icon:new URL('./icon-192.png',location.href).href,tag:'carterita-local-test',data:{},renotify:false});
   testStatus('El sistema aceptó el aviso local. Revisa la cortina de notificaciones. Si no aparece, comprueba los permisos de Chrome/Carterita en Ajustes del teléfono y No molestar.');
  }catch(err){testStatus('La prueba local falló: '+err.message);}finally{button.disabled=false;}
 };
 navigator.serviceWorker?.addEventListener('message',event=>{
  if(event.data?.type==='CARTERITA_PUSH_SHOWN'&&event.data.test===true){testReceived=true;testStatus('¡Carterita recibió la prueba de Cloudflare y el sistema aceptó mostrarla! Revisa la cortina de notificaciones. Si está oculta, revisa Ajustes del teléfono → Notificaciones → Chrome/Carterita y No molestar.');}
  if(event.data?.type==='CARTERITA_PUSH_SHOW_FAILED')testStatus('La push llegó, pero el dispositivo no permitió mostrarla. Revisa los permisos de notificación y pulsa Probar aviso local.');
 });
 $('#push-dialog').addEventListener('close',()=>{$('#push-code').value='';});
 window.addEventListener('online',()=>{dirty=true;syncPush();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)dirty=true;syncPush();});window.addEventListener('pagehide',()=>syncPush());
 window.addEventListener('storage',event=>{if(event.key===KEY)saved=load();});
 if(saved&&!saved.disabled){dirty=true;syncPush();}
}
