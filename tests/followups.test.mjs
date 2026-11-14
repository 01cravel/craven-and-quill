import test from 'node:test';
import assert from 'node:assert/strict';
import {testDb} from './sqlite-d1.mjs';
import {recordFollowupConsent,runFollowups,unsubscribeFollowup,followupStatus,recordPreviewChoice} from '../dist/server/orders.js';

function fixture(){
  const DB=testDb(),sent=[],email='reader@example.test',token=crypto.randomUUID();
  DB.sqlite.prepare(`INSERT INTO customer_quotes (email,size,price_pence,catalogue_version,first_shown_at,last_shown_at,offer_consent_at,unsubscribe_token)
    VALUES (?,?,?,?,?,?,?,?)`).run(email,'a5',3999,'test','2026-10-20T00:00:00.000Z','2026-10-20T00:00:00.000Z','2026-10-20T00:00:00.000Z',token);
  DB.sqlite.exec("UPDATE customer_quotes SET confirmed_view_at=last_shown_at");
  const env={DB,RESEND_API_KEY:'test-key',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push({url,options,body:JSON.parse(options.body)});return Response.json({id:'email-'+sent.length});}};
  return {env,DB,sent,email,token};
}

test('new consent sends one reminder and then a single 10% email after three days',async()=>{
  const {env,DB,sent,email}=fixture();
  await recordFollowupConsent(env,email,'yes');
  assert.deepEqual(await runFollowups(env),{paused:true});
  assert.equal(sent.length,0);
  env.FOLLOWUP_EMAILS_ENABLED='true';
  let result=await runFollowups(env);
  assert.equal(result.first.accepted,1);
  assert.equal(sent.length,1);
  assert.match(sent[0].body.html,/book is waiting/);
  assert.match(sent[0].body.html,/https:\/\/cravenandquill.com\/assets\/craven-quill-gold-logo.png/);
  assert.ok(sent[0].body.text.includes('Stop these emails'));
  DB.sqlite.prepare('UPDATE followup_sequences SET first_sent_at=? WHERE email=?').run('2026-10-20T00:00:00.000Z',email);
  result=await runFollowups(env);
  assert.equal(result.second.accepted,1);
  assert.equal(sent.length,2);
  assert.match(sent[1].body.html,/10% off/);
  assert.equal(DB.sqlite.prepare('SELECT discount_pence FROM customer_quotes WHERE email=?').get(email).discount_pence,250);
  await runFollowups(env);
  assert.equal(sent.length,2);
});

test('unsubscribe and paid orders suppress follow-ups',async()=>{
  const {env,DB,sent,email,token}=fixture();
  await recordFollowupConsent(env,email,'yes');env.FOLLOWUP_EMAILS_ENABLED='true';
  await unsubscribeFollowup(env,token);
  await runFollowups(env);
  assert.equal(sent.length,0);
  await recordFollowupConsent(env,email,'yes');
  DB.sqlite.prepare('UPDATE customer_quotes SET offer_consent_at=?,offer_unsubscribed_at=NULL WHERE email=?').run(new Date().toISOString(),email);
  DB.sqlite.prepare(`INSERT INTO customer_orders (id,token_hash,email,size,amount,status,payment_status,revision,state,created_at,updated_at)
    VALUES (?,?,?,?,?,'awaiting_review','paid',1,'{}',?,?)`).run(crypto.randomUUID(),'hash',email,'a5',3999,new Date().toISOString(),new Date().toISOString());
  await runFollowups(env);
  assert.equal(sent.length,0);
  assert.equal((await followupStatus(env)).firstSent,0);
});

test('neither reminder can use assumed permission or an unverified price',async()=>{
 for(const problem of ['legacy consent','legacy quote']){
  const {env,DB,sent,email}=fixture();
  env.FOLLOWUP_EMAILS_ENABLED='true';
  await recordFollowupConsent(env,email,'yes');
  if(problem==='legacy consent')DB.sqlite.exec("UPDATE followup_sequences SET consent_text='soft opt-in'");
  else DB.sqlite.exec('UPDATE customer_quotes SET confirmed_view_at=NULL');
  await runFollowups(env);
  DB.sqlite.exec("UPDATE followup_sequences SET first_status='accepted', first_sent_at='2020-01-01'");
  await runFollowups(env);
  assert.equal(sent.length,0,problem);
 }
});

test('only a new disclosed preview receives the sequence, without creating a quote',async()=>{
  const DB=testDb(),sent=[],env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push(JSON.parse(options.body));return Response.json({id:'sent'+sent.length});}};
  const email='reader@somewhere.invalid',no='declined@somewhere.invalid';
  for(const address of [email,no]){
    const id=crypto.randomUUID();
    DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(id,address,new Date().toISOString());
    assert.equal(await recordPreviewChoice(env,address,id,address===no),address!==no);
    assert.equal(await recordPreviewChoice(env,address,id,false),address!==no);
  }
  assert.equal((await runFollowups(env)).first.accepted,0);
  DB.sqlite.exec("UPDATE followup_sequences SET consent_at='2020-01-01' WHERE consent_at IS NOT NULL");
  assert.equal((await runFollowups(env)).first.accepted,1);
  DB.sqlite.exec("UPDATE followup_sequences SET first_sent_at='2020-01-01' WHERE first_status='accepted'");
  assert.equal((await runFollowups(env)).second.accepted,1);
  assert.deepEqual(sent.map(x=>x.to[0]),[email,email]);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_quotes').get().n,0);
  const token=DB.sqlite.prepare('SELECT episode_id FROM followup_sequences WHERE email=?').get(email).episode_id;
  assert.equal(await unsubscribeFollowup(env,token),true);
  assert.equal(DB.sqlite.prepare('SELECT consent_at FROM followup_sequences WHERE email=?').get(email).consent_at,null);
});

test('reminder shows the child\'s character when one is saved',async()=>{
  const {env,sent,email}=fixture();
  const store=new Map();env.BOOK_ASSETS={async head(k){return store.has(k)?{}:null;},async get(k){return store.get(k)||null;},async put(k,v){store.set(k,v);}};
  const {sha}=await import('../src/catalog.js');store.set('followup/'+await sha(email),new Uint8Array([255,216]));
  await recordFollowupConsent(env,email,'yes');env.FOLLOWUP_EMAILS_ENABLED='true';
  await runFollowups(env);
  assert.match(sent[0].body.html,/api\/orders\/followup-character\?t=/);
  assert.match(sent[0].body.html,/as we drew them/);
});

test('unsubscribing from the first preview reminder stops the discount email and survives a new submission',async()=>{
  const {env,DB,sent,email}=fixture();
  const preview=crypto.randomUUID();
  DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(preview,email,new Date().toISOString());
  env.FOLLOWUP_EMAILS_ENABLED='true';
  assert.equal(await recordPreviewChoice(env,email,preview,false),true);
  DB.sqlite.exec("UPDATE followup_sequences SET consent_at='2020-01-01'");
  assert.equal((await runFollowups(env)).first.accepted,1);
  const link=sent[0].body.html.match(/href="([^"]+)"[^>]*>Unsubscribe<\/a>/);
  assert.ok(link);
  assert.equal(await unsubscribeFollowup(env,new URL(link[1]).searchParams.get('token')),true);
  assert.equal(await recordPreviewChoice(env,email,preview,false),false);
  DB.sqlite.exec("UPDATE followup_sequences SET first_sent_at='2020-01-01'");
  assert.equal((await runFollowups(env)).second.accepted,0);
  assert.equal(sent.length,1);
});
