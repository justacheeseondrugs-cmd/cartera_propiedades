// Calendar configuration is device-local; access tokens never enter storage or backups.
const KEY='carterita-calendar-v1',SOURCE='carterita-v1';
const SCOPES='openid email https://www.googleapis.com/auth/calendar.app.created';
export function calendarEntries(clients){return clients.filter(c=>c.followup&&!c.followupDoneAt&&c.status!=='Cerrado').sort((a,b)=>(a.followup+' '+(a.followupTime||'')).localeCompare(b.followup+' '+(b.followupTime||''))||a.name.localeCompare(b.name));}
export function eventBody(c,details=true){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(c.followup)||!/^\d{2}:\d{2}$/.test(c.followupTime||''))return null;
 const start=new Date(c.followup+'T'+c.followupTime+':00');
 if(!Number.isFinite(+start)||start.getHours()!==Number(c.followupTime.slice(0,2))||start.getMinutes()!==Number(c.followupTime.slice(3))||[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-')!==c.followup)return null;
 return {summary:details?c.name+' · '+(c.nextAction||'Revisar seguimiento'):'Pendiente de Carterita',description:details?(c.nextAction||'Revisar seguimiento'):'Abre Carterita para revisar este pendiente.',start:{dateTime:start.toISOString()},end:{dateTime:new Date(+start+15*60000).toISOString()},visibility:'private',reminders:{useDefault:false,overrides:[{method:'popup',minutes:1}]},extendedProperties:{private:{carteritaSource:SOURCE,carteritaClientId:String(c.id)}}};
}
export async function syncCalendar({clients,calendarId,request,details=true,source=SOURCE}){
 const base='/calendars/'+encodeURIComponent(calendarId)+'/events',existing=[];let page;
 do{const result=await request(base+'?privateExtendedProperty='+encodeURIComponent('carteritaSource='+source)+'&maxResults=2500'+(page?'&pageToken='+encodeURIComponent(page):''));existing.push(...(result.items||[]));page=result.nextPageToken;}while(page);
 const desired=new Map(calendarEntries(clients).map(c=>[String(c.id),eventBody(c,details)]).filter(([,body])=>body));
 const seen=new Set();let changed=0;
 for(const event of existing){
  const id=event.extendedProperties?.private?.carteritaClientId;
  if(event.extendedProperties?.private?.carteritaSource!==source||!id||!event.id)continue;
  const body=desired.get(id);
  if(!body||seen.has(id)){await request(base+'/'+encodeURIComponent(event.id),'DELETE');changed++;continue;}
  seen.add(id);
  // Only patch fields managed by Carterita; never send other client details.
  if(event.summary!==body.summary||event.description!==body.description||Date.parse(event.start?.dateTime)!==Date.parse(body.start.dateTime)||Date.parse(event.end?.dateTime)!==Date.parse(body.end.dateTime)||event.visibility!=='private'||JSON.stringify(event.reminders)!==JSON.stringify(body.reminders)){
   await request(base+'/'+encodeURIComponent(event.id),'PATCH',body);changed++;
  }
 }
 for(const [id,body] of desired)if(!seen.has(id)){await request(base,'POST',body);changed++;}
 return {count:desired.size,changed};
}
export function initCalendar({getClients,canSync,openClient}){
 const $=s=>document.querySelector(s),dialog=$('#calendar-dialog');let month=new Date(),day='',token=null,expires=0,account=null,busy=false,timer,dirty=false,epoch=0,sdkPromise;
 let config={clientId:'',accounts:{},details:true};try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object')config={...config,...saved,accounts:saved.accounts||{}};}catch{}
 const status=message=>{$('#calendar-state').textContent=message;};
 function save(){localStorage.setItem(KEY,JSON.stringify(config));}
 function unlocked(){return !document.hidden&&!document.documentElement.classList.contains('device-locked')&&canSync();}
 function controls(){const active=Boolean(token&&Date.now()<expires&&account);$('#calendar-connect').disabled=busy;$('#calendar-create').hidden=!active||Boolean(config.accounts[account?.sub]?.calendarId);$('#calendar-sync').disabled=busy||!active||!config.accounts[account?.sub]?.calendarId;$('#calendar-disconnect').hidden=!active;$('#calendar-disconnect').disabled=busy;$('#calendar-client-id').disabled=busy;$('#calendar-details').disabled=busy;}
 function render(){
  const entries=calendarEntries(getClients()),year=month.getFullYear(),m=month.getMonth(),grid=$('#calendar-grid');grid.replaceChildren();
  $('#calendar-month').textContent=month.toLocaleDateString('es-CL',{month:'long',year:'numeric'});
  const first=(new Date(year,m,1).getDay()+6)%7,last=new Date(year,m+1,0).getDate();
  for(let i=0;i<first;i++)grid.append(document.createElement('span'));
  for(let n=1;n<=last;n++){const key=[year,String(m+1).padStart(2,'0'),String(n).padStart(2,'0')].join('-'),items=entries.filter(c=>c.followup===key),b=document.createElement('button');b.type='button';b.className='quiet calendar-day';b.textContent=n+(items.length?' · '+items.length:'');b.setAttribute('aria-label',`${n}, ${items.length} pendiente(s)`);b.setAttribute('aria-pressed',String(key===day));b.onclick=()=>{day=key;render();};grid.append(b);}
  $('#calendar-day-title').textContent=day?'Pendientes del '+new Date(day+'T12:00:00').toLocaleDateString('es-CL'):'Pendientes del mes';
  const list=$('#calendar-agenda');list.replaceChildren();const visible=entries.filter(c=>day?c.followup===day:c.followup.startsWith(`${year}-${String(m+1).padStart(2,'0')}`));
  if(!visible.length)list.textContent='No tienes pendientes para estas fechas.';
  for(const c of visible){const b=document.createElement('button');b.type='button';b.className='quiet calendar-agenda-item';const title=document.createElement('strong'),info=document.createElement('span');title.textContent=c.name;info.textContent=`${c.followup} · ${c.followupTime||'Sin hora'} — ${c.nextAction||'Revisar ficha'}`;b.append(title,info);b.onclick=()=>{dialog.close();openClient(c.id);};list.append(b);}
  $('#calendar-missing-time').textContent=entries.filter(c=>!eventBody(c)).length+' pendiente(s) sin fecha y hora válidas: se ven aquí, pero no se envían a Google.';controls();
 }
 async function request(path,method='GET',body){
  if(!unlocked())throw Error('Desbloquea Carterita y vuelve a sincronizar.');
  if(!token||Date.now()>=expires)throw Error('La autorización venció. Toca «Conectar Google» otra vez.');
  const response=await fetch('https://www.googleapis.com/calendar/v3'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(response.status===401){token=null;throw Error('La autorización venció. Toca «Conectar Google» otra vez.');}
  if(method==='DELETE'&&[404,410].includes(response.status))return {};
  if(!response.ok)throw Error(response.status===403?'Google no permitió esta operación. Revisa los permisos y la configuración de la conexión.':response.status===429?'Google está ocupado. Intenta sincronizar más tarde.':'No se pudo actualizar Google Calendar. Tus datos siguen guardados en Carterita.');
  return response.status===204?{}:response.json();
 }
 async function synchronize(){
  if(busy||!token||!account||!unlocked())return;
  const stored=config.accounts[account.sub];if(!stored?.calendarId)return;
  const run=epoch;busy=true;dirty=false;controls();status('Sincronizando con Google…');
  try{const result=await syncCalendar({clients:structuredClone(getClients()),calendarId:stored.calendarId,request,details:config.details});if(run!==epoch)return;stored.lastSync=new Date().toISOString();save();status(`${result.count} pendiente(s) sincronizados · ${new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}. Cuenta: ${account.email}`);}
  catch(error){dirty=true;status(navigator.onLine?error.message:'Sin internet. Tus pendientes siguen aquí; sincroniza al volver.');}
  finally{busy=false;controls();if(dirty&&run===epoch&&token&&unlocked())status($('#calendar-state').textContent+' Hay cambios pendientes; toca «Sincronizar ahora».');}
 }
 let lastQueued='';
 function queue(){const signature=JSON.stringify([config.details,Intl.DateTimeFormat().resolvedOptions().timeZone,calendarEntries(getClients()).map(c=>[c.id,c.name,c.nextAction,c.followup,c.followupTime])]);if(signature===lastQueued)return;lastQueued=signature;dirty=true;if(dialog.open)render();clearTimeout(timer);timer=setTimeout(()=>{if(!busy)synchronize();},1200);}
 function loadSDK(){if(window.google?.accounts?.oauth2)return Promise.resolve();if(sdkPromise)return sdkPromise;sdkPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;const timeout=setTimeout(()=>{s.remove();sdkPromise=null;reject(Error('Google no respondió. Vuelve a intentarlo.'));},15000);s.onload=()=>{clearTimeout(timeout);resolve();};s.onerror=()=>{clearTimeout(timeout);sdkPromise=null;s.remove();reject(Error('No se pudo conectar con Google. Revisa internet.'));};document.head.append(s);});return sdkPromise;}
 $('#calendar-open').onclick=()=>{render();dialog.showModal();};
 $('#calendar-prev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);day='';render();};
 $('#calendar-next').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);day='';render();};
 $('#calendar-today').onclick=()=>{month=new Date();day=[month.getFullYear(),String(month.getMonth()+1).padStart(2,'0'),String(month.getDate()).padStart(2,'0')].join('-');render();};
 $('#calendar-client-id').value=config.clientId;$('#calendar-details').checked=config.details;
 $('#calendar-details').onchange=()=>{config.details=$('#calendar-details').checked;try{save();queue();}catch{status('No se pudo guardar la configuración.');}};
 $('#calendar-connect').onclick=async()=>{
  if(!navigator.onLine){status('Necesitas internet para conectar Google.');return;}
  const id=$('#calendar-client-id').value.trim();if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)){status('Primero configura el identificador público de Google. Abre la guía de conexión.');return;}
  if(config.clientId!==id){token=null;account=null;epoch++;config.accounts={};config.clientId=id;try{save();}catch{status('No se pudo guardar la configuración.');return;}}
  if(!window.google?.accounts?.oauth2){status('Preparando Google…');try{await loadSDK();status('Google está listo. Toca «Conectar Google» para elegir la cuenta.');}catch(e){status(e.message);}return;}
  busy=true;controls();
  try{window.google.accounts.oauth2.initTokenClient({client_id:id,scope:SCOPES,callback:async response=>{
   if(response.error){busy=false;controls();status('No se autorizó la conexión con Google.');return;}
   token=response.access_token;expires=Date.now()+Math.max(0,Number(response.expires_in||0)-60)*1000;epoch++;busy=true;controls();
   try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('No se pudo identificar la cuenta de Google.');const user=await r.json();if(!user.sub)throw Error('Google no confirmó la cuenta.');account={sub:user.sub,email:user.email||'Cuenta de Google'};status(`Cuenta conectada: ${account.email}. ${config.accounts[account.sub]?.calendarId?'Toca «Sincronizar ahora».':'Toca «Crear calendario Carterita» para empezar.'}`);}
   catch(e){token=null;account=null;status(e.message);}finally{busy=false;controls();}
  },error_callback:()=>{busy=false;controls();status('La ventana de Google se cerró o no pudo abrirse. Vuelve a intentarlo.');}}).requestAccessToken({prompt:'select_account'});}catch{busy=false;controls();status('No se pudo abrir Google. Inténtalo de nuevo desde este botón.');}
 };
 $('#calendar-create').onclick=async()=>{
  if(busy||!account||!unlocked())return;busy=true;controls();status('Creando tu calendario separado…');
  try{const calendar=await request('/calendars','POST',{summary:'Carterita',description:'Pendientes enviados desde Carterita. Edita sus fechas en Carterita.',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Santiago'});config.accounts[account.sub]={calendarId:calendar.id};save();status('Calendario creado. Toca «Sincronizar ahora» para enviar los pendientes.');}
  catch(e){status(e.message);}finally{busy=false;controls();}
 };
 $('#calendar-sync').onclick=synchronize;
 $('#calendar-disconnect').onclick=()=>{epoch++;token=null;account=null;clearTimeout(timer);status('Desconectada. Los eventos ya enviados se conservan en Google.');controls();};
 window.addEventListener('online',()=>{if(dirty&&token)synchronize();});
 window.addEventListener('carterita-unlocked',()=>{if(dirty&&token)synchronize();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dirty&&token)synchronize();});
 status('El calendario funciona sin internet. Google aún no está conectado en esta sesión.');render();return {queue,render};
}
