const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const ITERATIONS=600000,MAX_FILE=120*1024*1024;
const AAD=encoder.encode('carterita-backup-v1');
export function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
function fromBase64(text,max){if(typeof text!=='string'||text.length>4*Math.ceil(max/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(text)||text.length%4)throw new Error('El respaldo cifrado está dañado.');const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(bytes.length>max)throw new Error('El respaldo cifrado es demasiado grande.');return bytes;}
export function validateBackupPassword(password){if(typeof password!=='string'||password.length<12||password.length>200)throw new Error('Usa una contraseña de 12 a 200 caracteres. Una frase larga es más fácil de recordar.');}
async function keyFor(password,salt,usage){const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},base,{name:'AES-GCM',length:256},false,[usage]);}
export async function encryptBackup(blob,password){
 validateBackupPassword(password);if(blob.size>80*1024*1024)throw new Error('El paquete es demasiado grande para cifrarlo.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(password,salt,'encrypt');
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},key,await blob.arrayBuffer()));
 return new Blob([JSON.stringify({app:'carterita-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:bytesToBase64(salt),iv:bytesToBase64(iv),data:bytesToBase64(ciphertext)})],{type:'application/json'});
}
export function isEncryptedBackup(value){return value?.app==='carterita-encrypted-backup';}
export async function decryptBackup(envelope,password){
 if(!envelope||envelope.app!=='carterita-encrypted-backup'||envelope.version!==1||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==ITERATIONS||envelope.cipher!=='AES-256-GCM')throw new Error('Formato de respaldo cifrado incompatible.');
 if(typeof password!=='string'||!password||password.length>200)throw new Error('Introduce la contraseña de este respaldo.');
 const salt=fromBase64(envelope.salt,16),iv=fromBase64(envelope.iv,12),data=fromBase64(envelope.data,MAX_FILE);
 if(salt.length!==16||iv.length!==12||data.length<16)throw new Error('El respaldo cifrado está dañado.');
 try{const key=await keyFor(password,salt,'decrypt');const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD},key,data);if(clear.byteLength>80*1024*1024)throw new Error('size');return decoder.decode(clear);}
 catch{throw new Error('No se pudo abrir: contraseña incorrecta o archivo dañado. No se modificaron tus datos.');}
}
export function backupAgeLabel(timestamp,now=Date.now()){
 const date=Date.parse(timestamp||'');if(!Number.isFinite(date)||date>now)return {overdue:true,text:'Todavía no has confirmado un respaldo guardado.'};
 const days=Math.floor((now-date)/86400000);return {overdue:days>=7,text:days===0?'Respaldo confirmado hoy.':`Último respaldo confirmado: hace ${days} día(s).`};
}
