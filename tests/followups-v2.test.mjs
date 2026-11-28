import test from 'node:test';
import assert from 'node:assert/strict';
import {testDb} from './sqlite-d1.mjs';
import {runFollowups,runFollowupsV2,recordFollowupStage,recordPreviewChoice,v2Status,v2Message,CHASE_NOTICE} from '../dist/server/orders.js';

const H=3600000,ago=h=>new Date(Date.now()-h*H).toISOString();
function setup(email='parent@somewhere.invalid'){
  const DB=testDb(),sent=[],previewId=crypto.randomUUID();
  const env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'k',ORDER_EMAIL_FROM:'Craven & Quill <books@cq.invalid>',ORDER_LINK_SECRET:'s'.repeat(40),
    async fetch(url,o){sent.push(JSON.parse(o.body));return Response.json({id:'e'+sent.length});}};
  DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(previewId,email,ago(5));
  DB.sqlite.exec("CREATE TABLE IF NOT EXISTS followup_details (email TEXT PRIMARY KEY, names TEXT, title TEXT, updated_at TEXT NOT NULL)");
  DB.sqlite.prepare("INSERT INTO followup_details VALUES (?,?,?,?)").run(email,'Finley','Finley’s Missing Bunny','2026-11-28');
  return {DB,env,sent,email,previewId};
}
function order(DB,email,{emails={},paid=false}={}){
  const id=crypto.randomUUID();
  DB.sqlite.prepare("INSERT INTO customer_orders(id,token_hash,email,size,amount,status,payment_status,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id,'h',email,'a4',3958,paid?'awaiting_review':'saved',paid?'paid':'unpaid',JSON.stringify({names:'Finley',story:{title:'Finley’s Missing Bunny'},emails}),ago(100),ago(1));
  return id;
}
const bookLink=async(o,q)=>`https://cravenandquill.com/book.html?id=${o.id}&${q}#key=x`;

test('v2: stalled checkout email goes once, an hour after the pay page, from Luke',async()=>{
  const {DB,env,sent,email,previewId}=setup();
  assert.equal(await recordPreviewChoice(env,email,previewId,false,CHASE_NOTICE),true);
  assert.equal(await recordFollowupStage(env,'someone@else.invalid',previewId,'pay'),false,'only the preview owner counts');
  assert.equal(await recordFollowupStage(env,email,previewId,'pay'),true);
  let r=await runFollowups(env);assert.equal(sent.length,0,'not before an hour');assert.equal(r.paused,true,'old flows stay stopped');
  DB.sqlite.prepare('UPDATE followup_v2 SET pay_at=?').run(ago(1.5));
  r=await runFollowups(env);assert.equal(r.v2.stall.accepted,1);
  assert.equal(sent[0].subject,'Pick up where you left off with Finley’s book');
  assert.equal(sent[0].from,'Luke at Craven & Quill <books@cq.invalid>');
  assert.match(sent[0].text,/10% first-order discount/);assert.match(sent[0].text,/utm_content=stall/);
  assert.ok(sent[0].headers['List-Unsubscribe']);
  await runFollowups(env);assert.equal(sent.length,1,'never twice');
});

test('v2: nothing for people who ticked "just the link", paid, or are too old',async()=>{
  const {DB,env,sent,email,previewId}=setup();
  assert.equal(await recordPreviewChoice(env,email,previewId,true,CHASE_NOTICE),false);
  await recordFollowupStage(env,email,previewId,'pay');DB.sqlite.prepare('UPDATE followup_v2 SET pay_at=?').run(ago(2));
  await runFollowups(env);assert.equal(sent.length,0,'opted out');
  const b=setup('buyer@somewhere.invalid');await recordPreviewChoice(b.env,b.email,b.previewId,false,CHASE_NOTICE);order(b.DB,b.email,{paid:true});
  await recordFollowupStage(b.env,b.email,b.previewId,'pay');b.DB.sqlite.prepare('UPDATE followup_v2 SET pay_at=?').run(ago(2));
  await runFollowups(b.env);assert.equal(b.sent.length,0,'already paid');
  const c=setup('late@somewhere.invalid');await recordPreviewChoice(c.env,c.email,c.previewId,false,CHASE_NOTICE);
  await recordFollowupStage(c.env,c.email,c.previewId,'pay');c.DB.sqlite.prepare('UPDATE followup_v2 SET pay_at=?').run(ago(50));
  await runFollowups(c.env);assert.equal(c.sent.length,0,'never sent late');
});

test('v2: day-3 follow-up after the whole book depends on whether they opened it, and respects the cap of three',async()=>{
  const {DB,env,sent,email,previewId}=setup();
  await recordPreviewChoice(env,email,previewId,false,CHASE_NOTICE);
  const id=order(DB,email,{emails:{preview:{sent:true,at:ago(40)}}});
  await runFollowupsV2(env,{bookLink});assert.equal(sent.length,0,'too soon');
  DB.sqlite.prepare('UPDATE customer_orders SET state=? WHERE id=?').run(JSON.stringify({names:'Finley',story:{title:'Finley’s Missing Bunny'},emails:{preview:{sent:true,at:ago(65)}}}),id);
  DB.sqlite.prepare("INSERT INTO order_audit VALUES (?,?,?,?,?,?)").run(crypto.randomUUID(),id,'customer_opened_book','customer','{}',ago(60));
  let r=await runFollowupsV2(env,{bookLink});assert.equal(r.nudge.read,1);
  assert.equal(sent[0].subject,'Anything you’d like changed in Finley’s book?');assert.match(sent[0].text,/book\.html\?id=.*utm_content=read/);
  await runFollowupsV2(env,{bookLink});assert.equal(sent.length,1,'once');
  // Never opened: the link once more.
  const u=setup('quiet@somewhere.invalid');await recordPreviewChoice(u.env,u.email,u.previewId,false,CHASE_NOTICE);order(u.DB,u.email,{emails:{preview:{sent:true,at:ago(70)}}});
  r=await runFollowupsV2(u.env,{bookLink});assert.equal(r.nudge.unopened,1);assert.equal(u.sent[0].subject,'Finley’s whole book is ready to read');
  // Already had three emails (stall + two whole-book emails): nothing more.
  const c=setup('capped@somewhere.invalid');await recordPreviewChoice(c.env,c.email,c.previewId,false,CHASE_NOTICE);
  order(c.DB,c.email,{emails:{preview:{sent:true,at:ago(100)},rescue:{sent:true,at:ago(70)}}});
  await recordFollowupStage(c.env,c.email,c.previewId,'pay');c.DB.sqlite.prepare("UPDATE followup_v2 SET stall_status='accepted'").run();
  r=await runFollowupsV2(c.env,{bookLink});assert.equal(c.sent.length,0);assert.equal(r.nudge.skipped,1);
});

test('v2: dashboard lists who is ready for a whole book, pay page first',async()=>{
  const {env,email,previewId}=setup();await recordPreviewChoice(env,email,previewId,false,CHASE_NOTICE);
  await recordFollowupStage(env,email,previewId,'size');
  let s=await v2Status(env);assert.equal(s.queue.length,1);assert.equal(s.queue[0].reached,'size page');assert.equal(s.queue[0].names,'Finley');
  await recordFollowupStage(env,email,previewId,'pay');s=await v2Status(env);assert.equal(s.queue[0].reached,'pay page');
});

test('v2: Christmas date only while it is true',()=>{
  const m=v2Message('stall',{names:'Ada',link:'https://x',unsub:'https://u',today:Date.parse('2026-12-01')});assert.match(m.text,/14 December/);
  const n=v2Message('stall',{names:'Ada',link:'https://x',unsub:'https://u',today:Date.parse('2026-12-20')});assert.doesNotMatch(n.text,/December/);
});
