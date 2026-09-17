import {createInterface} from 'node:readline/promises';import {randomBytes} from 'node:crypto';import {writeFile,readFile} from 'node:fs/promises';import {passwordHash} from '../lib/security.mjs';
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
 try{await readFile('.env.local');console.log('.env.local already exists. Keep it safe. Rename it yourself before running setup again.');process.exitCode=1;rl.close();}catch{
 const presetHash='c6642a2d359d7111a1c64460a0aca3f5:706768afaa13053d5d42c5d74425ff601abdb2dbcdd28ed085c3717243725990d56b2412cc16a4f4d94d1f366bd6e540f06532e6b592e3f4e81f3244c9f9db1e';
 const password=await rl.question('Press Enter to use your requested admin password, or type a new password (visible): ');if(password && password.length<12)throw Error('Use a password of at least 12 characters.');
 const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';const bytes=randomBytes(20);let bits=[...bytes].map(b=>b.toString(2).padStart(8,'0')).join('');let secret='';for(let i=0;i<bits.length;i+=5)secret+=chars[parseInt(bits.slice(i,i+5),2)];
 const content=`DATABASE_URL=\nAPP_URL=http://localhost:3000\nADMIN_PASSWORD_HASH=${password ? passwordHash(password) : presetHash}\nADMIN_TOTP_SECRET=${secret}\nSESSION_SECRET=${randomBytes(48).toString('hex')}\nRAZORPAY_KEY_ID=\nRAZORPAY_KEY_SECRET=\nRAZORPAY_WEBHOOK_SECRET=\n`;
 await writeFile('.env.local',content,{mode:0o600,flag:'wx'});console.log('\nCreated private .env.local. Add the Neon and Razorpay values there.\nAdd an account manually in Google/Microsoft Authenticator:\nName: Tournament Zone Admin\nType: Time based\nSecret: '+secret+'\n\nNever share this secret or commit .env.local. Copy its values into Vercel Environment Variables when deploying.');rl.close();}
}catch(e){console.error(e.message);rl.close();process.exitCode=1;}
