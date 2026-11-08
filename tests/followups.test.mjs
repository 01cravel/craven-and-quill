import test from 'node:test';
import assert from 'node:assert/strict';
import {testDb} from './sqlite-d1.mjs';
import {recordFollowupConsent,runFollowups,unsubscribeFollowup,followupStatus} from '../dist/server/orders.js';

function fixture(){
  const DB=testDb(),sent=[],email='reader@example.test',token=crypto.randomUUID();
  DB.sqlite.prepare(`INSERT INTO customer_quotes (email,size,price_pence,catalogue_version,first_shown_at,last_shown_at,offer_consent_at,unsubscribe_token)
    VALUES (?,?,?,?,?,?,?,?)`).run(email,'a5',3999,'test','2026-10-20T00:00:00.000Z','2026-10-20T00:00:00.000Z','2026-10-20T00:00:00.000Z',token);
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
  assert.match(sent[0].body.html,/Their story is still yours to make/);
  assert.match(sent[0].body.html,/https:\/\/cravenandquill.com\/assets\/craven-quill-gold-logo.png/);
  assert.ok(sent[0].body.text.includes('Stop these emails'));
  DB.sqlite.prepare('UPDATE followup_sequences SET first_sent_at=? WHERE email=?').run('2026-10-20T00:00:00.000Z',email);
  result=await runFollowups(env);
  assert.equal(result.second.accepted,1);
  assert.equal(sent.length,2);
  assert.match(sent[1].body.html,/extra 10% off/);
  assert.equal(DB.sqlite.prepare('SELECT discount_pence FROM customer_quotes WHERE email=?').get(email).discount_pence,400);
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
