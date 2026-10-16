// Local privacy gate, not encryption of localStorage or IndexedDB. No biometric data is received.
const KEY='carterita-device-lock-v1';
let authenticating=false;
export function isAuthenticating(){return authenticating;}
function finishAuthentication(){authenticating=false;if(typeof window!=='undefined')window.dispatchEvent(new Event('carterita-auth-finished'));}
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export function lockSettings(){try{const raw=localStorage.getItem(KEY);if(!raw)return null;const s=JSON.parse(raw);if(s.version!==1||typeof s.credentialId!=='string'||!s.credentialId||s.credentialId.length>2048||!/^[A-Za-z0-9_-]+$/.test(s.credentialId)||typeof s.publicKey!=='string'||!s.publicKey||s.publicKey.length>2048||!/^[A-Za-z0-9_-]+$/.test(s.publicKey))throw new Error();return s;}catch{throw new Error('No se pudo leer el bloqueo de acceso. No borres los datos de la app; conserva tu respaldo.');}}
export async function deviceLockAvailable(){return Boolean(globalThis.isSecureContext&&globalThis.PublicKeyCredential&&navigator.credentials&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(()=>false));}
function derToRaw(signature){
 const b=new Uint8Array(signature);if(b.length===64)return b;
 if(b[0]!==48||b[2]!==2)throw new Error('Firma del dispositivo inválida.');const rLen=b[3],sOffset=4+rLen;if(b[sOffset]!==2)throw new Error('Firma del dispositivo inválida.');const sLen=b[sOffset+1],r=b.slice(4,4+rLen),s=b.slice(sOffset+2,sOffset+2+sLen);if(r.length>33||s.length>33||sOffset+2+sLen!==b.length)throw new Error('Firma del dispositivo inválida.');const raw=new Uint8Array(64);raw.set(r.slice(-32),32-Math.min(32,r.length));raw.set(s.slice(-32),64-Math.min(32,s.length));return raw;
}
export async function authenticateDevice(settings=lockSettings()){
 if(!settings)throw new Error('No hay un desbloqueo configurado.');authenticating=true;
 try{
  const challenge=crypto.getRandomValues(new Uint8Array(32));
  const assertion=await navigator.credentials.get({publicKey:{challenge,allowCredentials:[{type:'public-key',id:decode(settings.credentialId)}],userVerification:'required',timeout:60000,rpId:location.hostname}});
  if(!assertion||encode(assertion.rawId)!==settings.credentialId)throw new Error('El dispositivo no confirmó la identidad.');
  const response=assertion.response,client=JSON.parse(new TextDecoder().decode(response.clientDataJSON)),auth=new Uint8Array(response.authenticatorData);
  const rpHash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(location.hostname)));
  if(client.type!=='webauthn.get'||client.challenge!==encode(challenge)||client.origin!==location.origin||client.crossOrigin===true||auth.length<37||!rpHash.every((n,i)=>auth[i]===n)||(auth[32]&5)!==5)throw new Error('La verificación de identidad no es válida.');
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',response.clientDataJSON)),signed=new Uint8Array(auth.length+hash.length);signed.set(auth);signed.set(hash,auth.length);
  const key=await crypto.subtle.importKey('spki',decode(settings.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,derToRaw(response.signature),signed))throw new Error('No se pudo verificar la firma del dispositivo.');
 }catch(err){if(['NotAllowedError','AbortError'].includes(err.name))throw new Error('Desbloqueo cancelado o no disponible. Inténtalo de nuevo con el método del teléfono.');throw err;}finally{finishAuthentication();}
}
export async function enableDeviceLock(){
 if(!await deviceLockAvailable())throw new Error('Este navegador no ofrece autenticación del dispositivo. Usa el bloqueo del teléfono.');authenticating=true;
 try{
  const credential=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Carterita',id:location.hostname},user:{id:crypto.getRandomValues(new Uint8Array(32)),name:'carterita-'+crypto.randomUUID(),displayName:'Carterita en este dispositivo'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'discouraged',userVerification:'required'},attestation:'none',timeout:60000}});
  const key=credential?.response.getPublicKey?.();if(!key)throw new Error('Este navegador no permite verificar el desbloqueo. No se activó el bloqueo.');
  const settings={version:1,credentialId:encode(credential.rawId),publicKey:encode(key)};
  await authenticateDevice(settings);localStorage.setItem(KEY,JSON.stringify(settings));return settings;
 }catch(err){if(['NotAllowedError','AbortError'].includes(err.name))throw new Error('Configuración cancelada. No se activó el bloqueo.');throw err;}finally{finishAuthentication();}
}
export async function disableDeviceLock(){await authenticateDevice();localStorage.removeItem(KEY);}
