export const STATUSES=['Nuevo','En seguimiento','Esperando datos','Visita','Cerrado'];
export const INTENTS=['Comprar','Arrendar','Ofrecer propiedad'];
export const KINDS=['','Departamento','Casa','Terreno','Local / oficina','Otro'];
const limits={id:100,name:100,phone:30,area:120,kind:30,budget:100,property:180,notes:5000,draft:10000,intent:30,status:30,followup:10,createdAt:40,updatedAt:40};
export function validDate(s){if(!s)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s;}
export function cleanRecord(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Una consulta tiene un formato inválido.');
 const r={};for(const [k,max] of Object.entries(limits)){const v=value[k]??'';if(typeof v!=='string'||v.length>max)throw new Error('Campo inválido o demasiado largo: '+k);r[k]=v;}
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(r.id)||!r.name.trim()||!STATUSES.includes(r.status)||!INTENTS.includes(r.intent)||!KINDS.includes(r.kind)||!validDate(r.followup)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt)))throw new Error('La consulta contiene datos inválidos.');
 return r;
}
export function parseBackup(text){
 const b=JSON.parse(text);if(b.app!=='cartera'||b.version!==1||!Array.isArray(b.clients)||b.clients.length>3000)throw new Error('No es un respaldo compatible de Cartera.');
 const clients=b.clients.map(cleanRecord);if(new Set(clients.map(c=>c.id)).size!==clients.length)throw new Error('El respaldo contiene identificadores repetidos.');return clients;
}
export function mergeRecords(current,incoming){const map=new Map(current.map(c=>[c.id,c]));for(const c of incoming){const old=map.get(c.id);if(!old||Date.parse(c.updatedAt)>Date.parse(old.updatedAt))map.set(c.id,c);}return [...map.values()];}
export function missingFields(c){return [['area','comuna'],['kind','tipo de propiedad'],['budget',c.intent==='Ofrecer propiedad'?'precio esperado':'presupuesto']].filter(([key])=>!c[key].trim()).map(([,label])=>label);}
export function prepareReply(c,message,style){
 const greeting=`¡Hola, ${c.name.trim().split(/\s+/)[0]}! Gracias por escribir 😊`;
 if(style==='availability')return `${greeting}\n\n¿Me compartes el enlace o código de la propiedad que viste? Con ese dato puedo revisar su disponibilidad y las condiciones actuales.`;
 if(style==='visit')return `${greeting}\n\n¿Para qué propiedad te gustaría coordinar una visita y qué días u horarios te acomodan? Revisaré la disponibilidad antes de confirmar.`;
 if(style==='followup')return `Hola, ${c.name.trim().split(/\s+/)[0]}. Quería saber si sigues buscando ${c.intent==='Comprar'?'comprar':c.intent==='Arrendar'?'arrendar':'ofrecer tu propiedad'}${c.area?' en '+c.area:''}. ¿Cambió algún requisito o te puedo ayudar con el próximo paso?`;
 if(c.intent==='Ofrecer propiedad')return `${greeting}\n\n¿Quieres vender o poner en arriendo tu propiedad? Para orientarte, cuéntame su comuna, tipo de propiedad, características principales y precio esperado. No hace falta enviar documentos personales por ahora.`;
 const missing=missingFields(c);let questions=[];if(missing.includes('comuna'))questions.push('¿En qué comuna o sector buscas?');if(missing.includes('tipo de propiedad'))questions.push('¿Qué tipo de propiedad necesitas?');if(missing.includes('presupuesto'))questions.push('¿Cuál es tu presupuesto aproximado'+(c.intent==='Arrendar'?' mensual':'')+'?');questions.push('¿Para cuándo la necesitas?');
 return `${greeting}\n\nPara ayudarte a ${c.intent==='Comprar'?'comprar':'arrendar'}${c.area?' en '+c.area:''}, ${c.budget?'tomo como referencia tu presupuesto de '+c.budget+'. ':''}te consulto:\n${questions.join('\n')}\n\nCon esos datos podré revisar opciones. Su disponibilidad y precio deben confirmarse.`;
}
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
