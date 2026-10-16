import {lockSettings,authenticateDevice,isAuthenticating} from './device-lock.js';
const screen=document.querySelector('#device-lock-screen'),message=document.querySelector('#device-lock-message'),button=document.querySelector('#device-unlock');
let loaded=false,locked=false,pendingDialogs=[];
function applyLock(){
 if(locked)return;locked=true;document.documentElement.classList.add('device-locked');screen.hidden=false;
 document.querySelector('.shell').inert=true;const dialogs=[...document.querySelectorAll('dialog[open]')];pendingDialogs=dialogs.filter(d=>!['ai-send-dialog','decrypt-dialog'].includes(d.id));for(const d of dialogs)d.close();
 message.textContent='Usa el método que ofrezca tu dispositivo: huella, rostro o PIN.';
}
async function loadApp(){if(!loaded){await import('./app.js');loaded=true;}}
async function unlock(){
 button.disabled=true;try{await authenticateDevice();await loadApp();locked=false;document.documentElement.classList.remove('device-locked');screen.hidden=true;document.querySelector('.shell').inert=false;for(const d of pendingDialogs)if(d.isConnected&&!d.open)d.showModal();pendingDialogs=[];window.dispatchEvent(new Event('carterita-unlocked'));}catch(err){message.textContent=err.message;}finally{button.disabled=false;}
}
button.addEventListener('click',unlock);
window.addEventListener('carterita-lock-now',applyLock);
window.addEventListener('carterita-auth-finished',()=>setTimeout(()=>{if(document.hidden&&!isAuthenticating()){try{if(lockSettings())applyLock();}catch{applyLock();}}},0));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!isAuthenticating()){try{if(lockSettings())queueMicrotask(applyLock);}catch{applyLock();}}});
try{if(lockSettings())applyLock();else{await loadApp();screen.hidden=true;}}catch(err){applyLock();message.textContent=err.message;}
