const CACHE='cartera-shell-v27';
const ASSETS=['./','./index.html','./style.css','./app.js','./assistant.js','./voice-input.js','./calendar-sync.js','./calendar-setup.html','./push.js','./bootstrap.js','./privacy.js','./device-lock.js','./pwa.js','./core.js','./ai.js','./attachments.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
const SCOPE=new URL(self.registration.scope);
self.addEventListener('install',event=>{
 // Keep an entire version together; never reuse stale HTTP-cache assets.
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(new URL(path,SCOPE),{cache:'reload'})))));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cartera-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
 const asset=ASSETS.some(path=>new URL(path,SCOPE).pathname===url.pathname);
 if(event.request.mode!=='navigate'&&!asset)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Versioned shell remains consistent until the user accepts an update.
  const cached=await cache.match(event.request.mode==='navigate'?new URL('./index.html',SCOPE).href:event.request,{ignoreSearch:true});
  if(cached)return cached;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{const response=await fetch(event.request,{signal:controller.signal});if(response.ok)return response;return new Response('No se pudo cargar Cartera. Vuelve a abrirla con internet.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  catch{return new Response('Sin conexión. Visita Cartera con internet una vez para preparar el uso offline.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  finally{clearTimeout(timer);}
 })());
});

self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 const id=typeof payload.clientId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(payload.clientId)?payload.clientId:'';
 event.waitUntil((async()=>{try{await self.registration.showNotification('Carterita',{
  body:payload.test===true?'Prueba de avisos: Carterita ya puede notificar en este dispositivo.':'Tienes un seguimiento pendiente en Carterita.',
  icon:new URL('./icon-192.png',SCOPE).href,badge:new URL('./icon-192.png',SCOPE).href,
  tag:payload.test===true?'carterita-test':'carterita-followup-'+id,
  data:{clientId:id},renotify:false
 });
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(new URL(client.url).origin===SCOPE.origin&&new URL(client.url).pathname.startsWith(SCOPE.pathname))client.postMessage({type:'CARTERITA_PUSH_SHOWN',test:payload.test===true});
 }catch(err){const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(new URL(client.url).origin===SCOPE.origin&&new URL(client.url).pathname.startsWith(SCOPE.pathname))client.postMessage({type:'CARTERITA_PUSH_SHOW_FAILED'});throw err;}})());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const id=event.notification.data?.clientId;
 const valid=typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id),url=new URL('./',SCOPE);if(valid)url.searchParams.set('followup',id);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const current=windows.find(client=>{const u=new URL(client.url);return u.origin===SCOPE.origin&&u.pathname.startsWith(SCOPE.pathname);});
  if(current){await current.focus();if(valid)current.postMessage({type:'OPEN_FOLLOWUP',clientId:id});return;}
  await self.clients.openWindow(url.href);
 })());
});
