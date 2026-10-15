import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files=new Set(['index.html','style.css','app.js','pwa.js','core.js','ai.js','attachments.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest','sw.js']);
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
http.createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost:3001').pathname.slice(1)||'index.html';if(!files.has(name)){res.writeHead(404);return res.end('No encontrado');}try{const data=await readFile(new URL('./docs/'+name,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').pop()],'Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(500);res.end('No se pudo cargar');}}).listen(3001,'127.0.0.1',()=>console.log('Cartera: http://localhost:3001'));
