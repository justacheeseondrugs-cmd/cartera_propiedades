const CACHE='cartera-shell-v10';
const ASSETS=['./','./index.html','./style.css','./app.js','./pwa.js','./core.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
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
