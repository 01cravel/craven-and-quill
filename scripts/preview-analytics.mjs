// LOCAL QA ONLY. In-memory database filled with invented visits, signed in as a mock owner. Never contacts a provider.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import worker from '../dist/server/index.js';
import {testDb} from '../tests/sqlite-d1.mjs';
import {seedAnalytics} from '../tests/analytics-seed.mjs';
const root=resolve('dist/client'),DB=testDb(),store=new Map(),ownerToken=createHash('sha256').update('local-qa-owner').digest('hex');
DB.sqlite.exec('CREATE TABLE IF NOT EXISTS owner_login_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL)');
DB.sqlite.prepare('INSERT INTO owner_login_sessions VALUES (?,?)').run(createHash('sha256').update(ownerToken).digest('hex'),'2999-01-01T00:00:00.000Z');
const objects={async put(k,b,o){store.set(k,{bytes:new Uint8Array(b),type:o.httpMetadata.contentType});},async get(k){const x=store.get(k);return x&&{httpMetadata:{contentType:x.type},arrayBuffer:async()=>x.bytes.buffer.slice(x.bytes.byteOffset,x.bytes.byteOffset+x.bytes.byteLength)};}};
const {orders}=seedAnalytics(DB,{days:Number(process.env.CQ_QA_DAYS||14),visits:Number(process.env.CQ_QA_VISITS||260)});
// Public sample portraits stand in for saved characters.
const portraits=['amara-book-portrait/page-01.jpg'];
for(const o of orders){const key=crypto.randomUUID();await objects.put(`orders/${o.id}/${key}`,await readFile(root+'/assets/'+portraits[0]),{httpMetadata:{contentType:'image/jpeg'}});const row=DB.sqlite.prepare('SELECT state FROM customer_orders WHERE id=?').get(o.id),state=JSON.parse(row.state);state.characters=[key];state.art={cover:null,scenes:[]};DB.sqlite.prepare('UPDATE customer_orders SET state=? WHERE id=?').run(JSON.stringify(state),o.id);}
const today=new Date().toISOString().slice(0,10);
DB.sqlite.exec(`CREATE TABLE IF NOT EXISTS owner_ad_spend (day TEXT NOT NULL, creative TEXT NOT NULL, pence INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (day, creative))`);
for(let i=0;i<5;i++){const day=new Date(Date.now()-i*86400000).toISOString().slice(0,10);DB.sqlite.prepare('INSERT INTO owner_ad_spend VALUES (?,?,?,?)').run(day,'d_video',520,today);DB.sqlite.prepare('INSERT INTO owner_ad_spend VALUES (?,?,?,?)').run(day,'d_static',480,today);}
const env={DB,BOOK_ASSETS:objects,ORDER_LINK_SECRET:'local-qa-only',ASSETS:{async fetch(req){let path=resolve(root,'.'+new URL(req.url).pathname);if(!path.startsWith(root+'/'))return new Response('',{status:404});try{const bytes=await readFile(path);return new Response(bytes,{headers:{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'})[extname(path)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}}},fetch(){throw new Error('Provider requests are disabled in local QA');}};
createServer(async(req,res)=>{try{const parts=[];for await(const p of req)parts.push(p);const headers=new Headers(req.headers);if(/^(localhost|127\.0\.0\.1):/.test(String(req.headers.host||'')))headers.set('Cookie','__Host-cq_owner='+ownerToken);const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});const r=await worker.fetch(request,env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(500);res.end('Local QA: '+e.message);}}).listen(Number(process.env.CQ_QA_PORT||4323),'127.0.0.1',()=>{console.log('LOCAL QA, INVENTED DATA, MOCK OWNER SIGN-IN');console.log('http://127.0.0.1:'+Number(process.env.CQ_QA_PORT||4323)+'/analytics');});
