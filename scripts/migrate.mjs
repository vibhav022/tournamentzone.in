import {readFile} from 'node:fs/promises';
import {sql} from '../lib/db.mjs';
for(const statement of (await readFile(new URL('../schema.sql',import.meta.url),'utf8')).split(';').map(x=>x.trim()).filter(Boolean)) await sql(statement);
console.log('Neon database tables are ready. You can now sign in to /admin.');
