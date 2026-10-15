import {mountClientFiles,exportFiles,exportFilePackages,filesFromPackage,saveFiles,removeFiles,listFiles} from './attachments.js';
import {AI_KEY,AI_MODEL,reserveCorrection,correctMessage} from './ai.js';
import {cleanRecord,parseBackup,mergeRecords,missingFields,prepareReply,preparePrompt,prepareRevision,sessionFromBackup,localDate,pendingDocuments,dueToday,DOCUMENT_STATUSES,makeCalendar,calendarTest,googleCalendarLink,cleanWritingProfile,writingProfileFromBackup,INITIAL_WRITING_PROFILE,clientPackagePrompt,parseClientPackage,clientMatches,applyClientPackage,STATUSES,INTENTS,KINDS,AREAS,SOURCES,SIMULATION_STATUSES,whatsappLink} from './core.js';
const $=s=>document.querySelector(s),KEY='cartera-v1';
let clients=[],selected=null,stat='today',businessArea='all',incoming=null,draftTimer,toastTimer,formDocuments=[],readOnly=false,savedPrompt=null,formContext="general",detailPanel="summary";
let aiBusy=false,aiProposal=null,incomingSession=null,incomingFiles=[];
const contexts=new Map();let writingProfile=cleanWritingProfile(INITIAL_WRITING_PROFILE),writingExamples=[],incomingProfile=null;let packageEntries=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'}):'Sin fecha';
const awaiting=c=>c.businessArea==='Leasing'&&c.status!=='Cerrado'&&['Solicitada','En curso','Esperando respuesta'].includes(c.simulationStatus);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),6000);}
function storageError(){ $('#storage-message').textContent='No se pudo guardar. Exporta un respaldo antes de cerrar; revisa el espacio o permisos del navegador.';toast('No se pudo guardar. No cierres la app sin exportar los datos.');}
try{const raw=localStorage.getItem(KEY);if(raw){clients=parseBackup(raw);writingProfile=writingProfileFromBackup(raw)||cleanWritingProfile(INITIAL_WRITING_PROFILE);}}catch{readOnly=true;storageError();$('#storage-message').textContent='No se pudo leer el almacenamiento. Recupera un respaldo desde Respaldos; no reemplazaremos los datos existentes.';}
function envelope(data,profile=writingProfile,session=captureSession(data)){return {session,app:'cartera',version:7,exportedAt:new Date().toISOString(),clients:data,writingProfile:profile};}
function commit(data,recovery=false,profile=writingProfile,session){if(readOnly&&!recovery){toast('Recupera un respaldo o recarga antes de editar.');return false;}try{localStorage.setItem(KEY,JSON.stringify(envelope(data,profile,session)));clients=data;writingProfile=profile;return true;}catch{storageError();return false;}}
function current(){return clients.find(c=>c.id===selected);}
function saveContext(){if(!selected||!$('#template'))return;contexts.set(selected,{original:$('#original').value,style:$('#template').value,tone:$('#tone').value,prompt:$('#prompt')?.value||'',extra:$('#revision-extra')?.value||'',adjustments:[...document.querySelectorAll('[data-adjustment]:checked')].map(el=>el.dataset.adjustment)});}
function flushDraft(){clearTimeout(draftTimer);saveContext();const c=current(),field=$('#reply');if(!c||!field||c.draft===field.value)return true;const next=clients.map(r=>r.id===c.id?{...r,draft:field.value,updatedAt:new Date().toISOString()}:r);if(commit(next)){if($('#draft-state'))$('#draft-state').textContent='Borrador guardado en este dispositivo';if($('#wa-draft-preview'))$('#wa-draft-preview').textContent=field.value.trim()?'Se abrirá con el borrador guardado.':'Primero prepara un borrador en Mensaje.';return true;}return false;}
function updateStats(){$('.intro .muted').textContent=clients.length?'Tienes '+clients.filter(c=>dueToday(c)).length+' cliente(s) por contactar hoy o de días anteriores.':'Empieza añadiendo un cliente. Solo necesitas su nombre.';const scoped=clients.filter(c=>businessArea==='all'||c.businessArea===businessArea);$('#count-all').textContent=scoped.length;$('#count-docs').textContent=scoped.filter(c=>c.businessArea==='Leasing'&&c.status!=='Cerrado'&&pendingDocuments(c).length).length;$('#count-simulation').textContent=scoped.filter(awaiting).length;$('#count-today').textContent=scoped.filter(c=>dueToday(c)).length;document.querySelectorAll('[data-stat]').forEach(b=>{b.classList.toggle('active-stat',b.dataset.stat===stat);b.setAttribute('aria-pressed',String(b.dataset.stat===stat));});}
function render(){
 updateStats();$('#new-client').disabled=readOnly;$('#demo').disabled=readOnly;
 const search=$('#search').value.toLocaleLowerCase().trim(),status=$('#filter-status').value,intent=$('#filter-intent').value;
 const list=clients.filter(c=>(businessArea==='all'||c.businessArea===businessArea)&&(!status||c.status===status)&&(!intent||c.intent===intent)&&(stat!=='documents'||c.businessArea==='Leasing'&&c.status!=='Cerrado'&&pendingDocuments(c).length)&&(stat!=='simulation'||awaiting(c))&&(stat!=='today'||dueToday(c))&&(!search||[c.name,c.phone,c.email,c.area,c.property].join(' ').toLocaleLowerCase().includes(search))).sort((a,b)=>{
 if(stat==='today')return a.followup.localeCompare(b.followup);return b.updatedAt.localeCompare(a.updatedAt);
 });
 const labels={all:'Todas las consultas',documents:'Con documentos faltantes o por corregir',simulation:'Simulaciones solicitadas, en curso o esperando respuesta',today:'Contactos pendientes de hoy y días anteriores'};
 $('.list-title h2').textContent=stat==='today'?'Mis pendientes':'Mis clientes';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===(stat==='today'?'today':'all'))));
 $('#active-filter').textContent=(businessArea==='all'?'Ambas áreas':businessArea)+' · '+labels[stat]+' · '+list.length+' resultado(s)';
 $('#client-list').innerHTML=list.length?list.map(c=>`<button class="client-card ${selected===c.id?'active':''}" data-select="${esc(c.id)}" aria-pressed="${selected===c.id}"><div class="card-top"><strong>${esc(c.name)}</strong><span class="badge">${esc(c.status)}</span></div><p>${esc(c.businessArea)}${c.area?' · '+esc(c.area):''}</p><p class="card-next">${esc(c.nextAction||'Definir el próximo paso')}</p><p class="small">${c.followupDoneAt?'✓ Seguimiento hecho':c.followup?'Contactar: '+esc(dateLabel(c.followup))+(c.followupTime?' · '+esc(c.followupTime):''):'Sin fecha de contacto'}</p></button>`).join(''):`<div class="empty"><p class="muted">${clients.length?(stat==='today'?'No tienes contactos pendientes para hoy. Puedes revisar todos tus clientes.':'No hay clientes con estos filtros.'):'Añade tu primer cliente. Si quieres conocer la app antes, toca Ver ejemplos.'}</p>${clients.length&&stat==='today'?'<button class="secondary" data-view="all">Ver todos mis clientes</button>':''}</div>`;
 renderDetail();
}
function renderDetail(){
 const c=current();$('.workspace').classList.toggle('has-selection',Boolean(c));
 if(!c){$('#detail').innerHTML='<div class="empty"><div class="symbol" aria-hidden="true">✦</div><p class="overline">LEASING Y CORRETAJE</p><h2>Elige un cliente para continuar.</h2><p class="muted">Aquí podrás escribirle un mensaje, revisar sus documentos o dejar un recordatorio.</p><button class="primary" id="empty-new">Añadir cliente</button></div>';return;}
 const leasing=c.businessArea==='Leasing';const fields=[['Comuna',c.area],['Tipo de propiedad',c.kind],['Presupuesto / precio',c.budget],['Propiedad o código',c.property],['Correo',c.email],['Próximo contacto',dateLabel(c.followup)]];
 const leasingHtml=leasing?`<section class="workflow-block"><h3>Documentos</h3><p class="small muted">${pendingDocuments(c).length} pendiente(s) de recibir o corregir. Lista editable según cada caso.</p>${c.documents.length?`<ul class="document-list">${c.documents.map(d=>`<li><div>${esc(d.name)}<br><button class="text-button" data-reminder="document" data-document="${esc(d.id)}">Recordar este documento</button>${d.notes?`<small>${esc(d.notes)}</small>`:''}</div><span class="badge ${['Faltante','Requiere corrección'].includes(d.status)?'pending':''}">${esc(d.status)}</span></li>`).join('')}</ul>`:'<p class="missing">Todavía no hay una lista de documentos. Añade los que solicite tu corredora; no asumimos requisitos.</p>'}<button class="secondary" id="edit-documents">Editar documentos</button> <button class="quiet" data-reminder="documents">Recordar documentos</button></section><section class="workflow-block"><h3>Simulación de crédito</h3><span class="badge">${esc(c.simulationStatus)}</span><p class="small">${c.simulationEntity?'Entidad: '+esc(c.simulationEntity)+'<br>':''}${c.simulationRequestedOn?'Solicitada: '+esc(dateLabel(c.simulationRequestedOn)):''}</p>${c.simulationNotes?`<div class="notes">${esc(c.simulationNotes)}</div>`:''}<p class="small muted">Seguimiento manual. No calcula crédito ni confirma aprobación.</p><button class="secondary" id="edit-simulation">Actualizar simulación</button> <button class="quiet" data-reminder="simulation">Recordar simulación</button></section>`:'';
 $('#detail').innerHTML=`<button class="quiet mobile-back" id="back-list">Volver a clientes</button><div class="detail-head"><div><span class="badge">${esc(c.businessArea)} · ${esc(c.status)}</span><h2>${esc(c.name)}</h2><p class="muted">${esc(c.source)} · ${esc(c.intent)}${c.phone?' · '+esc(c.phone):''}</p></div><button class="quiet" id="edit-client">Editar ficha</button></div>${savedPrompt?.id===c.id?`<aside class="saved-prompt" aria-label="Seguimiento después de guardar"><strong>Cambios guardados.</strong><p>¿Quieres recordar el próximo paso de este caso?</p><button class="primary" data-reminder="${esc(savedPrompt.context)}">Programar recordatorio</button> <button class="text-button" id="dismiss-reminder">Ahora no</button></aside>`:''}<div class="action-box"><strong>${c.followupDoneAt?'✓ SEGUIMIENTO HECHO':'PRÓXIMA ACCIÓN'} · ${esc(dateLabel(c.followup))}${c.followupTime?' · '+esc(c.followupTime):''}</strong><p>${esc(c.nextAction||'Define qué falta hacer y cuándo volver a contactar.')}</p><button class="text-button" id="followup-edit">Editar seguimiento</button><button class="quiet" data-reminder="general">Programar aviso</button>${c.followup||c.nextAction?`<button class="secondary" id="toggle-done">${c.followupDoneAt?'Volver a pendiente':'✓ Marcar como hecho'}</button>`:''}<div class="calendar-actions"><button class="quiet" id="download-calendar">Descargar para calendario (.ics)</button><button class="quiet" id="google-calendar">Abrir Google Calendar</button></div><p class="small muted">Elige fecha y hora para exportar. El evento solicita aviso 1 minuto antes; confirma que tu calendario lo conserve. No se sincroniza: marcar como hecho aquí no elimina el evento. Antes de guardar en Google, elige la cuenta y el calendario correctos.</p></div><dl class="info-grid">${fields.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value||'Por confirmar')}</dd></div>`).join('')}</dl>${leasingHtml}${c.notes?`<section class="workflow-block"><h3>Notas</h3><div class="notes">${esc(c.notes)}</div><button class="text-button" data-reminder="general">Recordar el próximo paso</button></section>`:''}<section class="composer"><h3>${leasing?'Mensaje de seguimiento':'Cómo seguir la conversación'}</h3><p class="muted">Elige el objetivo. Obtendrás una plantilla editable, sin IA ni envío automático.</p><label>Mensaje del cliente <span class="optional">referencia temporal; solo se usa al generar el prompt</span><textarea id="original" rows="2" maxlength="5000" placeholder="Pega lo que contestó, si quieres preparar un prompt…"></textarea></label><div class="two"><label>Objetivo<select id="template">${leasing?'<option value="documents">Pedir documentos pendientes</option><option value="simulation">Seguimiento de simulación</option>':''}<option value="dataprop">Primer contacto desde Dataprop</option><option value="qualify">Conocer lo que busca</option><option value="availability">Consultar disponibilidad</option><option value="visit">Proponer una visita</option><option value="reply">Responder sin cortar la conversación</option><option value="followup">Retomar el contacto</option><option value="initial">Primera atención general</option></select></label><label>Tono<select id="tone"><option value="warm">Cercano</option><option value="formal">Profesional</option></select></label></div>${!leasing&&missingFields(c).length?`<p class="missing">Por completar en la ficha: ${esc(missingFields(c).join(', '))}.</p>`:''}<button class="secondary" id="generate">Preparar mensaje</button><label style="margin-top:18px">Borrador para revisar<textarea id="reply" rows="6" maxlength="10000" placeholder="Prepara un mensaje o escribe tu respuesta…">${esc(c.draft)}</textarea></label><p id="draft-state" class="save-state">${c.draft?'Borrador guardado en este dispositivo':''}</p><div class="compose-actions"><button class="primary" id="copy">Copiar mensaje</button><button class="quiet" id="followup-edit-bottom">Anotar próximo paso</button><button class="quiet" data-reminder="conversation">Recordar volver a contactar</button></div><p class="small muted">Sustituye los campos entre corchetes. Revisa los datos y que el contacto haya autorizado este canal antes del primer mensaje. No se verifica disponibilidad.</p><details class="prompt-panel"><summary>Preparar un prompt para una IA</summary><p class="small muted">Opcional: copia las instrucciones para usarlas en tu IA. No se envía nada desde Cartera. Revisa y quita datos personales del mensaje antes de compartirlo.</p><button class="secondary" id="generate-prompt">Generar prompt</button><label style="margin-top:12px">Prompt editable<textarea id="prompt" rows="6" maxlength="30000" placeholder="Aquí aparecerán las instrucciones…"></textarea></label><button class="primary" id="copy-prompt">Copiar instrucciones</button> <button class="quiet" id="open-chatgpt">Abrir ChatGPT</button> <button class="text-button" data-open-style="true">Mi forma de escribir</button></details></section><button class="danger" id="delete-client">Eliminar esta consulta</button>`;
 const context=contexts.get(c.id);$('#template').value=context?.style||(leasing?'documents':c.source==='Dataprop'?'dataprop':'initial');if(!$('#template').value)$('#template').value='initial';$('#tone').value=context?.tone||'warm';$('#original').value=context?.original??c.lastMessage??'';simplifyDetail(c);if(context){$('#prompt').value=context.prompt||'';$('#revision-extra').value=context.extra||'';for(const el of document.querySelectorAll('[data-adjustment]'))el.checked=(context.adjustments||[]).includes(el.dataset.adjustment);}
}
function setDetailPanel(panel){
 detailPanel=panel;document.querySelectorAll('[data-client-panel]').forEach(el=>el.hidden=el.dataset.clientPanel!==panel);document.querySelectorAll('[data-panel]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.panel===panel)));
}
function simplifyDetail(c){
 const root=$('#detail'),head=root.querySelector('.detail-head'),action=root.querySelector('.action-box'),info=root.querySelector('.info-grid'),composer=root.querySelector('.composer');
 const nav=document.createElement('nav');nav.className='client-tabs';nav.setAttribute('aria-label','Opciones del cliente');
 const panels=[['summary','Qué sigue'],['message','Mensaje'],['documents','Documentos'],...(c.businessArea==='Leasing'?[['simulation','Simulación']]:[])];
 nav.innerHTML=panels.map(([key,label])=>`<button data-panel="${key}" aria-pressed="false">${label}</button>`).join('');(root.querySelector('.saved-prompt')||head).after(nav);
 const summary=document.createElement('section');summary.dataset.clientPanel='summary';
 const last=document.createElement('section');last.className='last-message-card';last.innerHTML=`<h3>Último mensaje del cliente</h3><p class="last-message-text">${esc(c.lastMessage||'Todavía no has guardado un mensaje.')}</p>${c.lastMessageAt?`<p class="small muted">Guardado el ${esc(new Date(c.lastMessageAt).toLocaleString('es-CL'))}</p>`:''}<button class="text-button" id="edit-last-message">${c.lastMessage?'Cambiar mensaje':'Guardar un mensaje recibido'}</button>`;
 summary.append(last,action);root.append(summary);
 const whatsapp=document.createElement('div');whatsapp.className='whatsapp-shortcut';whatsapp.innerHTML=`<button class="primary" data-open-whatsapp="true">Abrir WhatsApp con mi mensaje</button><p id="wa-draft-preview" class="small muted">${esc(c.draft?'Se abrirá con el borrador guardado.':'Primero prepara un borrador en Mensaje.')}</p><p class="small muted">Tú revisas y pulsas Enviar. No leemos tus chats.</p>`;summary.append(whatsapp);
 const write=document.createElement('button');write.className='primary write-shortcut';write.dataset.panel='message';write.textContent='Escribir un mensaje';summary.append(write);
 const contact=document.createElement('details');contact.className='disclosure';contact.innerHTML='<summary>Ver datos del cliente</summary>';contact.append(info);summary.append(contact);
 let documents=root.querySelector('#edit-documents')?.closest('section');if(!documents){documents=document.createElement('section');documents.dataset.clientPanel='documents';root.append(documents);}mountClientFiles(documents,c.id,{notify:toast,canEdit:()=>!readOnly&&Boolean(clients.find(r=>r.id===c.id))});const simulation=root.querySelector('#edit-simulation')?.closest('section');
 for(const section of root.querySelectorAll('.workflow-block'))if(section!==documents&&section!==simulation&&!section.closest('.client-files')){const notes=document.createElement('details');notes.className='disclosure';notes.innerHTML='<summary>Ver notas</summary>';notes.append(section);summary.append(notes);}
 const more=document.createElement('details');more.className='disclosure';more.innerHTML='<summary>Otras acciones</summary>';more.append($('#delete-client'));summary.append(more);
 const calendar=document.createElement('details');calendar.className='disclosure';calendar.innerHTML='<summary>Otras opciones de calendario</summary>';calendar.append(action.querySelector('.calendar-actions'),action.querySelector('p.small'));action.append(calendar);
 $('#followup-edit').textContent='Cambiar próximo paso';action.querySelector('[data-reminder]').textContent='Recordarme';
 const corrections=document.createElement('details');corrections.className='message-corrections';corrections.innerHTML=`<summary>Ajustar este mensaje</summary><p class="small muted">Elige los cambios. OpenAI recibirá este borrador, tus ajustes, un perfil breve y datos de referencia de esta ficha. Revisa y quita datos sensibles antes de enviarlos.</p><fieldset><legend>¿Qué mejoramos?</legend><div class="adjustment-options">${[['closer','Más cercano'],['formal','Más formal'],['emojis','Más emojis'],['noEmojis','Sin emojis'],['clear','Más claro'],['brief','Más breve'],['detail','Más completo']].map(([key,label])=>`<label><input type="checkbox" data-adjustment="${key}"> ${label}</label>`).join('')}</div></fieldset><label>Otro cambio (opcional)<textarea id="revision-extra" rows="2" maxlength="1000" placeholder="Por ejemplo: que termine preguntando cuándo puede visitar…"></textarea></label><button class="primary" id="correct-in-app">Corregir aquí con IA</button> <button class="quiet" id="revise-message">Usar ChatGPT manualmente</button><p class="small" id="ai-progress" role="status"></p><p class="small muted">Solo para este mensaje. Tu perfil y tu borrador se conservan.</p>`;composer.querySelector('.prompt-panel').before(corrections);
 const prompt=composer.querySelector('.prompt-panel');prompt.querySelector('summary').textContent='Escribir con ChatGPT';prompt.querySelector('p').textContent='Prepara las instrucciones, revisa qué compartirás y cópialas en ChatGPT. Después pega su respuesta en el borrador de Cartera. No se envía nada automáticamente.';$('#generate-prompt').textContent='Preparar para ChatGPT';prompt.insertBefore($('#original').closest('label'),prompt.querySelector('button'));
 const tone=document.createElement('details');tone.className='disclosure';tone.innerHTML='<summary>Cambiar el tono del mensaje</summary>';tone.append($('#tone').closest('label'));const selector=$('#template').closest('label');selector.firstChild.textContent='¿Qué quieres decirle?';composer.querySelector('.two').replaceWith(selector,tone);
 composer.querySelector('h3').textContent='Prepara su mensaje';composer.querySelector('.muted').textContent='1. Elige qué necesitas decir. 2. Revisa el texto. 3. Cópialo a WhatsApp.';
 $('#generate').textContent='Preparar texto';$('#copy').textContent='Copiar para WhatsApp';$('#reply').closest('label').firstChild.textContent='Revisa o cambia el texto';
 const infoNote=composer.querySelector('.compose-actions + p');if(infoNote)infoNote.textContent='Pega el mensaje en WhatsApp y pulsa Enviar. Revisa los datos y sustituye los campos entre corchetes.';
 const send=document.createElement('button');send.type='button';send.className='primary';send.dataset.openWhatsapp='true';send.textContent='Abrir WhatsApp con este texto';composer.querySelector('.compose-actions').prepend(send);
 composer.dataset.clientPanel='message';root.append(summary,composer);if(documents){documents.dataset.clientPanel='documents';root.append(documents);}if(simulation){simulation.dataset.clientPanel='simulation';root.append(simulation);}
 if(!panels.some(([key])=>key===detailPanel))detailPanel='summary';setDetailPanel(detailPanel);
}
$('#last-message-form').onsubmit=e=>{e.preventDefault();if(readOnly)return;const c=current();if(!c)return;const text=$('#last-message-text').value.trim();const next=clients.map(r=>r.id===c.id?{...r,lastMessage:text,lastMessageAt:text?new Date().toISOString():'',updatedAt:new Date().toISOString()}:r);if(commit(next)){contexts.delete(c.id);$('#last-message-dialog').close();detailPanel='summary';render();toast('Último mensaje guardado en este dispositivo.');}};
function renderWritingExamples(){
 $('#writing-example-list').innerHTML=writingExamples.map((text,i)=>`<div class="writing-example"><label>Ejemplo ${i+1}<textarea rows="3" maxlength="1200" data-writing-example="${i}">${esc(text)}</textarea></label><button type="button" class="text-button" data-remove-writing="${i}">Quitar ejemplo</button></div>`).join('');$('#add-writing-example').disabled=writingExamples.length>=5;
}
function openWritingProfile(){
 if(readOnly||!flushDraft())return;const form=$('#writing-form');form.reset();for(const el of form.elements)if(el.name)el.value=writingProfile[el.name]??'';writingExamples=[...writingProfile.examples];renderWritingExamples();$('#writing-dialog').showModal();
}
$('#writing-form').onsubmit=e=>{
 e.preventDefault();try{const profile=cleanWritingProfile({...Object.fromEntries(new FormData(e.target)),examples:writingExamples});if(commit(clients,false,profile)){$('#writing-dialog').close();if($('#prompt'))$('#prompt').value='';toast('Estilo guardado. Prepara nuevas instrucciones para usarlo.');}}catch(err){toast(err.message);}
};
function revealField(el){let parent=el?.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}}
function docEditor(){
 $('#document-editor').innerHTML=formDocuments.length?formDocuments.map((d,i)=>`<div class="document-edit" data-doc-index="${i}"><label>Nombre del documento<input data-doc-field="name" maxlength="160" required value="${esc(d.name)}" placeholder="Escribe el nombre indicado por la corredora"></label><div class="two"><label>Estado<select data-doc-field="status">${DOCUMENT_STATUSES.map(s=>`<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></label><button type="button" class="danger" data-remove-doc="${i}" aria-label="Eliminar documento ${i+1}">Quitar</button></div><label>Observación <span class="optional">opcional</span><input data-doc-field="notes" maxlength="500" value="${esc(d.notes)}" placeholder="Ej. Falta una página o requiere actualización"></label></div>`).join(''):'<p class="small muted">Lista vacía. Añade cada documento cuando conozcas los requisitos.</p>';
}
function showLeasingFields(){const show=$('#client-form').elements.businessArea.value==='Leasing';$('#leasing-fields').hidden=!show;$('#leasing-options').hidden=!show;$('#leasing-fields').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=!show);}
function downloadCalendar(content,filename){const blob=new Blob([content],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function openForm(c=null,focus){
 if(readOnly||!flushDraft())return;formContext=focus==='documents'?'documents':focus==='simulationStatus'?'simulation':'general';const form=$('#client-form');form.reset();$('#form-title').textContent=c?'Editar cliente':'Añadir cliente';form.querySelectorAll('details').forEach(el=>el.open=false);
 const defaults={status:'Nuevo',intent:'Por definir',businessArea:businessArea==='Leasing'?'Leasing':'Corretaje',source:businessArea==='Leasing'?'WhatsApp':'Dataprop',simulationStatus:'Sin solicitar'};
 for(const el of form.elements){if(el.name)el.value=c?.[el.name]??defaults[el.name]??'';}
 formDocuments=(c?.documents??[]).map(d=>({...d}));docEditor();showLeasingFields();if(focus)revealField(focus==='documents'?$('#add-document'):form.elements.namedItem(focus));$('#client-dialog').showModal();setTimeout(()=>{if(focus==='documents')$('#add-document').focus();else (form.elements.namedItem(focus||'name')||form.elements.namedItem('name')).focus();},30);
}
function openReminder(context='general',documentId){
 if(readOnly||!flushDraft())return;const c=current();if(!c)return;
 const defaults={documents:'Revisar documentos pendientes y confirmar el próximo paso',simulation:'Consultar el estado de la simulación de crédito',conversation:'Volver a contactar y continuar la conversación'};
 const doc=c.documents.find(d=>d.id===documentId);
 const action=doc?'Revisar '+doc.name:(defaults[context]||c.nextAction||'Revisar el próximo paso del caso');
 const form=$('#reminder-form');form.reset();form.elements.clientId.value=c.id;form.elements.action.value=action.slice(0,500);form.elements.date.value=c.followup&&!c.followupDoneAt?c.followup:localDate();form.elements.time.value=c.followupTime||'';
 $('#reminder-client').textContent=c.name+' · '+c.businessArea;$('#reminder-dialog').showModal();form.elements.action.focus();
}
$('#reminder-form').onsubmit=e=>{
 e.preventDefault();if(readOnly)return;const form=e.target,c=clients.find(r=>r.id===form.elements.clientId.value);if(!c)return toast('No se encontró la consulta.');
 try{
  const action=form.elements.action.value.trim();if(!action)throw new Error('Escribe qué necesitas recordar.');
  const updated=cleanRecord({...c,nextAction:action,followup:form.elements.date.value,followupTime:form.elements.time.value,followupDoneAt:'',updatedAt:new Date().toISOString()});
  const mode=e.submitter?.value||'save';const content=mode==='ics'?makeCalendar(updated):mode==='google'?googleCalendarLink(updated):null;
  if(!commit(clients.map(r=>r.id===c.id?updated:r)))return;
  selected=c.id;savedPrompt=null;$('#reminder-dialog').close();render();
  if(mode==='ics'){downloadCalendar(content,'cartera-seguimiento.ics');toast('Seguimiento guardado. Abre el archivo y guarda el evento en tu calendario.');}
  else if(mode==='google'){window.open(content,'_blank','noopener,noreferrer');toast('Seguimiento guardado. Revisa la cuenta, el aviso y guarda el evento en Google.');}
  else toast('Seguimiento guardado en Cartera, sin notificación externa.');
 }catch(err){toast(err.message);}
};
async function copyField(id){const field=$('#'+id);if(!field.value.trim())return toast('Prepara o escribe el texto primero.');try{await navigator.clipboard.writeText(field.value);toast(['prompt','package-instructions'].includes(id)?'Instrucciones copiadas. Revísalas y pégalas en ChatGPT.':'Mensaje copiado. Pégalo y revísalo en WhatsApp.');}catch{field.focus();field.select();toast('Texto seleccionado. Usa Copiar en tu dispositivo.');}}
$('#new-client').onclick=()=>openForm();
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.openWhatsapp){
  const c=current();if(!c)return;const text=$('#reply')?.value||c.draft;
  try{const link=whatsappLink(c.phone,text);if(!flushDraft())return;window.open(link,'_blank','noopener,noreferrer');}
  catch(err){toast(err.message);if(!c.phone||/país|WhatsApp válido/.test(err.message))openForm(c,'phone');else setDetailPanel('message');}return;
 }
 if(b.id==='edit-last-message'){if(!flushDraft())return;const c=current();if(!c)return;$('#last-message-text').value=c.lastMessage;$('#last-message-client').textContent=c.name;$('#last-message-dialog').showModal();return;}
 if(b.dataset.openPackage){openClientPackage();return;}
 if(b.id==='package-open-chatgpt'){window.open('https://chatgpt.com/','_blank','noopener,noreferrer');return;}
 if(b.id==='copy-package-instructions'){copyField('package-instructions');return;}
 if(b.dataset.openStyle){openWritingProfile();return;}
 if(b.id==='add-writing-example'){if(writingExamples.length<5){writingExamples.push('');renderWritingExamples();$('#writing-example-list').lastElementChild.querySelector('textarea').focus();}return;}
 if(b.dataset.removeWriting!==undefined){writingExamples.splice(Number(b.dataset.removeWriting),1);renderWritingExamples();return;}
 if(b.id==='open-chatgpt'){window.open('https://chatgpt.com/','_blank','noopener,noreferrer');return;}
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(b.dataset.reminder){openReminder(b.dataset.reminder,b.dataset.document);return;}
 if(b.id==='dismiss-reminder'){savedPrompt=null;if(flushDraft())render();return;}
 if(b.dataset.panel){if(!flushDraft())return;setDetailPanel(b.dataset.panel);return;}
 if(b.dataset.view){if(!flushDraft())return;stat=b.dataset.view;selected=null;businessArea='all';$('#search').value='';$('#filter-status').value='';$('#filter-intent').value='';document.querySelectorAll('[data-area]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.area==='all')));render();return;}
 if(b.dataset.select){if(!flushDraft())return;detailPanel='summary';selected=b.dataset.select;render();if(matchMedia('(max-width:760px)').matches)$('#detail').scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(b.dataset.area){if(!flushDraft())return;businessArea=b.dataset.area;stat='all';selected=null;$('#filter-status').value='';$('#filter-intent').value='';$('#search').value='';document.querySelectorAll('[data-area]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===b)));render();return;}
 if(b.dataset.stat){if(!flushDraft())return;stat=b.dataset.stat;$('#filter-status').value='';$('#filter-intent').value='';$('#search').value='';render();$('#client-list').scrollIntoView({block:'nearest'});return;}
 if(b.dataset.removeDoc!==undefined){formDocuments.splice(Number(b.dataset.removeDoc),1);docEditor();return;}
 if(b.id==='add-document'){if(formDocuments.length>=100)return toast('Máximo 100 documentos por consulta.');formDocuments.push({id:crypto.randomUUID(),name:'',status:'Faltante',notes:''});docEditor();$('#document-editor').lastElementChild.querySelector('input').focus();return;}
 if(b.id==='test-reminder'){const test=calendarTest();downloadCalendar(test.content,'cartera-prueba.ics');toast('Prueba para las '+test.when.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+'. Abre el archivo con Calendario y guarda el evento con su aviso.');return;}
 if(b.id==='download-calendar'){const c=current();if(!c||!flushDraft())return;try{downloadCalendar(makeCalendar(c),'cartera-seguimiento.ics');toast('Abre el archivo con Calendario y confirma el evento y su aviso.');}catch(err){toast(err.message);}return;}
 if(b.id==='google-calendar'){const c=current();if(!c)return;try{const link=googleCalendarLink(c);window.open(link,'_blank','noopener,noreferrer');}catch(err){toast(err.message);}return;}
 if(b.id==='toggle-done'){if(readOnly||!flushDraft())return;const c=current();if(!c)return;const done=c.followupDoneAt?'':new Date().toISOString();if(commit(clients.map(r=>r.id===c.id?{...r,followupDoneAt:done,updatedAt:new Date().toISOString()}:r))){render();toast(done?'Seguimiento hecho en Cartera. El evento del calendario no se modifica.':'Seguimiento marcado como pendiente.');}return;}
 if(b.id==='empty-new')openForm();
 if(['edit-client','followup-edit','followup-edit-bottom','edit-documents','edit-simulation'].includes(b.id))openForm(current(),b.id==='edit-documents'?'documents':b.id==='edit-simulation'?'simulationStatus':b.id.startsWith('followup')?'nextAction':'name');
 if(b.id==='back-list'){if(!flushDraft())return;selected=null;render();}
 if(b.id==='generate'){const c=current();if(!c||readOnly)return;if($('#reply').value.trim()&&!confirm('¿Reemplazar el borrador actual por la plantilla?'))return;$('#reply').value=prepareReply(c,$('#original').value,$('#template').value,$('#tone').value,writingProfile);flushDraft();}
 if(b.id==='copy'){flushDraft();copyField('reply');}
 if(b.id==='generate-prompt'){const c=current();if(c)$('#prompt').value=preparePrompt(c,$('#original').value,$('#template').value,$('#tone').value,writingProfile);}
 if(b.id==='correct-in-app'){runCorrection();return;}
 if(b.id==='ai-settings'){openAISettings();return;}
 if(b.id==='ai-forget'){try{localStorage.removeItem(AI_KEY);$('#ai-key').value='';$('#ai-key-state').textContent='Sin clave guardada.';toast('Clave eliminada de este navegador.');}catch{toast('No se pudo eliminar la clave.');}return;}
 if(b.id==='ai-accept'){
  const p=aiProposal,c=current();if(!p||!c||c.id!==p.clientId||$('#reply')?.value!==p.original||c.draft!==p.original){toast('El borrador o el cliente cambió. Conserva la propuesta copiándola antes de cerrar.');return;}
  const next=clients.map(r=>r.id===p.clientId?{...r,draft:$('#ai-proposal').value,updatedAt:new Date().toISOString()}:r);
  if(!commit(next))return;$('#reply').value=$('#ai-proposal').value;$('#draft-state').textContent='Borrador corregido y guardado en este dispositivo';$('#ai-review-dialog').close();aiProposal=null;toast('Propuesta guardada. Revísala antes de enviar.');return;
 }
 if(b.id==='ai-discard'){aiProposal=null;$('#ai-review-dialog').close();return;}
 if(b.id==='revise-message'){const c=current();if(!c)return;try{const prompt=prepareRevision(c,$('#reply').value,[...document.querySelectorAll('[data-adjustment]:checked')].map(el=>el.dataset.adjustment),$('#revision-extra').value,writingProfile);if(!flushDraft())return;$('#prompt').value=prompt;$('#prompt').closest('details').open=true;$('#prompt').focus();toast('Corrección preparada. Copia las instrucciones en ChatGPT y pega su respuesta en el borrador.');}catch(err){toast(err.message);}return;}
 if(b.id==='copy-prompt')copyField('prompt');
 if(b.id==='delete-client'){const c=current();if(c&&globalThis.indexedDB){try{if((await listFiles(c.id)).length){toast('Esta ficha tiene archivos guardados. Descárgalos y elimínalos en Documentos antes de eliminar al cliente.');return;}}catch(err){toast(err.message);return;}}if(!readOnly&&c&&confirm('¿Eliminar la consulta de '+c.name+'? Solo podrás recuperarla desde un respaldo previo.')){clearTimeout(draftTimer);if(commit(clients.filter(r=>r.id!==c.id))){contexts.delete(c.id);selected=null;render();toast('Consulta eliminada.');}}}
});
document.addEventListener('change',e=>{
 const key=e.target.dataset.adjustment;if(!key||!e.target.checked)return;
 const opposite={closer:'formal',formal:'closer',emojis:'noEmojis',noEmojis:'emojis',brief:'detail',detail:'brief'}[key];
 if(opposite)document.querySelector(`[data-adjustment="${opposite}"]`).checked=false;
});
document.addEventListener('input',e=>{
 if(e.target.dataset.writingExample!==undefined)writingExamples[Number(e.target.dataset.writingExample)]=e.target.value;
 const row=e.target.closest('[data-doc-index]');if(row&&e.target.dataset.docField)formDocuments[Number(row.dataset.docIndex)][e.target.dataset.docField]=e.target.value;
 if(e.target.id==='reply'){clearTimeout(draftTimer);$('#draft-state').textContent='Guardando…';draftTimer=setTimeout(flushDraft,500);}
});
document.addEventListener('change',e=>{
 if(e.target.name==='businessArea')showLeasingFields();
 const row=e.target.closest('[data-doc-index]');if(row&&e.target.dataset.docField)formDocuments[Number(row.dataset.docIndex)][e.target.dataset.docField]=e.target.value;
 if(['template','tone'].includes(e.target.id))saveContext();
});
$('#client-form').addEventListener('invalid',e=>revealField(e.target),true);
$('#client-form').onsubmit=e=>{
 e.preventDefault();const form=e.target,raw=Object.fromEntries(new FormData(form));raw.name=raw.name.trim();const old=clients.find(c=>c.id===raw.id);
 try{const c=cleanRecord({...old,...raw,id:old?.id||crypto.randomUUID(),draft:old?.draft||'',documents:formDocuments,followupDoneAt:old&&old.followup===raw.followup&&old.followupTime===(raw.followupTime||'')&&old.nextAction===raw.nextAction?old.followupDoneAt:'',createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});if(commit(old?clients.map(r=>r.id===c.id?c:r):[...clients,c])){selected=c.id;if(businessArea!=='all'&&businessArea!==c.businessArea)businessArea=c.businessArea;stat='all';$('#search').value='';$('#filter-status').value='';$('#filter-intent').value='';document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===businessArea)));savedPrompt={id:c.id,context:formContext};$('#client-dialog').close();detailPanel=formContext==='documents'?'documents':formContext==='simulation'?'simulation':'summary';render();toast('Cliente guardado.');if(matchMedia('(max-width:760px)').matches)$('#detail').scrollIntoView({block:'start'});}}catch(err){toast(err.message);}
};
for(const id of ['search','filter-status','filter-intent'])$('#'+id).addEventListener(id==='search'?'input':'change',()=>{if(!flushDraft())return;stat='all';render();});
$('#demo').onclick=()=>{
 if(readOnly||!flushDraft())return;const now=new Date().toISOString(),base={createdAt:now,updatedAt:now,status:'Nuevo',followup:localDate()};
 const examples=[cleanRecord({...base,id:'demo-cartera-leasing',name:'Carolina · ejemplo ficticio',intent:'Comprar',businessArea:'Leasing',source:'Referido',status:'Papeles en curso',nextAction:'Solicitar el antecedente que falta y consultar a la entidad',simulationStatus:'Esperando respuesta',simulationEntity:'Entidad de ejemplo',documents:[{id:'doc-example-1',name:'Antecedente de ejemplo A (editar)',status:'Recibido',notes:''},{id:'doc-example-2',name:'Antecedente de ejemplo B (editar)',status:'Faltante',notes:'Estos nombres son ficticios, no requisitos reales.'}]}),cleanRecord({...base,id:'demo-cartera-dataprop',name:'Ana · ejemplo ficticio',intent:'Arrendar',businessArea:'Corretaje',source:'Dataprop',area:'Ñuñoa',kind:'Departamento',budget:'Hasta $600.000 mensuales',property:'DEP-EJEMPLO',nextAction:'Presentarse y confirmar qué información necesita',notes:'Ejemplo ficticio. Confirma la autorización para contactar y los datos reales antes de enviar.'})];
 const next=[...clients];for(const c of examples)if(!next.some(r=>r.id===c.id))next.push(c);if(commit(next)){businessArea='all';stat='all';$('#search').value='';$('#filter-status').value='';$('#filter-intent').value='';document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area==='all')));selected=examples[0].id;render();}
};
$('#backup-open').onclick=()=>{if(!flushDraft())return;let last;try{last=localStorage.getItem('cartera-last-backup');}catch{}$('#last-backup').textContent=last?'Última exportación: '+new Date(last).toLocaleString('es-CL'):'Aún no has exportado un respaldo.';$('#backup-dialog').showModal();};
let packageDownloadUrls=[];
function clearPackageDownloads(){for(const url of packageDownloadUrls)URL.revokeObjectURL(url);packageDownloadUrls=[];$('#package-download-list').replaceChildren();}
$('#export').onclick=async()=>{
 const button=$('#export');if(button.disabled)return;button.disabled=true;
 try{
  const saved=flushDraft(),field=$('#reply');const data=!saved&&field?clients.map(c=>c.id===selected?{...c,draft:field.value,updatedAt:new Date().toISOString()}:c):clients;
  const base={...envelope(data),session:captureSession(data)};
  const blobs=await exportFilePackages(base,$('#export-files').checked);clearPackageDownloads();const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  for(let i=0;i<blobs.length;i++){
   const url=URL.createObjectURL(blobs[i]);packageDownloadUrls.push(url);const a=document.createElement('a');a.href=url;a.download='carterita-paquete-'+stamp+(blobs.length>1?'-parte-'+(i+1)+'-de-'+blobs.length:'')+'.json';a.className='secondary';a.textContent='Descargar '+(blobs.length>1?'parte '+(i+1)+' de '+blobs.length:'paquete')+' ('+(blobs[i].size/1024/1024).toFixed(1)+' MB)';$('#package-download-list').append(a);
  }
  if(blobs.length===1){$('#package-download-list a').click();toast('Paquete preparado. Comprueba su descarga.');}
  else toast('Paquete dividido en '+blobs.length+' partes. Descarga cada una desde los enlaces de abajo.');
  $('#package-download-help').textContent=blobs.length>1?'Descarga TODAS las partes. En el otro dispositivo, carga y confirma cada archivo, uno por uno. Las fichas no se duplican; cada parte añade sus documentos.':'El enlace permite descargar de nuevo sin volver a preparar el paquete. Comprueba el archivo en Descargas.';
  try{localStorage.setItem('cartera-last-backup',new Date().toISOString());}catch{}
  $('#last-backup').textContent='Paquete preparado. Comprueba que descargaste '+(blobs.length>1?'todas las partes.':'el archivo.');
 }catch(err){toast('No se pudo exportar: '+err.message);}finally{button.disabled=false;}
};

$('#import').onchange=async e=>{if(importingFiles)return;const generation=++importGeneration;incoming=null;incomingProfile=null;incomingSession=null;incomingFiles=[];$('#import-preview').replaceChildren();const file=e.target.files[0];if(!file)return;try{if(file.size>80*1024*1024)throw new Error('El respaldo supera el máximo de 80 MB.');const backupText=await file.text();if(generation!==importGeneration)return;const records=parseBackup(backupText),profile=writingProfileFromBackup(backupText),session=sessionFromBackup(backupText),files=await filesFromPackage(JSON.parse(backupText));if(generation!==importGeneration)return;incoming=records;incomingProfile=profile;incomingSession=session;incomingFiles=files;const old=new Map(clients.map(c=>[c.id,c]));const adds=incoming.filter(c=>!old.has(c.id)).length,updates=incoming.filter(c=>old.has(c.id)&&Date.parse(c.updatedAt)>Date.parse(old.get(c.id).updatedAt)).length;$('#import-preview').innerHTML=`<div class="import-summary"><strong>${adds} nuevas · ${updates} actualizadas</strong><p class="small">Las demás consultas existentes se conservarán. ${incomingFiles.length} archivo(s) adjunto(s) para guardar en sus fichas.</p><ul>${incoming.slice(0,15).map(c=>`<li>${esc(c.name)} · ${esc(c.businessArea)}</li>`).join('')}</ul>${incomingProfile?'<label class="profile-import-choice"><input type="checkbox" id="import-writing-profile" checked> Recuperar también el perfil de escritura (reemplaza el actual)</label>':''}${incomingSession?'<label class="profile-import-choice"><input type="checkbox" id="import-session" checked> Recuperar también mensajes en preparación y pantalla abierta</label>':''}<p class="small muted">Al confirmar se guardará en este navegador. No se copiará ninguna clave API ni se borrarán clientes ausentes del paquete.</p><button class="primary" id="confirm-import">Cargar y guardar paquete</button></div>`;}catch(err){if(generation!==importGeneration)return;incoming=null;incomingProfile=null;incomingSession=null;incomingFiles=[];$('#import-preview').replaceChildren();toast('No se pudo importar: '+err.message);}};
let importingFiles=false,importGeneration=0;
$('#import-preview').onclick=async e=>{
 if(e.target.id!=='confirm-import'||!incoming||importingFiles)return;if(!readOnly&&!flushDraft())return;
 if(readOnly&&!confirm('El almacenamiento no pudo leerse. ¿Reemplazarlo por este respaldo? Los datos ilegibles podrían perderse.'))return;
 importingFiles=true;e.target.disabled=true;$('#import').disabled=true;let added=[];
 try{
  if(incomingFiles.length)added=await saveFiles(incomingFiles);
  if(!commit(mergeRecords(clients,incoming),true,$('#import-writing-profile')?.checked&&incomingProfile?incomingProfile:writingProfile,$('#import-session')?.checked?incomingSession:undefined)){if(added.length)await removeFiles(added);return;}
  readOnly=false;const session=$('#import-session')?.checked?incomingSession:null;incoming=null;incomingProfile=null;incomingSession=null;incomingFiles=[];$('#import-preview').textContent='Paquete y archivos cargados y guardados en este navegador.';$('#import').value='';if(session)restoreSession(session);else render();toast('Paquete guardado. Ya puedes seguir trabajando aquí.');
 }catch(err){toast('No se pudo cargar el paquete: '+err.message);}finally{importingFiles=false;e.target.disabled=false;$('#import').disabled=false;}
};

function openClientPackage(){
 if(readOnly||!flushDraft())return;$('#package-reference').value=localDate();$('#package-instructions').value=clientPackagePrompt(localDate());$('#package-dialog').showModal();
}
$('#package-reference').onchange=()=>{try{$('#package-instructions').value=clientPackagePrompt($('#package-reference').value);$('#package-error').textContent='';}catch(err){$('#package-error').textContent=err.message;}};
function packageOptions(values,value){return values.map(s=>`<option value="${esc(s)}" ${s===value?'selected':''}>${esc(s||'Por confirmar')}</option>`).join('');}
const packageLabels={name:'Nombre o alias',phone:'WhatsApp',email:'Correo',businessArea:'Área de trabajo',source:'Origen',intent:'Qué busca',area:'Comuna',kind:'Tipo de propiedad',budget:'Presupuesto / precio',property:'Propiedad o código',status:'Estado del caso',nextAction:'Próximo paso',followup:'Fecha exacta de contacto',followupTime:'Hora',notes:'Notas y datos por confirmar',lastMessage:'Último mensaje recibido',simulationStatus:'Estado de la simulación',simulationRequestedOn:'Fecha de solicitud',simulationEntity:'Entidad',simulationNotes:'Notas de la simulación'};
const packageEnums={businessArea:AREAS,source:SOURCES,intent:INTENTS,kind:KINDS,status:STATUSES,simulationStatus:SIMULATION_STATUSES};
function packageField(key,data,index){const value=data[key]||'';const attrs=`data-package-field="${key}" data-package-index="${index}"`;let control;if(packageEnums[key])control=`<select ${attrs}>${packageOptions(packageEnums[key],value)}</select>`;else if(['notes','simulationNotes','lastMessage'].includes(key))control=`<textarea ${attrs} rows="3" maxlength="${key==='simulationNotes'?3000:5000}">${esc(value)}</textarea>`;else control=`<input ${attrs} value="${esc(value)}" type="${key==='followup'||key==='simulationRequestedOn'?'date':key==='followupTime'?'time':key==='email'?'email':'text'}" maxlength="${{name:100,phone:30,email:180,area:120,budget:100,property:180,nextAction:500,simulationEntity:150}[key]||500}" ${key==='name'?'required':''}>`;return `<label>${packageLabels[key]}${control}</label>`;}
function packageMatches(index){const entry=packageEntries[index];return clientMatches(entry.data,clients);}
function packageDecisionHtml(index){const entry=packageEntries[index],matches=packageMatches(index);return `<option value="review" ${entry.choice==='review'?'selected':''}>Revisar coincidencia antes de continuar</option><option value="new" ${entry.choice==='new'?'selected':''}>Crear cliente nuevo</option>${matches.map(m=>`<option value="${esc(m.id)}" ${entry.choice===m.id?'selected':''}>Actualizar ${esc(m.name)} (${esc(m.reasons.join(', '))})</option>`).join('')}<option value="skip" ${entry.choice==='skip'?'selected':''}>No cargar esta entrada</option>`;}
function updatePackageDecision(index){const entry=packageEntries[index],row=$(`[data-package-row="${index}"]`),matches=packageMatches(index),select=row.querySelector('[data-package-choice]');
 if(matches.length&&entry.choice==='new')entry.choice='review';if(!['new','review','skip'].includes(entry.choice)&&!matches.some(m=>m.id===entry.choice))entry.choice=matches.length?'review':'new';
 if(!matches.length&&entry.choice==='review')entry.choice='new';select.innerHTML=packageDecisionHtml(index);row.querySelector('.package-match-note').textContent=matches.length?'Posible coincidencia por '+[...new Set(matches.flatMap(m=>m.reasons))].join(', ')+'. Elige crear, actualizar u omitir.':'No encontramos coincidencias por nombre, teléfono o correo. Revísalo igualmente.';showPackageChanges(index);updatePackageSummary();}
function showPackageChanges(index){const entry=packageEntries[index],row=$(`[data-package-row="${index}"]`),old=clients.find(c=>c.id===entry.choice),target=row.querySelector('.package-existing');
 row.querySelectorAll('[data-package-field],[data-package-doc]').forEach(el=>el.disabled=entry.choice==='skip');
 if(!old){target.hidden=true;target.replaceChildren();return;}
 const changes=entry.providedFields.filter(k=>k!=='documents'&&entry.data[k]&&entry.data[k]!==old[k]);target.hidden=false;target.innerHTML=`<summary>Ver lo que cambiará en la ficha existente</summary><ul>${changes.map(k=>`<li><strong>${esc(packageLabels[k]||k)}</strong><br>Actual: ${esc(old[k]||'Sin dato')}<br>Paquete: ${esc(entry.data[k])}${['notes','simulationNotes'].includes(k)?' (se añade sin borrar lo anterior)':''}</li>`).join('')}</ul><p class="small muted">Los documentos se combinan por nombre; si ya existen, cambia su estado y se conserva su observación cuando el paquete no aporta otra.</p>`;
}
function updatePackageSummary(){const counts={new:0,skip:0,review:0,update:0};for(const e of packageEntries)counts[['new','skip','review'].includes(e.choice)?e.choice:'update']++;$('#package-summary').textContent=`${counts.new} nuevos · ${counts.update} actualizaciones · ${counts.skip} omitidos${counts.review?' · '+counts.review+' por revisar':''}`;$('#save-package').disabled=readOnly||Boolean(counts.review)||counts.new+counts.update===0;}
function renderPackagePreview(){
 $('#package-review-form').hidden=!packageEntries.length;$('#package-preview').innerHTML=packageEntries.map((entry,index)=>`<article class="package-card" data-package-row="${index}"><h3>${index+1}. <span class="package-name">${esc(entry.data.name)}</span></h3><p class="package-match-note small"></p><label>Qué hacer con esta entrada<select data-package-choice="${index}">${packageDecisionHtml(index)}</select></label>${entry.warnings.length?`<p class="missing">La IA dejó por confirmar: ${esc(entry.warnings.join(' · '))}</p>`:''}<p class="small"><strong>Próximo paso:</strong> <span class="package-next">${esc(entry.data.nextAction||'Por definir')}</span></p><details class="form-group"><summary>Ver y corregir los datos</summary>${['name','phone','email','businessArea','source','intent','area','kind','budget','property','status','nextAction','followup','followupTime','lastMessage','notes'].map(k=>packageField(k,entry.data,index)).join('')}<details class="form-group"><summary>Simulación y documentos de Leasing</summary>${['simulationStatus','simulationRequestedOn','simulationEntity','simulationNotes'].map(k=>packageField(k,entry.data,index)).join('')}${entry.data.documents.map((doc,j)=>`<div class="package-document"><label>Documento<input data-package-index="${index}" data-package-doc="${j}" data-doc-key="name" value="${esc(doc.name)}" maxlength="160" required></label><label>Estado<select data-package-index="${index}" data-package-doc="${j}" data-doc-key="status">${packageOptions(DOCUMENT_STATUSES,doc.status)}</select></label><label>Observación<input data-package-index="${index}" data-package-doc="${j}" data-doc-key="notes" value="${esc(doc.notes)}" maxlength="500"></label></div>`).join('')}</details></details><details class="package-existing form-group" hidden></details></article>`).join('');
 packageEntries.forEach((_,i)=>updatePackageDecision(i));$('#package-help').open=false;updatePackageSummary();
}
$('#preview-package').onclick=()=>{
 packageEntries=[];$('#package-preview').replaceChildren();$('#package-review-form').hidden=true;$('#package-error').textContent='';
 try{packageEntries=parseClientPackage($('#package-text').value).map(entry=>({...entry,choice:clientMatches(entry.data,clients).length?'review':'new'}));renderPackagePreview();if(!packageEntries.length)$('#package-error').textContent='El paquete no contiene clientes. Pide a ChatGPT que revise tus notas.';else $('#package-review-form').scrollIntoView({block:'start'});}catch(err){$('#package-error').textContent=err.message;}
};
$('#package-text').addEventListener('input',()=>{if(packageEntries.length){packageEntries=[];$('#package-preview').replaceChildren();$('#package-review-form').hidden=true;$('#package-error').textContent='El paquete cambió. Pulsa Revisar antes de guardar otra vez.';}});
$('#package-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('El paquete supera los 2 MB.');$('#package-text').value=await file.text();$('#preview-package').click();}catch(err){packageEntries=[];$('#package-review-form').hidden=true;$('#package-preview').replaceChildren();$('#package-error').textContent=err.message;}};
function editPackageField(e){const el=e.target;if(el.dataset.packageIndex===undefined)return;const index=Number(el.dataset.packageIndex),entry=packageEntries[index];if(!entry)return;
 if(el.dataset.packageDoc!==undefined){entry.data.documents[Number(el.dataset.packageDoc)][el.dataset.docKey]=el.value;return;}
 const key=el.dataset.packageField;if(!key)return;entry.data[key]=el.value;if(!entry.providedFields.includes(key))entry.providedFields.push(key);
 const row=el.closest('[data-package-row]');if(key==='name')row.querySelector('.package-name').textContent=el.value;if(key==='nextAction')row.querySelector('.package-next').textContent=el.value||'Por definir';if(e.type==='change'&&['name','phone','email'].includes(key))updatePackageDecision(index);else showPackageChanges(index);
}
$('#package-preview').addEventListener('input',editPackageField);$('#package-preview').addEventListener('change',e=>{if(e.target.dataset.packageChoice!==undefined){const i=Number(e.target.dataset.packageChoice);packageEntries[i].choice=e.target.value;showPackageChanges(i);updatePackageSummary();}else editPackageField(e);});
$('#package-review-form').addEventListener('invalid',e=>revealField(e.target),true);
$('#package-review-form').onsubmit=e=>{
 e.preventDefault();if(readOnly||!flushDraft())return;
 try{
  const decisions=packageEntries.map(entry=>({entry,choice:entry.choice}));const additions=decisions.filter(d=>d.choice==='new');
  const repeated=additions.filter((d,i)=>clientMatches(d.entry.data,clients).length||clientMatches(d.entry.data,additions.slice(0,i).map(x=>x.entry.data)).length);
  if(repeated.length&&!confirm('Hay '+repeated.length+' ficha(s) nuevas con posibles coincidencias. ¿Crear igualmente como clientes separados?'))return;
  const next=applyClientPackage(clients,decisions);if(!commit(next))return;
  packageEntries=[];$('#package-review-form').hidden=true;$('#package-preview').replaceChildren();$('#package-text').value='';$('#package-file').value='';$('#package-dialog').close();selected=null;stat='all';businessArea='all';$('#search').value='';$('#filter-status').value='';$('#filter-intent').value='';document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area==='all')));render();toast('Fichas guardadas. Puedes abrirlas para confirmar lo que falta.');
 }catch(err){$('#package-error').textContent=err.message;$('#package-error').scrollIntoView({block:'nearest'});}
};
function saveSessionLocally(){if(!readOnly&&flushDraft())commit(clients);}
window.addEventListener('pagehide',saveSessionLocally);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveSessionLocally();});
window.addEventListener('storage',e=>{if(e.key===KEY){readOnly=true;toast('Los datos cambiaron en otra pestaña. Recarga antes de seguir editando.');document.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);}});
render();
try{const raw=localStorage.getItem(KEY);const session=raw?sessionFromBackup(raw):null;if(session)restoreSession(session);}catch{toast('No se pudo recuperar la pantalla anterior. Tus fichas siguen disponibles.');}

function openAISettings(){
 $('#ai-key').value='';try{$('#ai-key-state').textContent=localStorage.getItem(AI_KEY)?'Ya hay una clave guardada. Déjalo vacío para conservarla.':'Todavía no hay una clave guardada.';}catch{$('#ai-key-state').textContent='El almacenamiento no está disponible.';}
 $('#ai-settings-dialog').showModal();
}
$('#ai-settings-form').onsubmit=e=>{e.preventDefault();const key=$('#ai-key').value.trim();try{if(key){if(!key.startsWith('sk-')||key.length<20)throw new Error('Revisa la clave de la plataforma API de OpenAI.');localStorage.setItem(AI_KEY,key);}else if(!localStorage.getItem(AI_KEY))throw new Error('Introduce tu clave de OpenAI.');$('#ai-key').value='';$('#ai-settings-dialog').close();toast('IA configurada. Vuelve al mensaje y pulsa Corregir aquí con IA.');}catch(err){toast(err.message);}};
async function runCorrection(){
 if(aiBusy||readOnly)return;const c=current();if(!c)return;
 let key,prompt,original,attempt;
 try{
  key=localStorage.getItem(AI_KEY);if(!key){openAISettings();return;}
  if(navigator.onLine===false)throw new Error('Necesitas conexión para corregir con OpenAI. Puedes editar a mano sin internet.');
  original=$('#reply').value;if(original.length>4000)throw new Error('Para esta corrección, acorta el borrador a 4.000 caracteres como máximo.');
  const profile={...writingProfile,preferences:writingProfile.preferences.slice(0,800),examples:[]};
  const reference={...c,lastMessage:'',notes:'',phone:'',email:'',name:'',documents:c.documents.slice(0,10)};
  prompt=prepareRevision(reference,original,[...document.querySelectorAll('[data-adjustment]:checked')].map(el=>el.dataset.adjustment),$('#revision-extra').value,profile);
  if(prompt.length>14000)throw new Error('Acorta el borrador o las indicaciones para corregirlo.');
  if(!flushDraft())return;attempt=reserveCorrection(localStorage,localDate());
 }catch(err){toast(err.message);return;}
 aiBusy=true;const button=$('#correct-in-app'),progress=$('#ai-progress');button.disabled=true;progress.textContent=`Corrigiendo… Intento ${attempt} de 20 hoy. Una petición, sin reintentos automáticos.`;
 try{
  const text=await correctMessage({key,prompt});aiProposal={clientId:c.id,original};
  $('#ai-original').textContent=original;$('#ai-proposal').value=text;$('#ai-review-dialog').showModal();
 }catch(err){toast(err.message);}
 finally{aiBusy=false;button.disabled=false;progress.textContent='';}
}

function captureSession(data=clients){
 saveContext();const raw={app:'cartera',version:7,clients:data,session:{selected,panel:detailPanel,composers:[...contexts].map(([id,value])=>({id,...value})),proposal:aiProposal?{...aiProposal,text:$('#ai-proposal').value}:null}};
 return sessionFromBackup(JSON.stringify(raw));
}
function restoreSession(session){
 for(const context of session.composers)if(clients.some(c=>c.id===context.id))contexts.set(context.id,context);
 selected=session.selected;detailPanel=session.panel;stat='all';businessArea='all';$('#search').value='';$('#filter-status').value='';$('#filter-intent').value='';document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area==='all')));render();
 const p=session.proposal;if(p&&clients.some(c=>c.id===p.clientId&&c.draft===p.original)){aiProposal={clientId:p.clientId,original:p.original};$('#ai-original').textContent=p.original;$('#ai-proposal').value=p.text;selected=p.clientId;detailPanel='message';render();$('#ai-review-dialog').showModal();}
}
