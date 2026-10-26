const OWNER_EMAIL='cravenluke@gmail.com';
const LINK_LIFETIME_MS=15*60*1000;
const SESSION_LIFETIME_MS=12*60*60*1000;
const COOKIE='__Host-cq_owner';
const TABLES=[
  'CREATE TABLE IF NOT EXISTS owner_login_links (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, used_at TEXT)',
  'CREATE TABLE IF NOT EXISTS owner_login_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS owner_login_rate (id INTEGER PRIMARY KEY CHECK(id=1), last_sent_at TEXT NOT NULL, day TEXT NOT NULL, day_count INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS owner_alert_test (id INTEGER PRIMARY KEY CHECK(id=1), claimed_at TEXT NOT NULL, provider_id TEXT)'
];
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const html=(text,status=200,extra={})=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owner sign-in | Craven &amp; Quill</title><style>body{font:16px/1.5 system-ui;background:#f7f8fa;color:#17212b;margin:0;padding:8vh 20px}main{max-width:420px;margin:auto;padding:32px;background:white;border:1px solid #dde3e8;border-radius:16px}button{background:#263d53;color:white;border:0;border-radius:8px;padding:12px 18px;font:inherit;cursor:pointer}a{color:#263d53}</style><main>${text}</main></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8',...extra}});
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
async function digest(token){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
async function tables(env){for(const sql of TABLES)await env.DB.prepare(sql).run();}
function sameOrigin(req){
  const origin=req.headers.get('Origin'),site=req.headers.get('Sec-Fetch-Site'),expected=new URL(req.url).origin;
  return site!=='cross-site'&&(origin===expected||((origin===null||origin==='null')&&site==='same-origin'));
}
async function form(req){
  if(!req.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')||Number(req.headers.get('Content-Length')||0)>4096)throw Error('Invalid form');
  const reader=req.body?.getReader();if(!reader)throw Error('Invalid form');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error('Invalid form');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new URLSearchParams(new TextDecoder().decode(bytes));
}

export async function ownerSession(req,env){
  if(!env.DB)return null;
  const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-cq_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token)return null;
  await tables(env);
  const row=await env.DB.prepare('SELECT token_hash FROM owner_login_sessions WHERE token_hash=?1 AND expires_at>?2').bind(await digest(token),new Date().toISOString()).first();
  return row?OWNER_EMAIL:null;
}

export async function ownerAuth(req,env){
  const u=new URL(req.url),path=u.pathname;
  if(!path.startsWith('/api/owner-auth/'))return null;
  if(!env.DB)return html('<h1>Sign-in is temporarily unavailable</h1><p>Please try again shortly.</p>',503);
  await tables(env);
  if(path==='/api/owner-auth/test-alert'&&req.method==='POST'){
    if(!sameOrigin(req))return Response.json({error:'Request refused.'},{status:403,headers});
    if(!await ownerSession(req,env))return Response.json({error:'Sign in to the order dashboard first.'},{status:401,headers});
    if(!env.RESEND_API_KEY||!env.ORDER_EMAIL_FROM)return Response.json({error:'Craven & Quill email is unavailable.'},{status:503,headers});
    const claim=await env.DB.prepare('INSERT OR IGNORE INTO owner_alert_test (id,claimed_at,provider_id) VALUES (1,?1,NULL) RETURNING id').bind(new Date().toISOString()).first();
    if(!claim)return Response.json({error:'This one-time test alert was already requested. Check your inbox.'},{status:409,headers});
    const message='TEST ONLY. No book was bought or quoted.\n\nThis is how a Craven & Quill owner alert could arrive when a customer buys a book or receives a quote.\n\nOpen your order dashboard: '+u.origin+'/orders\n\nAutomatic owner alerts are not enabled yet.';
    try{
      const r=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'cq-owner-alert-one-time-test'},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,reply_to:env.ORDER_EMAIL_REPLY_TO||OWNER_EMAIL,to:[OWNER_EMAIL],subject:'TEST ONLY: Craven & Quill owner alert',text:message}),signal:AbortSignal.timeout(15000)});
      const result=await r.json();
      if(!r.ok||!result.id){console.error('Owner test alert rejected',r.status);await env.DB.prepare('DELETE FROM owner_alert_test WHERE id=1').run();return Response.json({error:'The email provider rejected the test alert.'},{status:503,headers});}
      await env.DB.prepare('UPDATE owner_alert_test SET provider_id=?1 WHERE id=1').bind(result.id).run();
      return Response.json({message:'Craven & Quill email provider accepted the test alert. Inbox delivery is not yet confirmed.'},{headers});
    }catch{console.error('Owner test alert result uncertain');return Response.json({error:'Email result is uncertain. Check your inbox before trying again.'},{status:503,headers});}
  }
  if(path==='/api/owner-auth/request'&&req.method==='POST'){
    if(!sameOrigin(req))return html('<h1>Request refused</h1><p>Reload the sign-in page and try again.</p>',403);
    let fields;try{fields=await form(req);}catch{return html('<h1>Invalid request</h1>',400);}
    const email=String(fields.get('email')||'').trim().toLowerCase();
    if(email===OWNER_EMAIL&&env.RESEND_API_KEY&&env.ORDER_EMAIL_FROM){
      const stamp=new Date(),day=stamp.toISOString().slice(0,10),at=stamp.toISOString();
      await env.DB.prepare("INSERT OR IGNORE INTO owner_login_rate (id,last_sent_at,day,day_count) VALUES (1,'1970-01-01T00:00:00.000Z',?1,0)").bind(day).run();
      const claim=await env.DB.prepare('UPDATE owner_login_rate SET last_sent_at=?1,day=?2,day_count=CASE WHEN day=?2 THEN day_count+1 ELSE 1 END WHERE id=1 AND last_sent_at<?3 AND (day<>?2 OR day_count<10) RETURNING id').bind(at,day,new Date(stamp.getTime()-60000).toISOString()).first();
      if(!claim)return html('<h1>Please wait a minute</h1><p>Check your inbox first, then request another link if needed.</p>',429);
      if(claim){
        const token=randomToken(),hash=await digest(token),expires=new Date(stamp.getTime()+LINK_LIFETIME_MS).toISOString();
        await env.DB.prepare('INSERT INTO owner_login_links (token_hash,expires_at,used_at) VALUES (?1,?2,NULL)').bind(hash,expires).run();
        const link=`${u.origin}/api/owner-auth/confirm?token=${token}`;
        try{
          const r=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'cq-owner-login-'+hash},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,to:[OWNER_EMAIL],subject:'Your Craven & Quill dashboard sign-in link',text:`Open this link to sign in to your order dashboard. It expires in 15 minutes and works once. If you did not request it, ignore this email.\n\n${link}`}),signal:AbortSignal.timeout(15000)});
          const result=await r.json();if(!r.ok||!result.id){console.error('Owner sign-in email rejected',r.status);return html('<h1>Email unavailable</h1><p>Please try again in a minute.</p>',503);}
        }catch{console.error('Owner sign-in email could not be confirmed');return html('<h1>Email result uncertain</h1><p>Check your inbox, then try again in a minute if nothing arrives.</p>',503);}
      }
    }else if(email===OWNER_EMAIL)return html('<h1>Email unavailable</h1><p>Please try again shortly.</p>',503);
    return html('<h1>Check your email</h1><p>If this is the owner address, a sign-in link has been requested. Check your inbox and spam folder.</p><p><a href="/owner-login.html">Request another link</a></p>');
  }
  if(path==='/api/owner-auth/confirm'&&req.method==='GET'){
    const token=u.searchParams.get('token')||'';
    if(!/^[a-f0-9]{64}$/.test(token))return html('<h1>Invalid link</h1><p><a href="/owner-login.html">Request a new one</a>.</p>',400);
    const row=await env.DB.prepare('SELECT token_hash FROM owner_login_links WHERE token_hash=?1 AND used_at IS NULL AND expires_at>?2').bind(await digest(token),new Date().toISOString()).first();
    if(!row)return html('<h1>Link expired or used</h1><p><a href="/owner-login.html">Request a new one</a>.</p>',400);
    return html(`<h1>Sign in to your dashboard</h1><p>This one-use link signs you in for 12 hours.</p><form method="post" action="/api/owner-auth/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Sign in</button></form>`);
  }
  if(path==='/api/owner-auth/confirm'&&req.method==='POST'){
    if(!sameOrigin(req))return html('<h1>Request refused</h1>',403);
    let fields;try{fields=await form(req);}catch{return html('<h1>Invalid request</h1>',400);}
    const token=String(fields.get('token')||'');
    if(!/^[a-f0-9]{64}$/.test(token))return html('<h1>Invalid link</h1>',400);
    const used=await env.DB.prepare('UPDATE owner_login_links SET used_at=?1 WHERE token_hash=?2 AND used_at IS NULL AND expires_at>?1 RETURNING token_hash').bind(new Date().toISOString(),await digest(token)).first();
    if(!used)return html('<h1>Link expired or used</h1><p><a href="/owner-login.html">Request a new one</a>.</p>',400);
    const session=randomToken(),expires=new Date(Date.now()+SESSION_LIFETIME_MS).toISOString();
    await env.DB.prepare('INSERT INTO owner_login_sessions (token_hash,expires_at) VALUES (?1,?2)').bind(await digest(session),expires).run();
    return new Response(null,{status:303,headers:{...headers,Location:'/orders.html','Set-Cookie':`${COOKIE}=${session}; Path=/; Max-Age=${SESSION_LIFETIME_MS/1000}; HttpOnly; Secure; SameSite=Lax`}});
  }
  if(path==='/api/owner-auth/logout'&&req.method==='POST'){
    if(!sameOrigin(req))return html('<h1>Request refused</h1>',403);
    const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-cq_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(token)await env.DB.prepare('DELETE FROM owner_login_sessions WHERE token_hash=?1').bind(await digest(token)).run();
    return new Response(null,{status:303,headers:{...headers,Location:'/owner-login.html','Set-Cookie':`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`}});
  }
  return html('<h1>Page not found</h1>',404);
}
