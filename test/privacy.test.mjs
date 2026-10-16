import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encryptBackup,decryptBackup,isEncryptedBackup,validateBackupPassword,backupAgeLabel} from '../docs/privacy.js';
test('password backup round trip preserves Unicode and attachment payload, hides plaintext',async()=>{
 const plain=JSON.stringify({app:'cartera',clients:[{name:'María 👩',notes:'Información privada'}],attachments:[{data:'YWJj'}]});
 const first=JSON.parse(await (await encryptBackup(new Blob([plain]),'Una frase privada 2026')).text());assert.equal(isEncryptedBackup(first),true);assert.doesNotMatch(JSON.stringify(first),/María|Información privada|YWJj/);assert.equal(await decryptBackup(first,'Una frase privada 2026'),plain);
 const second=JSON.parse(await (await encryptBackup(new Blob([plain]),'Una frase privada 2026')).text());assert.notEqual(first.salt,second.salt);assert.notEqual(first.iv,second.iv);assert.notEqual(first.data,second.data);
 await assert.rejects(decryptBackup(first,'Otra contraseña incorrecta'),/contraseña incorrecta/);
 const bytes=Uint8Array.from(atob(first.data),c=>c.charCodeAt(0));bytes[0]^=1;const tampered={...first,data:btoa(String.fromCharCode(...bytes))};await assert.rejects(decryptBackup(tampered,'Una frase privada 2026'),/archivo dañado/);
 await assert.rejects(decryptBackup({...first,iterations:1},'Una frase privada 2026'),/incompatible/);
});
test('backup password requirements and reminders do not claim a prepared backup is saved',()=>{
 assert.throws(()=>validateBackupPassword('12345'),/12 a 200/);assert.doesNotThrow(()=>validateBackupPassword('Una frase más larga'));
 const now=Date.parse('2026-10-16T12:00:00Z');assert.equal(backupAgeLabel('',now).overdue,true);assert.equal(backupAgeLabel('bad',now).overdue,true);assert.equal(backupAgeLabel('2026-10-16T00:00:00Z',now).overdue,false);assert.equal(backupAgeLabel('2026-10-09T12:00:00Z',now).overdue,true);assert.equal(backupAgeLabel('2026-10-17T12:00:00Z',now).overdue,true);
});
