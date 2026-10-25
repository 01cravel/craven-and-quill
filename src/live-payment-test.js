import {requireThat} from './catalog.js';
// Owner-only, one £1 diagnostic payment. Never creates a customer_order or calls Prodigi.
export async function livePaymentTest(req,env,{admin,ziina,matchZiina}) {
 requireThat(admin(req,env),'Sign in with the site owner’s ChatGPT account.',401);
 requireThat(env.DB,'Test storage unavailable.',503);
 const sql=(s,...args)=>env.DB.prepare(s).bind(...args);
 await sql('CREATE TABLE IF NOT EXISTS live_payment_test (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)').run();
 const read=async()=>{const row=await sql('SELECT state FROM live_payment_test WHERE id=1').first();return row?JSON.parse(row.state):null;};
 let persisted;const write=async t=>{const next=JSON.stringify(t),changed=await sql('UPDATE live_payment_test SET state=?1 WHERE id=1 AND state=?2 RETURNING id',next,persisted).first();requireThat(changed,'Test changed. Refresh before continuing.',409);persisted=next;};
 const result=t=>Response.json({test:t,amountPence:100,currency:'GBP',printing:'Permanently excluded: this is not a book order.'},{headers:{'Cache-Control':'no-store'}});
 let t=await read();persisted=t?JSON.stringify(t):null;if(req.method==='GET')return result(t);
 requireThat(req.method==='POST','Use POST.',405);
 requireThat(req.headers.get('origin')===new URL(req.url).origin&&req.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused.',403);
 const text=await req.text();requireThat(text.length<1000,'Request too large.',413);const b=JSON.parse(text);
 requireThat(env.ZIINA_ACCESS_TOKEN&&env.ZIINA_ACCOUNT_ID,'Ziina is not connected.',503);
 const payment=async()=>{requireThat(t?.paymentId,'No confirmed payment reference. Check Ziina before retrying.',409);return matchZiina(await ziina(env,'/payment_intent/'+encodeURIComponent(t.paymentId)),{session_id:t.paymentId,amount:100,data:{payment:{accountId:t.accountId}}});};
 if(b.action==='create'){
  requireThat(b.confirm===true,'Confirm the £1 live test.');
  if(t)return result(t);
  t={status:'creating',accountId:env.ZIINA_ACCOUNT_ID,createdAt:new Date().toISOString(),amountPence:100,currency:'GBP'};
  const claim=await sql('INSERT OR IGNORE INTO live_payment_test (id,state) VALUES (1,?1) RETURNING id',JSON.stringify(t)).first();requireThat(claim,'A test already exists. Refresh instead.',409);
  persisted=JSON.stringify(t);try{const link=new URL('/payment-test.html',req.url).href,p=await ziina(env,'/payment_intent',{amount:100,currency_code:'GBP',message:'Craven & Quill £1 live payment/refund test. No book or printing.',test:false,allow_tips:false,success_url:link,cancel_url:link,failure_url:link});
   requireThat(typeof p.id==='string'&&p.id.length<100,'Missing payment reference.',502);t.paymentId=p.id;
   matchZiina(p,{session_id:p.id,amount:100,data:{payment:{accountId:t.accountId}}});const u=new URL(p.redirect_url);requireThat(u.protocol==='https:'&&(u.hostname==='ziina.com'||u.hostname.endsWith('.ziina.com'))&&!u.username&&!u.password,'Invalid payment link.',502);
   t.url=u.href;t.status=p.status;await write(t);
  }catch(e){t.status='creation_unknown';await write(t);throw e;}
 }else if(b.action==='refresh'){
  const p=await payment();t.status=p.status;t.checkedAt=new Date().toISOString();await write(t);
 }else if(b.action==='refund'){
  requireThat(b.confirm===true,'Confirm refund of the original £1 payment.');requireThat(!t?.refund,'A refund was already requested. Check its status; never repeat it.',409);
  const p=await payment();requireThat(p.status==='completed','The payment is not completed.',409);
  const prior=JSON.stringify(t);t.status=p.status;t.refund={id:crypto.randomUUID(),status:'requesting'};
  const claim=await sql('UPDATE live_payment_test SET state=?1 WHERE id=1 AND state=?2 RETURNING id',JSON.stringify(t),prior).first();requireThat(claim,'Another request is running. Refresh.',409);
  persisted=JSON.stringify(t);try{const r=await ziina(env,'/refund',{id:t.refund.id,payment_intent_id:t.paymentId,amount:100,currency_code:'GBP',test:false});checkRefund(r);t.refund.status=r.status;}catch(e){t.refund.status='unknown';await write(t);throw e;}await write(t);
 }else if(b.action==='refund-status'){
  requireThat(t?.refund?.id,'No refund exists.',409);const r=await ziina(env,'/refund/'+encodeURIComponent(t.refund.id));checkRefund(r);t.refund.status=r.status;await write(t);
 }else requireThat(false,'Unknown test action.');
 function checkRefund(r){requireThat(r.id===t.refund.id&&r.payment_intent_id===t.paymentId&&r.amount===100&&r.currency_code==='GBP'&&['pending','completed','failed'].includes(r.status),'Refund response did not match this test.',502);}
 return result(await read());
}
