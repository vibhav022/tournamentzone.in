import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {sql,config} from '../lib/db.mjs';
import {token,hash,checkPassword,checkTotp,originCheck,fail,rate,session,cookie,equal} from '../lib/security.mjs';
import {registration} from '../lib/validation.mjs';
import {razor,signature,confirmPayment} from '../lib/payments.mjs';

const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)throw fail(413,'Request too large.');}return raw;}
async function owned(body){if(!body.reference||!body.access)throw fail(400,'Registration reference and access code are required.');const [r]=await sql('SELECT * FROM registrations WHERE reference=$1 AND access_hash=$2',[body.reference,hash(body.access)]);if(!r)throw fail(404,'Registration not found. Check the reference and access code.');return r;}
const safeRow=r=>({reference:r.reference,name:r.name,status:r.status,amount:Number(r.amount),order_id:r.order_id,created_at:r.created_at});
const audit=(action,target)=>sql('INSERT INTO audit_log(action,target) VALUES($1,$2)',[action,target||null]);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const url=new URL(req.url,'http://localhost');const route=url.searchParams.get('route')||url.pathname.replace(/^\/api\/?/,'');
 try{
 if(route==='admin-page'||(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))){
  let view='login';try{await session(req);view='admin';}catch(e){if(e.status!==401&&e.status!==503)console.error('Admin session unavailable');}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(await readFile(new URL(`../views/${view}.html`,import.meta.url),'utf8'));
 }
 if(req.method==='GET'&&route==='config'){
  try {const c=await config();return json(res,200,{...c,fee_paise:Number(c.fee_paise),payment_ready:!!(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET&&process.env.RAZORPAY_WEBHOOK_SECRET&&process.env.APP_URL),configured:true});}
  catch{return json(res,200,{title:'Indore Campus Chess Open',fee_paise:5000,status:'draft',starts_at:null,format:'Format and time control to be announced',contact_email:'',organiser_name:'',chess_url:'',payment_ready:false,configured:false});}
 }
 if(req.method==='GET'&&route==='admin/data'){
  const s=await session(req);const [c,rows,events]=await Promise.all([config(),sql('SELECT id,reference,name,email,phone,college,year,chess_username,amount,status,order_id,payment_id,refund_id,created_at,deleted_at FROM registrations ORDER BY created_at DESC LIMIT 2000'),sql('SELECT action,target,created_at FROM audit_log ORDER BY created_at DESC LIMIT 50')]);
  return json(res,200,{settings:c,registrations:rows,audit:events,csrf:s.csrf,readiness:{database:true,password:!!process.env.ADMIN_PASSWORD_HASH,authenticator:!!process.env.ADMIN_TOTP_SECRET,payments:!!(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET),webhook:!!process.env.RAZORPAY_WEBHOOK_SECRET,app_url:!!process.env.APP_URL},limit:2000});
 }
 if(req.method!=='POST')throw fail(405,'Method not allowed.');
 const raw=await readBody(req);
 if(route==='webhook'){
  if(!signature(raw,req.headers['x-razorpay-signature'],process.env.RAZORPAY_WEBHOOK_SECRET))throw fail(400,'Invalid webhook signature.');
  let event;try{event=JSON.parse(raw);}catch{throw fail(400,'Invalid JSON.');}
  const p=event.payload?.payment?.entity;
  if(['payment.captured','order.paid'].includes(event.event)&&p){const [r]=await sql('SELECT * FROM registrations WHERE order_id=$1',[p.order_id]);if(r)await confirmPayment(r,p.id);}
  const refund=event.payload?.refund?.entity;
  if(event.event==='refund.processed'&&refund){await sql("UPDATE registrations SET status='refunded',refund_id=$1 WHERE payment_id=$2 AND amount=$3 AND status IN ('paid','refund_pending','refunded')",[refund.id,refund.payment_id,refund.amount]);}
  return json(res,200,{received:true});
 }
 originCheck(req);let body;try{body=JSON.parse(raw||'{}');}catch{throw fail(400,'Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Invalid request.');
 if(route==='login'){
  if(!process.env.ADMIN_PASSWORD_HASH||!process.env.ADMIN_TOTP_SECRET||!process.env.SESSION_SECRET)throw fail(503,'Admin setup is incomplete. Run npm run setup and add the environment variables.');
  await rate(req,'admin-login',5);
  if(!checkPassword(body.password,process.env.ADMIN_PASSWORD_HASH)||!checkTotp(body.code,process.env.ADMIN_TOTP_SECRET))throw fail(401,'Incorrect password or authenticator code.');
  const used=await sql("INSERT INTO totp_used(code_hash,expires_at) VALUES($1,now()+interval '90 seconds') ON CONFLICT(code_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at WHERE totp_used.expires_at<now() RETURNING code_hash",[hash(body.code+process.env.ADMIN_TOTP_SECRET)]);
  if(!used.length)throw fail(401,'This code was already used. Wait for the next authenticator code.');
  const access=token(),csrf=token();await sql("INSERT INTO admin_sessions(token_hash,csrf,expires_at) VALUES($1,$2,now()+interval '8 hours')",[hash(access+process.env.SESSION_SECRET),csrf]);
  await sql('DELETE FROM admin_sessions WHERE expires_at<now()');await sql('DELETE FROM totp_used WHERE expires_at<now()');await sql('DELETE FROM rate_limits WHERE expires_at<now()');
  res.setHeader('Set-Cookie',cookie(access));return json(res,200,{ok:true});
 }
 if(route==='register'){
  await rate(req,'register',15);const input=registration(body);const c=await config();
  if(c.status!=='open')throw fail(409,'Registration is not open at the moment.');
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET||!process.env.RAZORPAY_WEBHOOK_SECRET)throw fail(503,'Payments are not configured yet.');
  const id=randomUUID(),reference=`TZ-${new Date().getFullYear()}-${token().slice(0,12).toUpperCase()}`,access=token();
  try{await sql('INSERT INTO registrations(id,reference,access_hash,name,email,phone,college,year,chess_username,amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,reference,hash(access),input.name,input.email,input.phone,input.college,input.year,input.chess_username,c.fee_paise]);}
  catch(e){if(e.code==='23505')throw fail(409,'This email or Chess.com username already has a registration. Use “Check registration” or contact the organiser.');throw e;}
  return json(res,201,{reference,access,amount:Number(c.fee_paise),status:'pending'});
 }
 if(route==='order'){
  await rate(req,'payment-order',30);let r=await owned(body);const c=await config();if(c.status!=='open')throw fail(409,'Registration is closed.');if(r.status!=='pending'||r.deleted_at)throw fail(409,'This registration cannot accept payment.');
  if(!r.order_id){
   const claimed=await sql("UPDATE registrations SET order_lock=now() WHERE id=$1 AND order_id IS NULL AND (order_lock IS NULL OR order_lock<now()-interval '60 seconds') RETURNING id",[r.id]);
   if(!claimed.length)throw fail(409,'Checkout is being prepared. Please try again in a minute.');
   try{const order=await razor('orders',{amount:Number(r.amount),currency:'INR',receipt:r.reference,notes:{registration_reference:r.reference}});await sql('UPDATE registrations SET order_id=$1,order_lock=NULL WHERE id=$2 AND order_id IS NULL',[order.id,r.id]);}
   catch(e){await sql('UPDATE registrations SET order_lock=NULL WHERE id=$1',[r.id]);throw e;}
   r=await owned(body);
  }
  return json(res,200,{order_id:r.order_id,amount:Number(r.amount),currency:'INR',key:process.env.RAZORPAY_KEY_ID,reference:r.reference,prefill:{name:r.name,email:r.email,contact:r.phone}});
 }
 if(route==='verify'){
  await rate(req,'verify',40);const r=await owned(body);
  if(body.razorpay_order_id!==r.order_id||!signature(`${r.order_id}|${body.razorpay_payment_id}`,body.razorpay_signature,process.env.RAZORPAY_KEY_SECRET))throw fail(400,'Payment verification failed.');
  await confirmPayment(r,body.razorpay_payment_id);return json(res,200,{registration:safeRow(await owned(body))});
 }
 if(route==='status'){
  await rate(req,'status',50);let r=await owned(body);
  if(r.order_id&&r.status==='pending'){const payments=await razor(`orders/${encodeURIComponent(r.order_id)}/payments`);const paid=payments.items?.find(p=>p.status==='captured');if(paid){await confirmPayment(r,paid.id);r=await owned(body);}}
  return json(res,200,{registration:safeRow(r)});
 }
 if(route.startsWith('admin/')||route==='logout'){
  const s=await session(req,true);
  if(route==='logout'){await sql('DELETE FROM admin_sessions WHERE token_hash=$1',[s.token_hash]);res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true});}
  if(route==='admin/settings'){
   const title=String(body.title||'').trim(),contact=String(body.contact_email||'').trim(),organiser=String(body.organiser_name||'').trim(),format=String(body.format||'').trim();
   const fee=Number(body.fee_paise);if(title.length<3||title.length>100||organiser.length>100||format.length>200||!Number.isInteger(fee)||fee<100||fee>100000)throw fail(400,'Check the tournament title, format and fee.');
   if(contact&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw fail(400,'Enter a valid organiser email.');
   const status=body.status;if(!['draft','open','closed','cancelled','completed'].includes(status))throw fail(400,'Invalid status.');
   if(status==='open'&&(!contact||!organiser||!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET||!process.env.RAZORPAY_WEBHOOK_SECRET||!process.env.APP_URL))throw fail(400,'Add organiser name, support email, payment keys, webhook secret and APP_URL before opening registration.');
   let chess=String(body.chess_url||'').trim();if(chess){let u;try{u=new URL(chess);}catch{throw fail(400,'Enter a valid Chess.com tournament link.');}if(u.protocol!=='https:'||!(u.hostname==='chess.com'||u.hostname.endsWith('.chess.com')))throw fail(400,'Tournament link must be an HTTPS Chess.com URL.');}
   let date=null;if(body.starts_at){date=new Date(body.starts_at);if(!Number.isFinite(date.getTime()))throw fail(400,'Invalid date.');date=date.toISOString();}
   await sql('UPDATE tournament_settings SET title=$1,fee_paise=$2,starts_at=$3,status=$4,contact_email=$5,organiser_name=$6,chess_url=$7,format=$8,updated_at=now() WHERE id=1',[title,fee,date,status,contact,organiser,chess,format]);await audit('settings.updated',status);return json(res,200,{ok:true});
  }
  const [r]=await sql('SELECT * FROM registrations WHERE id=$1',[body.id]);if(!r)throw fail(404,'Registration not found.');
  if(route==='admin/delete'){
   if(body.confirm!==r.reference)throw fail(400,'Type the registration reference to confirm deletion.');
   if(r.status==='pending'&&!r.order_id){await sql('DELETE FROM registrations WHERE id=$1',[r.id]);}else{await sql('UPDATE registrations SET deleted_at=now() WHERE id=$1',[r.id]);}
   await audit('registration.deleted',r.reference);return json(res,200,{ok:true});
  }
  if(route==='admin/refund'){
   if(body.confirm!==r.reference)throw fail(400,'Type the registration reference to confirm the refund.');
   const rows=await sql("UPDATE registrations SET status='refund_pending' WHERE id=$1 AND status='paid' AND payment_id IS NOT NULL RETURNING id",[r.id]);
   if(!rows.length)throw fail(409,'Only a paid registration can be refunded. Use Sync for a pending refund.');
   await audit('refund.requested',r.reference);
   const refund=await razor(`payments/${encodeURIComponent(r.payment_id)}/refund`,{amount:Number(r.amount),notes:{reference:r.reference}});
   await sql("UPDATE registrations SET refund_id=$1,status=CASE WHEN status='refunded' THEN status ELSE $2 END WHERE id=$3",[refund.id,refund.status==='processed'?'refunded':'refund_pending',r.id]);return json(res,200,{ok:true});
  }
  if(route==='admin/sync'){
   if(r.status==='refund_pending'&&r.payment_id){const refunds=await razor(`payments/${encodeURIComponent(r.payment_id)}/refunds`);const refund=refunds.items?.find(x=>Number(x.amount)===Number(r.amount));if(!refund)throw fail(409,'No full refund is recorded by Razorpay yet. Check the payment in Razorpay before retrying a refund; this avoids duplicate refunds.');await sql("UPDATE registrations SET refund_id=$1,status=CASE WHEN status='refunded' THEN status ELSE $2 END WHERE id=$3",[refund.id,refund.status==='processed'?'refunded':'refund_pending',r.id]);}
   else if(r.order_id&&r.status==='pending'){const p=await razor(`orders/${encodeURIComponent(r.order_id)}/payments`);const captured=p.items?.find(x=>x.status==='captured');if(captured)await confirmPayment(r,captured.id);}
   await audit('payment.synced',r.reference);return json(res,200,{ok:true});
  }
 }
 throw fail(404,'Endpoint not found.');
 }catch(error){if(!error.status)console.error('Request failed',{route,code:error.code||'internal'});return json(res,error.status||503,{error:error.status?error.message:'Service is temporarily unavailable. Please try again or contact the organiser.'});}
}
