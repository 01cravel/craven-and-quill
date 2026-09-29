import assert from 'node:assert/strict';
import test from 'node:test';
import {campaignApi,beginPreview,finishPreview,CONSENT_VERSION} from '../dist/server/campaign.js';
import {testDb} from './sqlite-d1.mjs';

const request=(path,input,headers={})=>new Request('https://example.com/api/'+path,{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json','CF-IPCountry':'GB',...headers},body:JSON.stringify(input)});
async function setup(){const env={DB:testDb(),SIGNUPS_EXPORT_TOKEN:'test-only'};const previewId=await beginPreview(env);await finishPreview(env,previewId,'succeeded');return {env,input:{email:'Reader@example.com',previewId,product:'bundle',purchaseIntent:true,consent:true,consentVersion:CONSENT_VERSION,source:'meta',medium:'paid_social',campaign:'cq_uk_validation_2026',creative:'reveal'}};}
const submit=(env,input)=>campaignApi(request('launch-signup',input),env);

test('saves a unique lead only after a successful preview and records price/consent on server',async()=>{
  const {env,input}=await setup();assert.equal((await submit(env,{...input,price_pence:1})).status,200);
  const lead=env.DB.sqlite.prepare('SELECT * FROM launch_leads').get();
  assert.equal(lead.email,'reader@example.com');assert.equal(lead.price_pence,4999);assert.equal(lead.country,'GB');assert.equal(lead.campaign,'cq_uk_validation_2026');assert.equal(lead.visit_id,null);assert.match(lead.consent_text,/Email me/);
  await submit(env,{...input,email:'READER@EXAMPLE.COM',creative:'other'});
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM launch_leads').get().n,1);
  assert.equal(env.DB.sqlite.prepare('SELECT creative FROM launch_leads').get().creative,'reveal');
});
test('rejects missing consent, invalid format, expired/failed/missing preview and cross-site posts',async()=>{
  const {env,input}=await setup();
  for(const change of [{purchaseIntent:false},{consent:false},{consentVersion:'old'},{product:'__proto__'},{previewId:crypto.randomUUID()},{email:'bad'},{website:'bot'}])assert.equal((await submit(env,{...input,...change})).status,400);
  assert.equal((await campaignApi(request('launch-signup',input,{Origin:'https://attacker.example'}),env)).status,403);
  await finishPreview(env,input.previewId,'failed');assert.equal((await submit(env,input)).status,400);
  env.DB.sqlite.prepare('UPDATE preview_receipts SET status=?,created_at=?').run('succeeded','2020-01-01T00:00:00Z');assert.equal((await submit(env,input)).status,400);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM launch_leads').get().n,0);
});
test('a failed database save never claims the lead was saved',async()=>{
  const {env,input}=await setup();env.DB.sqlite.exec('DROP TABLE launch_leads');
  const response=await submit(env,input);assert.equal(response.status,503);assert.equal((await response.json()).ok,undefined);
});
test('measurement requires permission and deduplicates each visit event',async()=>{
  const {env,input}=await setup();const visitId=crypto.randomUUID();const event={...input,visitId,event:'landing_view',measurementConsent:true};
  assert.equal((await campaignApi(request('campaign-event',{...event,measurementConsent:false}),env)).status,400);
  await campaignApi(request('campaign-event',event),env);await campaignApi(request('campaign-event',event),env);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM campaign_events').get().n,1);
  await submit(env,{...input,visitId,measurementConsent:true});
  // A second subscriber without measurement permission must not inflate the measured rate.
  await submit(env,{...input,email:'other@example.com'});
  const response=await campaignApi(new Request('https://example.com/api/campaign-report',{headers:{Authorization:'Bearer test-only'}}),env);
  const report=await response.json();assert.equal(response.status,200);assert.equal(report.leads[0].signups,2);assert.deepEqual(report.measuredConversion,{visitors:1,converted_visitors:1});
});
test('exports require bearer auth; unsubscribe excludes email from export; renewed permission reactivates',async()=>{
  const {env,input}=await setup();await submit(env,input);
  for(const path of ['campaign-report','launch-signups.csv?token=test-only'])assert.equal((await campaignApi(new Request('https://example.com/api/'+path),env)).status,404);
  const exportRequest=()=>new Request('https://example.com/api/launch-signups.csv',{headers:{Authorization:'Bearer test-only'}});
  assert.match(await(await campaignApi(exportRequest(),env)).text(),/reader@example.com/);
  const token=env.DB.sqlite.prepare('SELECT unsubscribe_token FROM launch_leads').get().unsubscribe_token;
  assert.equal((await campaignApi(request('unsubscribe',{token}),env)).status,200);
  assert.doesNotMatch(await(await campaignApi(exportRequest(),env)).text(),/reader@example.com/);
  await submit(env,{...input,product:'digital'});
  const row=env.DB.sqlite.prepare('SELECT * FROM launch_leads').get();assert.equal(row.unsubscribed_at,null);assert.equal(row.price_pence,1900);
});
test('daily drawing ceiling is durable across requests and does not exceed the limit',async()=>{
  const env={DB:testDb(),PREVIEW_DAILY_LIMIT:'2'};await beginPreview(env);await beginPreview(env);
  await assert.rejects(()=>beginPreview(env),/Today/);
  assert.equal(env.DB.sqlite.prepare('SELECT attempts FROM preview_daily_usage').get().attempts,2);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM preview_receipts').get().n,2);
});
test('malformed, oversized and null bodies are rejected without writing',async()=>{
  const {env}=await setup();for(const input of [null,[],{email:'x'.repeat(5000)}])assert.equal((await campaignApi(request('launch-signup',input),env)).status,400);
});

test('conversion receipt is random, stable on duplicate saves, and never an unsubscribe token',async()=>{
  const {env,input}=await setup();const a=await(await submit(env,input)).json(),b=await(await submit(env,input)).json();
  assert.match(a.eventId,/^[0-9a-f-]{36}$/);assert.equal(a.eventId,b.eventId);
  const lead=env.DB.sqlite.prepare('SELECT * FROM launch_leads').get();assert.notEqual(a.eventId,lead.unsubscribe_token);assert.equal(lead.purchase_intent,1);
});
test('report isolates the experiment, dates, active intent and UK paid acquisition',async()=>{
  const {env,input}=await setup();
  for(const change of [{},{email:'qa@example.com',campaign:'cq_qa_2026'},{email:'else@example.com',campaign:'old_test'},{email:'unsub@example.com'}])await submit(env,{...input,...change});
  env.DB.sqlite.prepare("UPDATE launch_leads SET unsubscribed_at='2026-09-29T01:00:00.000Z' WHERE email='unsub@example.com'").run();
  const report=await(await campaignApi(new Request('https://example.com/api/campaign-report?since=2020-01-01T00:00:00.000Z&until=2099-01-01T00:00:00.000Z&campaign=cq_uk_validation_2026',{headers:{Authorization:'Bearer test-only'}}),env)).json();
  assert.equal(report.leads.length,1);assert.equal(report.leads[0].qualified_signups,1);assert.equal(report.products[0].signups,1);
  const past=await(await campaignApi(new Request('https://example.com/api/campaign-report?since=2020-01-01&until=2021-01-01',{headers:{Authorization:'Bearer test-only'}}),env)).json();assert.equal(past.leads.length,0);
});
test('ad configuration exposes only a valid public pixel id and fails closed',async()=>{
  const {env}=await setup();
  for(const value of [undefined,'<script>', ''])assert.deepEqual(await(await campaignApi(new Request('https://example.com/api/ad-config'),{...env,META_PIXEL_ID:value})).json(),{pixelId:null});
  assert.deepEqual(await(await campaignApi(new Request('https://example.com/api/ad-config'),{...env,META_PIXEL_ID:'1234567890'})).json(),{pixelId:'1234567890'});
});
