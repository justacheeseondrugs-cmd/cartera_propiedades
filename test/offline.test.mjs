import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root=new URL('../docs/',import.meta.url),scope='https://example.org/cartera_propiedades/';
async function worker(){
 const cacheName=(await readFile(new URL('sw.js',root),'utf8')).match(/const CACHE='([^']+)'/)[1];
 const listeners={},stores=new Map();let networkCalls=0,skipped=false,claimed=false;
 function key(input){const url=new URL(typeof input==='string'?input:input.url,scope);url.search='';return url.href;}
 const cache={addAll:async requests=>{for(const req of requests){assert.equal(req.cache,'reload');const file=new URL(req.url).pathname.replace('/cartera_propiedades/','')||'index.html';stores.get(cacheName).set(key(req),new Response(await readFile(new URL(file,root))));}},match:async input=>stores.get(cacheName).get(key(input))?.clone()};
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());return cache;},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)};
 const self={registration:{scope},addEventListener:(name,fn)=>{listeners[name]=fn;},skipWaiting:()=>{skipped=true;},clients:{claim:()=>{claimed=true;}}};
 vm.runInNewContext(await readFile(new URL('sw.js',root),'utf8'),{self,caches,Request,Response,URL,AbortController,setTimeout,clearTimeout,fetch:async()=>{networkCalls++;throw new Error('offline');}});
 const lifecycle=async type=>{let promise;listeners[type]({waitUntil:p=>{promise=p;}});await promise;};
 const request=async(path,mode='cors',method='GET')=>{let promise;listeners.fetch({request:{url:new URL(path,scope).href,mode,method},respondWith:p=>{promise=p;}});return promise?await promise:null;};
 return {listeners,stores,lifecycle,request,networkCalls:()=>networkCalls,skipped:()=>skipped,claimed:()=>claimed};
}
test('offline installed shell serves scoped page and required modules without network',async()=>{const w=await worker();await w.lifecycle('install');await w.lifecycle('activate');const page=await w.request('./?source=installed','navigate');assert.equal(page.status,200);assert.match(await page.text(),/Último mensaje recibido/);for(const file of ['app.js','push.js','bootstrap.js','privacy.js','device-lock.js','pwa.js','core.js','ai.js','attachments.js','style.css','manifest.webmanifest','icon-192.png','icon-512.png']){const r=await w.request(file);assert.equal(r.status,200,file);assert.ok((await r.arrayBuffer()).byteLength>0);}assert.equal(w.networkCalls(),0);assert.equal(w.claimed(),true);});
test('worker ignores other projects, external domains and writes',async()=>{const w=await worker();await w.lifecycle('install');assert.equal(await w.request('https://example.org/another-project/app.js'),null);assert.equal(await w.request('https://wa.me/123456789'),null);assert.equal(await w.request('app.js','cors','POST'),null);assert.equal(await w.request('unexpected.json'),null);});
test('updates wait for explicit acceptance and preserve unrelated cache names',async()=>{const w=await worker();w.stores.set('unrelated-app',new Map());w.stores.set('cartera-shell-v8',new Map());await w.lifecycle('install');assert.equal(w.skipped(),false);w.listeners.message({data:{type:'SKIP_WAITING'}});assert.equal(w.skipped(),true);await w.lifecycle('activate');assert.equal(w.stores.has('cartera-shell-v8'),false);assert.equal(w.stores.has('unrelated-app'),true);});
test('manifest installation paths resolve within the GitHub Pages subdirectory',async()=>{const m=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));assert.equal(new URL(m.start_url,scope).href,scope);assert.equal(new URL(m.scope,scope).href,scope);assert.equal(m.display,'standalone');for(const size of [192,512]){const icon=m.icons.find(i=>i.sizes===size+'x'+size);const png=await readFile(new URL(icon.src,root));assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}assert.ok(m.icons.some(i=>i.purpose.includes('maskable')));});
test('push notifications are generic and clicks only focus or open this app',async()=>{
 const events={},notifications=[],messages=[],opened=[];let focused=0;const scope='https://example.org/cartera_propiedades/';
 const self={registration:{scope,showNotification:async(title,options)=>notifications.push({title,options})},addEventListener:(name,fn)=>events[name]=fn,clients:{matchAll:async()=>[{url:scope,focus:async()=>{focused++;},postMessage:message=>messages.push(message)}],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(await readFile(new URL('sw.js',root),'utf8'),{self,URL});
 let promise;events.push({data:{json:()=>({clientId:'case-123',name:'Secret Name',body:'PRIVATE',url:'https://evil.test'})},waitUntil:p=>promise=p});await promise;assert.equal(notifications[0].title,'Carterita');assert.equal(messages[0].type,'CARTERITA_PUSH_SHOWN');assert.doesNotMatch(JSON.stringify(notifications),/Secret Name|PRIVATE|evil/);
 events.notificationclick({notification:{data:{clientId:'case-123'},close(){}},waitUntil:p=>promise=p});await promise;assert.equal(focused,1);assert.equal(messages.find(m=>m.type==='OPEN_FOLLOWUP').clientId,'case-123');assert.equal(opened.length,0);
 self.clients.matchAll=async()=>[];events.notificationclick({notification:{data:{clientId:'https://evil.test'},close(){}},waitUntil:p=>promise=p});await promise;assert.equal(opened[0],scope);
});
