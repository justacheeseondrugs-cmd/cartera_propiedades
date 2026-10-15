const DB='cartera-files-v1',STORE='files';
export const FILE_LIMIT=10*1024*1024,TOTAL_LIMIT=500*1024*1024;
const TYPES={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
let opened;
function database(){
 if(!globalThis.indexedDB)return Promise.reject(new Error('Este navegador no permite guardar archivos. Prueba Chrome actualizado.'));
 if(!opened)opened=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opened=null;};resolve(db);};request.onerror=()=>{opened=null;reject(new Error('No se pudo abrir el almacén de archivos.'));};request.onblocked=()=>{opened=null;reject(new Error('Cierra otras pestañas de Carterita y vuelve a intentarlo.'));};});
 return opened;
}
export async function listFiles(clientId){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result.filter(r=>!clientId||r.clientId===clientId));req.onerror=()=>reject(new Error('No se pudieron leer los archivos guardados.'));});}
function validMeta(row){
 const ext=String(row.name||'').split('.').pop().toLowerCase();
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id)||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.clientId)||typeof row.label!=='string'||!row.label.trim()||row.label.length>160||typeof row.name!=='string'||row.name.length>240||/[\\/\x00-\x1f]/.test(row.name)||!TYPES[ext]||row.type!==TYPES[ext]||!Number.isInteger(row.size)||row.size<1||row.size>FILE_LIMIT||!/^[a-f0-9]{64}$/.test(row.digest))throw new Error('Revisa el nombre, formato y tamaño de cada archivo. Máximo 10 MB por archivo.');
}
async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function fileRecord(clientId,label,file){
 const type=TYPES[file.name.split('.').pop().toLowerCase()];
 if(!type)throw new Error('Usa PDF, JPG, PNG, WEBP, TXT, DOCX o XLSX.');
 if(!file.size||file.size>FILE_LIMIT)throw new Error('El archivo debe pesar entre 1 byte y 10 MB.');
 const bytes=await file.arrayBuffer();const row={id:crypto.randomUUID(),clientId,label:label.trim(),name:file.name,type,size:bytes.byteLength,createdAt:new Date().toISOString(),digest:await digest(bytes),blob:new Blob([bytes],{type})};validMeta(row);return row;
}
export async function saveFiles(rows){
 for(const r of rows){validMeta(r);if(!(r.blob instanceof Blob)||r.blob.size!==r.size)throw new Error('Archivo incompleto.');}
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('El paquete tiene archivos repetidos.');
 const db=await database();return new Promise((resolve,reject)=>{let error,added=[];const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),req=store.getAll();
 req.onsuccess=()=>{try{const old=new Map(req.result.map(r=>[r.id,r]));let size=req.result.reduce((sum,r)=>sum+r.size,0);
 for(const row of rows){const existing=old.get(row.id);if(existing){if(existing.digest!==row.digest||existing.clientId!==row.clientId||existing.label!==row.label||existing.name!==row.name)throw new Error('Hay un conflicto entre archivos. No se reemplazó ninguno.');continue;}size+=row.size;added.push(row.id);}
 if(size>TOTAL_LIMIT||req.result.length+added.length>200)throw new Error('Se alcanzó el límite local de 500 MB o 200 archivos. Descarga y elimina archivos antes de añadir más.');
 for(const row of rows)if(!old.has(row.id))store.add(row);
 }catch(err){error=err;tx.abort();}};
 tx.oncomplete=()=>resolve(added);tx.onabort=()=>reject(error||new Error('No se pudieron guardar los archivos. Revisa el espacio disponible; no se añadió ninguno.'));tx.onerror=()=>{};
 });
}
export async function removeFiles(ids){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');for(const id of ids)tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onabort=()=>reject(new Error('No se pudo eliminar el archivo.'));});}
async function encodedFile(row){
 const bytes=new Uint8Array(await row.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const {blob,...meta}=row;return {...meta,data:btoa(binary)};
}
export async function exportFiles(clientIds){
 if(!globalThis.indexedDB)return [];
 const rows=(await listFiles()).filter(r=>clientIds.includes(r.clientId)),output=[];
 for(const row of rows)output.push(await encodedFile(row));return output;
}
export function groupFileExports(rows,limit=30*1024*1024){
 const groups=[[]];let size=0;
 for(const row of rows){if(row.size>limit)throw new Error('Un archivo supera el tamaño de exportación.');if(size+row.size>limit){groups.push([]);size=0;}groups.at(-1).push(row);size+=row.size;}return groups;
}
export async function exportFilePackages(base,includeFiles=true){
 const rows=includeFiles&&globalThis.indexedDB?(await listFiles()).filter(r=>base.clients.some(c=>c.id===r.clientId)):[];
 const groups=groupFileExports(rows),blobs=[];
 for(let i=0;i<groups.length;i++){
  // Blob parts avoid constructing one enormous base64 JSON string for a 500 MB vault.
  const json=JSON.stringify({...base,packagePart:{index:i+1,total:groups.length}});
  const pieces=[json.slice(0,-1),',"attachments":['];
  for(let j=0;j<groups[i].length;j++){if(j)pieces.push(',');pieces.push(JSON.stringify(await encodedFile(groups[i][j])));}
  pieces.push(']}');const blob=new Blob(pieces,{type:'application/json'});
  if(blob.size>80*1024*1024)throw new Error('Las fichas de texto son demasiado grandes para exportar. Reduce el contenido antes de guardar el paquete.');blobs.push(blob);
 }return blobs;
}
export async function filesFromPackage(pack){
 if(pack.attachments===undefined)return [];
 if(!Array.isArray(pack.attachments)||pack.attachments.length>200)throw new Error('Lista de archivos inválida.');
 const ids=new Set(pack.clients.map(c=>c.id)),seen=new Set(),rows=[];let total=0;
 for(const raw of pack.attachments){validMeta(raw);if(!ids.has(raw.clientId)||seen.has(raw.id))throw new Error('Hay archivos sin cliente o identificadores repetidos.');seen.add(raw.id);
 if(typeof raw.data!=='string'||raw.data.length!==4*Math.ceil(raw.size/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw.data))throw new Error('Datos de archivo inválidos.');
 total+=raw.size;if(total>TOTAL_LIMIT)throw new Error('Los archivos del paquete superan 500 MB.');
 const binary=atob(raw.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length!==raw.size||await digest(bytes)!==raw.digest)throw new Error('Un archivo del paquete está incompleto o dañado.');
 rows.push({id:raw.id,clientId:raw.clientId,label:raw.label,name:raw.name,type:raw.type,size:raw.size,digest:raw.digest,createdAt:typeof raw.createdAt==='string'?raw.createdAt.slice(0,40):'',blob:new Blob([bytes],{type:raw.type})});
 }return rows;
}
export function mountClientFiles(container,clientId,{notify=()=>{},canEdit=()=>true}={}){
 const document=container.ownerDocument,view=document.defaultView;
 const section=document.createElement('section');section.className='workflow-block client-files';section.innerHTML='<h3>Archivos de este cliente</h3><p class="small muted">Ponle un nombre fácil de reconocer y adjunta su archivo. Se guarda en este dispositivo, sin enviarlo a la IA ni cambiar el checklist. PDF, fotos, TXT, Word o Excel; máximo 10 MB por archivo y 500 MB en total.</p><form class="attachment-form"><label>Nombre del documento<input name="label" required maxlength="160" placeholder="Ej. Liquidaciones de sueldo"></label><label>Elegir archivo<input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx,.xlsx"></label><button class="secondary" type="submit">Guardar archivo en esta ficha</button></form><p class="file-status small" role="status"></p><ul class="saved-file-list"></ul><p class="small muted">Para llevarlos al computador, incluye los archivos al guardar tu paquete. Borrar los datos del navegador también elimina estos documentos.</p>';
 container.append(section);const form=section.querySelector('form'),status=section.querySelector('.file-status'),list=section.querySelector('ul');let busy=false;
 async function refresh(){try{const all=await listFiles(),rows=all.filter(r=>r.clientId===clientId);const used=(all.reduce((sum,r)=>sum+r.size,0)/1024/1024).toFixed(1);if(!section.isConnected)return;list.replaceChildren();for(const row of rows){const li=document.createElement('li'),title=document.createElement('strong'),info=document.createElement('p'),download=document.createElement('button'),remove=document.createElement('button');title.textContent=row.label;info.className='small muted';info.textContent=row.name+' · '+(row.size/1024/1024).toFixed(2)+' MB';download.type=remove.type='button';download.className=remove.className='quiet';download.textContent='Descargar archivo';remove.textContent='Eliminar';
 download.onclick=()=>{const url=view.URL.createObjectURL(row.blob),a=document.createElement('a');a.href=url;a.download=row.name;a.click();setTimeout(()=>view.URL.revokeObjectURL(url),30000);};
 remove.onclick=async()=>{if(busy||!canEdit()||!view.confirm('¿Eliminar «'+row.label+'» de esta ficha? Conserva una copia si la necesitas.'))return;busy=true;remove.disabled=true;try{await removeFiles([row.id]);await refresh();notify('Archivo eliminado de este dispositivo.');}catch(err){notify(err.message);}finally{busy=false;remove.disabled=false;}};
 li.append(title,info,download,remove);list.append(li);}status.textContent=(rows.length?rows.length+' archivo(s) en esta ficha. ':'Todavía no hay archivos en esta ficha. ')+used+' de 500 MB usados entre todos los clientes.';
 }catch(err){status.textContent=err.message;}}
 form.onsubmit=async event=>{event.preventDefault();if(busy||!canEdit())return;const file=form.elements.file.files[0];if(!file)return;busy=true;form.querySelector('button').disabled=true;status.textContent='Guardando archivo…';try{const row=await fileRecord(clientId,form.elements.label.value,file);if(!canEdit())throw new Error('La ficha cambió. Vuelve a abrirla antes de guardar.');await saveFiles([row]);form.reset();await refresh();notify('Archivo guardado en la ficha.');}catch(err){status.textContent=err.message;notify(err.message);}finally{busy=false;form.querySelector('button').disabled=false;}};
 refresh();return section;
}
