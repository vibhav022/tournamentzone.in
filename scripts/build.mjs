import {cp,mkdir,rm,readdir} from 'node:fs/promises';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await check(path);else if(/\.(mjs|js)$/.test(path))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});}}
for(const dir of ['api','lib','public','scripts'])await check(dir);
await rm('dist',{recursive:true,force:true});await mkdir('dist');await cp('public','dist',{recursive:true});console.log('Syntax checks and production asset build passed. Vercel will deploy api/index.js as a Node function.');
