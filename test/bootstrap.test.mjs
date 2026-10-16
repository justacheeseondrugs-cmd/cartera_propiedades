import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('configured device gate loads no client app until authentication, relocks on hide, cancels pending send dialogs',async()=>{
 const source=(await readFile(new URL('../docs/bootstrap.js',import.meta.url),'utf8')).replace(/^import .*?;\n/,'').replace("await import('./app.js');",'await loadAppMock();');
 const classes=new Set(),window=new EventTarget(),document=new EventTarget(),button=new EventTarget(),screen={hidden:true},message={},shell={inert:false};let loads=0,reject=true;
 const form={id:'client-dialog',open:true,close(){this.open=false;},showModal(){this.open=true;}},send={id:'ai-send-dialog',open:true,close(){this.open=false;},showModal(){this.open=true;}};
 document.documentElement={classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};document.hidden=false;document.querySelector=s=>({'#device-lock-screen':screen,'#device-lock-message':message,'#device-unlock':button,'.shell':shell}[s]);document.querySelectorAll=()=>[form,send].filter(d=>d.open);form.isConnected=send.isConnected=true;
 await vm.runInNewContext('(async()=>{'+source+'})()',{window,document,Event,queueMicrotask,lockSettings:()=>({version:1}),isAuthenticating:()=>false,authenticateDevice:async()=>{if(reject)throw new Error('cancelled');},loadAppMock:async()=>{loads++;}});
 assert.equal(loads,0);assert.equal(screen.hidden,false);assert.equal(shell.inert,true);assert.equal(form.open,false);assert.equal(send.open,false);
 button.dispatchEvent(new Event('click'));await new Promise(setImmediate);assert.equal(loads,0);assert.equal(screen.hidden,false);
 reject=false;button.dispatchEvent(new Event('click'));await new Promise(setImmediate);assert.equal(loads,1);assert.equal(screen.hidden,true);assert.equal(shell.inert,false);assert.equal(form.open,true);assert.equal(send.open,false);
 document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));await new Promise(setImmediate);assert.equal(screen.hidden,false);assert.equal(shell.inert,true);
 button.dispatchEvent(new Event('click'));await new Promise(setImmediate);assert.equal(loads,1);assert.equal(screen.hidden,true);
});
