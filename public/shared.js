export const $=s=>document.querySelector(s);
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=p=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(p)/100);
export async function api(path,body,csrf){const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;try{data=await response.json();}catch{throw Error('The server could not respond. Please try again shortly.');}if(!response.ok){const error=Error(data.error||'Request failed.');error.status=response.status;throw error;}return data;}
export function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function stored(){try{return JSON.parse(localStorage.getItem('tz-registration')||'null');}catch{return null;}}
export function store(value){try{localStorage.setItem('tz-registration',JSON.stringify(value));}catch{/* Receipt still provides the code if browser storage is disabled. */}}
export function date(value){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value))+' IST':'To be announced';}
