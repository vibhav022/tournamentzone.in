import {sql} from '../lib/db.mjs';
let failed=false;
for(const key of ['DATABASE_URL','APP_URL','ADMIN_PASSWORD_HASH','ADMIN_TOTP_SECRET','SESSION_SECRET','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET']){const ready=!!process.env[key]&&!process.env[key].includes('generated-by');console.log(`${ready?'OK':'MISSING'} ${key}`);if(!ready)failed=true;}
if(process.env.DATABASE_URL){try{await sql('SELECT id,status FROM tournament_settings WHERE id=1');await sql('SELECT id,order_lock FROM registrations LIMIT 1');console.log('OK Neon connection and database tables');}catch{console.log('FAILED Neon connection/tables. Check DATABASE_URL and run npm run db:setup.');failed=true;}}
console.log('No payment was created and no secret values were printed.');process.exitCode=failed?1:0;
