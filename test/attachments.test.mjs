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
