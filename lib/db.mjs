export async function sql(query, params = []) {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw Object.assign(new Error('Database is not configured. Please contact the organiser.'), {status:503});
  const host = new URL(connection).hostname;
  if (!host.endsWith('.neon.tech')) throw new Error('Use the Neon connection string for DATABASE_URL.');
  const response = await fetch(`https://${host}/sql`, {method:'POST',headers:{'Content-Type':'application/json','Neon-Connection-String':connection,'Neon-Raw-Text-Output':'false','Neon-Array-Mode':'false'},body:JSON.stringify({query,params:params.map(value=>value==null?null:value instanceof Date?value.toISOString():String(value))}),signal:AbortSignal.timeout(12000)});
  const data = await response.json();
  if (!response.ok) { const error = new Error('Database request failed'); error.code=data.code; throw error; }
  return data.rows || [];
}
export async function config() {const [row]=await sql('SELECT * FROM tournament_settings WHERE id=1'); if(!row) throw new Error('Run npm run db:setup first'); return row;}
