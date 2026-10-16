import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarEntries,eventBody,syncCalendar} from '../docs/calendar-sync.js';
const client={id:'c1',name:'Nombre privado',phone:'999999999',email:'secret@test',nextAction:'Revisar antecedentes',followup:'2026-10-20',followupTime:'10:30',status:'Nuevo'};
test('calendar includes pending dates without inventing times, omits completed and closed records',()=>{
 assert.equal(calendarEntries([client,{...client,id:'no-time',followupTime:''},{...client,followupDoneAt:'now'},{...client,status:'Cerrado'}]).length,2);
 assert.equal(eventBody({...client,followupTime:''}),null);assert.equal(eventBody({...client,followup:'2026-02-30'}),null);
 assert.equal(eventBody({...client,followupTime:'25:00'}),null);
});
test('event is discreet when requested and contains no contact or financial data',()=>{
 const body=eventBody(client,false);assert.equal(body.summary,'Pendiente de Carterita');assert.doesNotMatch(JSON.stringify(body),/Nombre privado|999999999|secret@test|antecedentes/);
 assert.equal(Date.parse(body.end.dateTime)-Date.parse(body.start.dateTime),15*60000);
 assert.equal(eventBody(client,true).summary,'Nombre privado · Revisar antecedentes');
});
test('sync creates, updates and removes only events owned by Carterita; retries do not duplicate',async()=>{
 const events=new Map(),calls=[];let serial=0;
 const request=async(path,method='GET',body)=>{calls.push({path,method});if(method==='GET')return {items:[...events.values()]};const id=decodeURIComponent(path.split('/').at(-1));if(method==='POST'){const e={...body,id:'event'+(++serial)};events.set(e.id,e);return e;}if(method==='PATCH'){events.set(id,{...body,id});return events.get(id);}if(method==='DELETE'){events.delete(id);return {};}};
 await syncCalendar({clients:[client],calendarId:'calendar@test',request});assert.equal(events.size,1);
 await syncCalendar({clients:[client],calendarId:'calendar@test',request});assert.equal(serial,1);assert.equal(calls.filter(c=>c.method==='PATCH').length,0);
 await syncCalendar({clients:[{...client,followupTime:'12:00'}],calendarId:'calendar@test',request});assert.equal(events.size,1);assert.equal(calls.filter(c=>c.method==='PATCH').length,1);
 events.set('personal',{id:'personal',summary:'My event'});
 await syncCalendar({clients:[{...client,followupDoneAt:'done'}],calendarId:'calendar@test',request});assert.equal(events.size,1);assert.ok(events.has('personal'));
});
test('sync follows pagination and reconciles duplicate owned events without touching unrelated ones',async()=>{
 const calls=[],body=eventBody(client);const request=async(path,method='GET')=>{calls.push({path,method});if(method!=='GET')return {};return path.includes('pageToken=')?{items:[{...body,id:'duplicate'}]}:{items:[{...body,id:'first'},{id:'unrelated',extendedProperties:{private:{carteritaSource:'different'}}}],nextPageToken:'next page'};};
 await syncCalendar({clients:[client],calendarId:'id',request});assert.equal(calls.filter(c=>c.method==='GET').length,2);assert.deepEqual(calls.filter(c=>c.method==='DELETE').map(c=>c.path),['/calendars/id/events/duplicate']);
});
test('failed writes surface the error, without retrying or deleting following events',async()=>{
 const calls=[];await assert.rejects(syncCalendar({clients:[client],calendarId:'id',request:async(path,method='GET')=>{calls.push(method);if(method==='GET')return {items:[]};throw Error('offline');}}),/offline/);assert.deepEqual(calls,['GET','POST']);
});
test('multiple events for one client retain separate Google events when one is changed or completed',async()=>{
 const a={id:'evt_a',title:'Visita',date:'2026-10-21',time:'11:00',doneAt:''},b={id:'evt_b',title:'Firmar',date:'2026-10-22',time:'12:00',doneAt:''};
 const c={...client,calendarEvents:[a,b]};assert.equal(calendarEntries([c]).length,3);
 const events=new Map();let sequence=0;const request=async(path,method='GET',body)=>{if(method==='GET')return {items:[...events.values()]};if(method==='POST'){const item={...body,id:'g'+(++sequence)};events.set(item.id,item);return item;}const id=path.split('/').at(-1);if(method==='PATCH'){events.set(id,{...body,id});return events.get(id);}if(method==='DELETE')events.delete(id);return {};};
 await syncCalendar({clients:[c],calendarId:'id',request});assert.equal(events.size,3);
 await syncCalendar({clients:[{...c,calendarEvents:[{...a,time:'15:00'},{...b,doneAt:'2026-10-20T12:00:00Z'}]}],calendarId:'id',request});assert.equal(events.size,2);assert.equal(sequence,3);assert.ok([...events.values()].some(e=>e.summary.includes('Visita')));assert.ok(![...events.values()].some(e=>e.summary.includes('Firmar')));
});
