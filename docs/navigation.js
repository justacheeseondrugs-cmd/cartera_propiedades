const paths={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3z',clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',mic:'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',calendar:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',settings:'M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M9 15v6',chat:'M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z',download:'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',pen:'m16 3 5 5-12 12-6 1 1-6zM14 5l5 5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6z',plus:'M12 4v16M4 12h16',voice:'M11 5 6 9H2v6h4l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14'};
export function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.settings}"/></svg>`;}
export function initNavigation({getState}){
 const $=s=>document.querySelector(s);let active='today';
 const navHTML=()=>[['today','home','Hoy'],['clients','clients','Clientes'],['talk','mic','Hablar'],['agenda','calendar','Agenda'],['settings','settings','Ajustes']].map(([key,glyph,label])=>`<button type="button" data-app-tab="${key}" ${key==='talk'?'class="nav-talk"':''} aria-label="${label}" aria-pressed="false"><span class="nav-icon">${icon(glyph)}</span><span>${label}</span></button>`).join('');
 for(const parent of [document.body,$('#calendar-dialog'),$('#assistant-dialog'),$('#app-settings-dialog')]){const nav=document.createElement('nav');nav.className='bottom-nav';nav.setAttribute('aria-label','Navegación principal');nav.innerHTML=navHTML();parent.append(nav);}
 function paint(tab){active=tab;document.querySelectorAll('[data-app-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.appTab===tab)));}
 function closeScreens(){for(const id of ['calendar-dialog','assistant-dialog','app-settings-dialog'])if($('#'+id).open)$('#'+id).close();}
 function navigate(tab){
  closeScreens();
  if(tab==='today'||tab==='clients'){document.querySelector(`.main-nav [data-view="${tab==='today'?'today':'all'}"]`).click();window.scrollTo?.({top:0,behavior:'auto'});refresh();return;}
  if(tab==='agenda')$('#calendar-open').click();
  if(tab==='talk')$('#assistant-open').click();
  if(tab==='settings'){updateSettings();$('#app-settings-dialog').showModal();}
  paint(tab);
 }
 function updateSettings(){let last;try{last=localStorage.getItem('carterita-confirmed-backup');}catch{}$('#settings-backup-age').textContent=last?'Último respaldo: '+new Date(last).toLocaleDateString('es-CL'):'Todavía no hay un respaldo confirmado';}
 function refresh(){const state=getState();$('#floating-add-client').disabled=$('#new-client').disabled;document.body.classList.toggle('showing-client',Boolean(state.selected));$('#daily-count').textContent=state.today;$('#daily-documents').textContent=state.documents+' con documentos pendientes';$('#daily-simulations').textContent=state.simulations+' simulación(es) en espera';$('#daily-word').textContent=state.today===1?'por contactar hoy':'por contactar hoy';const topDialog=['calendar-dialog','assistant-dialog','app-settings-dialog'].find(id=>$('#'+id).open);paint(topDialog?({'calendar-dialog':'agenda','assistant-dialog':'talk','app-settings-dialog':'settings'}[topDialog]):state.selected?'clients':state.view==='today'?'today':'clients');}
 document.addEventListener('carterita-render',refresh);
 document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.appTab){navigate(button.dataset.appTab);return;}
  if(button.id==='floating-add-client'){$('#new-client').click();return;}
  if(button.id==='header-settings'){navigate('settings');return;}
  if(button.dataset.settingsAction){
   const action=button.dataset.settingsAction;$('#app-settings-dialog').close();
   if(action==='voice'){navigate('talk');for(const detail of $('#assistant-dialog').querySelectorAll('details'))if(detail.querySelector('#assistant-voice'))detail.open=true;$('#assistant-voice').scrollIntoView({block:'center'});return;}
   const target=action==='package'?document.querySelector('[data-open-package]'):action==='style'?document.querySelector('[data-open-style]'):document.getElementById(action);target?.click();
  }
  if(button.dataset.assistantSuggestion){$('#assistant-input').value=button.dataset.assistantSuggestion;$('#assistant-input').dispatchEvent(new Event('input',{bubbles:true}));$('#assistant-input').focus();}
 });
 for(const id of ['calendar-dialog','assistant-dialog','app-settings-dialog'])$('#'+id).addEventListener('close',refresh);
 $('#calendar-open').addEventListener('click',()=>paint('agenda'));$('#assistant-open').addEventListener('click',()=>paint('talk'));
 const list=$('.list-panel'),title=$('.list-title');for(const node of [$('.area-tabs'),$('#search'),$('.advanced-filters')])list.insertBefore(node,title);list.append($('.advanced-filters'));$('#active-filter').classList.add('sr');$('.area-tabs button[data-area=Corretaje]').textContent='Corretaje';
 $('#settings-font').onclick=()=>{const large=!document.documentElement.classList.contains('large-type');document.documentElement.classList.toggle('large-type',large);$('#settings-font-state').textContent=large?'Grande':'Normal';try{localStorage.setItem('carterita-font-size',large?'large':'normal');}catch{}};
 try{const large=localStorage.getItem('carterita-font-size')==='large';document.documentElement.classList.toggle('large-type',large);$('#settings-font-state').textContent=large?'Grande':'Normal';}catch{}
 $('#header-settings').innerHTML=icon('settings');$('#floating-add-client').innerHTML=icon('plus');
 const suggestions=document.createElement('div');suggestions.className='assistant-suggestions';for(const text of ['¿A quién contacto hoy?','Ayúdame a preparar un seguimiento','Quiero anotar un pendiente']){const b=document.createElement('button');b.type='button';b.className='quiet';b.dataset.assistantSuggestion=text;b.textContent=text;suggestions.append(b);}$('.assistant-chat-toolbar').after(suggestions);const voiceOptions=document.createElement('details');voiceOptions.className='form-group voice-entry-settings';voiceOptions.innerHTML='<summary>Opciones de entrada por voz</summary>';voiceOptions.append($('.voice-mode-controls'));$('#assistant-chat-form').after(voiceOptions);const context=$('#assistant-context').closest('details');context.append($('.assistant-chat-toolbar'));
 const section=$('#app-settings-dialog');for(const span of section.querySelectorAll('[data-setting-icon]'))span.innerHTML=icon(span.dataset.settingIcon);
 refresh();return {refresh,navigate};
}
