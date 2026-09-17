import {randomBytes, createHash, createHmac, timingSafeEqual, scryptSync} from 'node:crypto';
import {sql} from './db.mjs';
export const token = () => randomBytes(32).toString('hex');
export const hash = value => createHash('sha256').update(String(value)).digest('hex');
export function equal(a,b) {const x=Buffer.from(String(a)),y=Buffer.from(String(b)); return x.length===y.length && timingSafeEqual(x,y);}
export function passwordHash(password,salt=randomBytes(16).toString('hex')) {return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function checkPassword(value,encoded) {if(typeof value!=='string'||value.length>200||!encoded?.includes(':')) return false; const [salt,digest]=encoded.split(':'); return equal(passwordHash(value,salt).split(':')[1],digest);}
export function totp(secret,time=Date.now()) {
 const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=''; for(const c of secret.toUpperCase().replace(/\s/g,'')){const i=chars.indexOf(c);if(i<0)throw new Error('Invalid TOTP secret');bits+=i.toString(2).padStart(5,'0');}
 const bytes=[]; for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time/30000))); const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(); const o=h[19]&15; return ((h.readUInt32BE(o)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
export function checkTotp(code,secret) {return /^\d{6}$/.test(code||'') && [-30000,0,30000].some(t=>equal(totp(secret,Date.now()+t),code));}
export function originCheck(req) {const expected=process.env.APP_URL || (process.env.NODE_ENV!=='production'?'http://localhost:3000':''); if(!expected || req.headers.origin!==new URL(expected).origin) throw fail(403,'Request origin not allowed.');}
export function fail(status,message){return Object.assign(new Error(message),{status});}
export async function rate(req,label,max=10,seconds=900) {
 const ip=process.env.VERCEL?(req.headers['x-vercel-forwarded-for']||'unknown').split(',')[0]:req.socket?.remoteAddress||'local';
 const key=hash(`${label}:${ip}`);
 const [r]=await sql(`INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+($2::int * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count`,[key,seconds]);
 if(Number(r.count)>max)throw fail(429,'Too many attempts. Please try again in 15 minutes.');
}
export async function session(req,mutate=false) {
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('tz_admin='))?.slice(9);
 if(!cookie||!process.env.SESSION_SECRET)throw fail(401,'Please sign in.');
 const [s]=await sql('SELECT * FROM admin_sessions WHERE token_hash=$1 AND expires_at>now()',[hash(cookie+process.env.SESSION_SECRET)]);
 if(!s)throw fail(401,'Your session has expired. Please sign in.');
 if(mutate && !equal(req.headers['x-csrf-token']||'',s.csrf))throw fail(403,'Session check failed. Reload and try again.');
 return {...s,cookie};
}
export function cookie(value,maxAge=28800){return `tz_admin=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'||process.env.VERCEL?'; Secure':''}`;}
