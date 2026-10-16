const CACHE='cartera-shell-v25';
const status=document.querySelector('#pwa-state'),installButton=document.querySelector('#install-app'),updateButton=document.querySelector('#update-app');
let installPrompt=null,registration=null,ready=false,updateRequested=false,reloading=false;
const alreadyControlled=Boolean(navigator.serviceWorker?.controller);
function displayState(){
 if(!navigator.onLine)status.textContent=ready?'Sin conexión · puedes trabajar con tus fichas.':'Sin conexión · abre Cartera con internet para prepararla.';
 else status.textContent=ready?'Lista para usar sin conexión.':'Preparando el uso sin conexión…';
}
async function checkReady(){try{const cache=await caches.open(CACHE);const files=['./index.html','./app.js','./assistant.js','./voice-input.js','./calendar-sync.js','./calendar-setup.html','./push.js','./bootstrap.js','./privacy.js','./device-lock.js','./pwa.js','./core.js','./ai.js','./attachments.js','./style.css','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];const found=await Promise.all(files.map(path=>cache.match(new URL(path,location.href))));ready=Boolean(navigator.serviceWorker?.controller&&found.every(Boolean));}catch{ready=false;}displayState();}
function checkUpdate(){updateButton.hidden=!registration?.waiting;}
function hideIfInstalled(){const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;installButton.hidden=installed;}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine){checkUpdate();registration?.update().catch(()=>{});}});
window.addEventListener('online',()=>{checkReady();registration?.update().catch(()=>{});});window.addEventListener('offline',displayState);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.hidden=false;});
window.addEventListener('appinstalled',()=>{installPrompt=null;installButton.hidden=true;});
installButton.addEventListener('click',async()=>{
 if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();const result=await prompt.userChoice;if(result.outcome!=='accepted')installButton.hidden=false;}catch{document.querySelector('#install-dialog').showModal();}}
 else document.querySelector('#install-dialog').showModal();
});
updateButton.addEventListener('click',()=>{if(registration?.waiting){updateRequested=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}});
hideIfInstalled();displayState();
if('serviceWorker' in navigator){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if((alreadyControlled||updateRequested)&&!reloading){reloading=true;location.reload();}else checkReady();});
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{
  registration=reg;checkUpdate();reg.update().catch(()=>{});reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){checkUpdate();checkReady();}});});
  await navigator.serviceWorker.ready;await checkReady();
 }).catch(async()=>{await checkReady();if(!ready&&navigator.onLine)status.textContent='Uso offline no preparado. Revisa la conexión y vuelve a abrir la app.';});
}else status.textContent='Este navegador no permite preparar el uso offline. Prueba Chrome actualizado.';
