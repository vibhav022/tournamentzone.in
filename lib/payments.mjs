import {createHmac} from 'node:crypto';
import {sql} from './db.mjs';
import {equal,fail} from './security.mjs';
export async function razor(path,body) {
 if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)throw fail(503,'Payments are not configured yet. Please contact the organiser.');
 const res=await fetch(`https://api.razorpay.com/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Basic ${Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64')}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw fail(502,'Payment provider could not complete this request. Please retry or contact the organiser.');return res.json();
}
export function signature(message,sig,secret){return !!secret && equal(createHmac('sha256',secret).update(message).digest('hex'),sig||'');}
export async function confirmPayment(row,paymentId) {
 const payment=await razor(`payments/${encodeURIComponent(paymentId)}`);
 if(payment.order_id!==row.order_id || Number(payment.amount)!==Number(row.amount)||payment.currency!=='INR')throw fail(400,'Payment details do not match this registration.');
 if(payment.status!=='captured')throw fail(409,'Payment is processing. Please check your registration again shortly.');
 await sql("UPDATE registrations SET status='paid',payment_id=$1,paid_at=now() WHERE id=$2 AND status='pending'",[payment.id,row.id]);
 return payment;
}
