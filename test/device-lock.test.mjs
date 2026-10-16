import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authenticateDevice,enableDeviceLock,disableDeviceLock,lockSettings,isAuthenticating} from '../docs/device-lock.js';
const b64=b=>Buffer.from(b).toString('base64url');
const der=raw=>{const ints=[raw.slice(0,32),raw.slice(32)].map(x=>{let b=Buffer.from(x);while(b.length>1&&b[0]===0)b=b.subarray(1);if(b[0]&128)b=Buffer.concat([Buffer.from([0]),b]);return Buffer.concat([Buffer.from([2,b.length]),b]);});const contents=Buffer.concat(ints);return Buffer.concat([Buffer.from([48,contents.length]),contents]);};
test('local WebAuthn gate verifies challenge, origin, RP hash, UV and signature; enrollment checks before enabling',async()=>{
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),originalLocation=globalThis.location,originalStorage=globalThis.localStorage,originalPK=globalThis.PublicKeyCredential,originalSecure=globalThis.isSecureContext;
 const store=new Map(),pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),publicKey=await crypto.subtle.exportKey('spki',pair.publicKey),id=crypto.getRandomValues(new Uint8Array(20));let bad='',gets=0;
 globalThis.location={hostname:'example.org',origin:'https://example.org'};globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};globalThis.isSecureContext=true;globalThis.PublicKeyCredential={isUserVerifyingPlatformAuthenticatorAvailable:async()=>true};
 const credentials={create:async options=>{assert.equal(options.publicKey.authenticatorSelection.userVerification,'required');return {rawId:id,response:{getPublicKey:()=>publicKey}};},get:async options=>{
  gets++;assert.equal(options.publicKey.userVerification,'required');assert.equal(isAuthenticating(),true);
  if(bad==='cancel')throw new DOMException('cancelled','NotAllowedError');
  const clientDataJSON=new TextEncoder().encode(JSON.stringify({type:'webauthn.get',challenge:bad==='challenge'?'wrong':b64(options.publicKey.challenge),origin:bad==='origin'?'https://other.org':location.origin}));
  const auth=new Uint8Array(37);auth.set(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(location.hostname))));auth[32]=bad==='uv'?1:5;if(bad==='rp')auth[0]^=1;
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',clientDataJSON)),signed=new Uint8Array(69);signed.set(auth);signed.set(hash,37);const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,signed));if(bad==='signature')signature[0]^=1;
  return {rawId:id,response:{clientDataJSON,authenticatorData:auth,signature:der(signature)}};
 }};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{credentials}});
 try{
  await enableDeviceLock();assert.ok(lockSettings());assert.equal(gets,1);await authenticateDevice();assert.equal(isAuthenticating(),false);
  for(const reason of ['challenge','origin','uv','rp','signature','cancel']){bad=reason;await assert.rejects(authenticateDevice());assert.ok(lockSettings());assert.equal(isAuthenticating(),false);}
  bad='cancel';await assert.rejects(disableDeviceLock());assert.ok(lockSettings());bad='';await disableDeviceLock();assert.equal(lockSettings(),null);
  bad='signature';await assert.rejects(enableDeviceLock());assert.equal(lockSettings(),null);
 }finally{if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;globalThis.location=originalLocation;globalThis.localStorage=originalStorage;globalThis.PublicKeyCredential=originalPK;globalThis.isSecureContext=originalSecure;}
});
