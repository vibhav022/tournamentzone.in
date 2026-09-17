import {fail} from './security.mjs';
export function registration(body) {
 const out={}; for(const [key,max] of Object.entries({name:100,email:160,phone:16,college:200,year:30,chess_username:25})) {if(typeof body[key]!=='string')throw fail(400,`Please enter ${key.replace('_',' ')}.`); out[key]=body[key].trim();if(out[key].length<2||out[key].length>max)throw fail(400,`Please check ${key.replace('_',' ')}.`);}
 out.email=out.email.toLowerCase(); out.chess_username=out.chess_username.toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw fail(400,'Enter a valid email address.');
 out.phone=out.phone.replace(/[\s+-]/g,'').replace(/^91(?=\d{10}$)/,'');
 if(!/^[6-9]\d{9}$/.test(out.phone))throw fail(400,'Enter a valid 10-digit Indian mobile number.');
 if(!/^[a-z0-9][a-z0-9_-]{1,24}$/i.test(out.chess_username))throw fail(400,'Enter your Chess.com username, not a profile URL.');
 if(!['1st year','2nd year','3rd year','4th year','5th year','6th year','Postgraduate','Other'].includes(out.year))throw fail(400,'Choose your year of study.');
 if(body.consent!==true)throw fail(400,'Please accept the tournament terms and privacy policy.');
 if(body.website)throw fail(400,'Unable to submit this form.'); return out;
}
