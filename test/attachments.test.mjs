import {test} from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {fileRecord,saveFiles,listFiles,removeFiles,exportFiles,filesFromPackage,FILE_LIMIT} from '../docs/attachments.js';
const clientId='attachments-test-client';
test('named client files persist, transfer intact, deduplicate, and reject conflicts atomically',async()=>{
 const row=await fileRecord(clientId,'Liquidaciones de sueldo',new File(['%PDF-1.7\nexample'],'comprobante.pdf',{type:'application/pdf'}));
 const added=await saveFiles([row]);assert.deepEqual(added,[row.id]);assert.equal((await listFiles(clientId))[0].label,'Liquidaciones de sueldo');assert.equal((await listFiles('other-client')).length,0);
 const attachments=await exportFiles([clientId]);assert.equal(attachments.length,1);assert.equal(attachments[0].blob,undefined);assert.equal(attachments[0].label,'Liquidaciones de sueldo');
 const restored=await filesFromPackage({clients:[{id:clientId}],attachments});assert.equal(await restored[0].blob.text(),'%PDF-1.7\nexample');assert.deepEqual(await saveFiles(restored),[]);
 const fresh=await fileRecord(clientId,'Otro documento',new File(['texto'],'antecedentes.txt'));
 await assert.rejects(saveFiles([fresh,{...row,label:'Etiqueta distinta'}]),/conflicto/);assert.equal((await listFiles(clientId)).length,1);
 await removeFiles([row.id]);assert.equal((await listFiles(clientId)).length,0);await saveFiles(restored);assert.equal((await listFiles(clientId))[0].digest,row.digest);await removeFiles([row.id]);
});
test('validates package bytes, ownership, metadata and file limits before import',async()=>{
 const row=await fileRecord(clientId,'Referencia',new File(['abc'],'ejemplo.txt'));await saveFiles([row]);const attachments=await exportFiles([clientId]);await removeFiles([row.id]);
 await assert.rejects(filesFromPackage({clients:[{id:'other'}],attachments}),/sin cliente/);
 await assert.rejects(filesFromPackage({clients:[{id:clientId}],attachments:[{...attachments[0],data:'YWJk'}]}),/dañado/);
 await assert.rejects(filesFromPackage({clients:[{id:clientId}],attachments:[...attachments,...attachments]}),/repetidos/);
 await assert.rejects(fileRecord(clientId,'Ejecutable',new File(['x'],'malware.exe')),/Usa PDF/);
 await assert.rejects(fileRecord(clientId,'Grande',new File([new Uint8Array(FILE_LIMIT+1)],'grande.pdf')),/10 MB/);
 await assert.rejects(fileRecord(clientId,'',new File(['text'],'ejemplo.txt')),/nombre/);
 assert.deepEqual(await filesFromPackage({clients:[]}),[]);
});

import {TOTAL_LIMIT,groupFileExports,exportFilePackages} from '../docs/attachments.js';
test('500 MB quota accepts beyond the old cap and rejects additions above the new cap',async()=>{
 assert.equal(TOTAL_LIMIT,500*1024*1024);
 // Seed only byte-count metadata to test the boundary without allocating 500 MB.
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cartera-files-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
 const seed=async size=>new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:'quota-fixture',clientId:'quota-client',size});tx.oncomplete=resolve;tx.onabort=reject;});
 const row=await fileRecord('quota-client','Pequeño',new File(['12345'],'quota.txt'));
 await seed(60*1024*1024);await saveFiles([row]);await removeFiles([row.id]);
 await seed(TOTAL_LIMIT-4);await assert.rejects(saveFiles([row]),/500 MB/);assert.equal((await listFiles('quota-client')).length,1);
 await removeFiles(['quota-fixture']);db.close();
});
test('large vault exports split into bounded groups without dropping or duplicating files',()=>{
 const rows=Array.from({length:50},(_,i)=>({id:String(i),size:10*1024*1024}));const groups=groupFileExports(rows);assert.equal(groups.length,17);assert.deepEqual(groups.flat(),rows);assert.ok(groups.every(g=>g.reduce((sum,r)=>sum+r.size,0)<=30*1024*1024));
});
test('downloadable JSON blobs preserve files and part metadata',async()=>{
 const row=await fileRecord('blob-export-client','Comprobante',new File(['contenido'],'comprobante.txt'));await saveFiles([row]);
 const blobs=await exportFilePackages({app:'cartera',version:7,clients:[{id:row.clientId}]});assert.equal(blobs.length,1);const pack=JSON.parse(await blobs[0].text());assert.deepEqual(pack.packagePart,{index:1,total:1});assert.equal((await filesFromPackage(pack))[0].label,'Comprobante');
 const [withoutFiles]=await exportFilePackages({app:'cartera',version:7,clients:[{id:row.clientId}]},false);assert.deepEqual(JSON.parse(await withoutFiles.text()).attachments,[]);await removeFiles([row.id]);
});
