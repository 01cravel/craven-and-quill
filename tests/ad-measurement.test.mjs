import test from 'node:test';
import assert from 'node:assert/strict';
import {testDb} from './sqlite-d1.mjs';
import {AD_CONSENT_VERSION,adConsent,adConfig,adFeed,purchaseConversion,leadConversion} from '../dist/server/ad-measurement.js';
import {campaignApi} from '../dist/server/campaign.js';
const consent={visitId:crypto.randomUUID(),advertisingConsent:true,advertisingConsentVersion:AD_CONSENT_VERSION,gclid:'CaseSensitive_AbC-123'};
const env=()=>({DB:testDb(),ORDER_LINK_SECRET:'test-only',GOOGLE_ADS_FEED_PASSWORD:'p'.repeat(40)});
const order=(change={})=>({id:crypto.randomUUID(),email:'reader@customer.co.uk',amount:3799,payment_status:'paid',payment_mode:'live',data:{paidAt:new Date().toISOString(),measurement:{ads:adConsent(consent),source:'google',campaign:'cq_gifts'}},...change});
const req=(path='purchases.csv',password='p'.repeat(40))=>new Request('https://cq.test/api/ads/'+path,{headers:{Authorization:'Basic '+btoa('google-ads:'+password)}});
function insert(e,o){e.DB.sqlite.prepare("INSERT INTO customer_orders(id,token_hash,email,size,amount,status,payment_status,payment_mode,state,created_at,updated_at) VALUES (?,'private',?,'a5',?,'awaiting_review',?,?,?, ?,?)").run(o.id,o.email,o.amount,o.payment_status,o.payment_mode,JSON.stringify(o.data),o.data.paidAt,o.data.paidAt);}
test('only explicit current consent can retain valid click identifiers, preserving case',()=>{
 assert.equal(adConsent({gclid:'abc'}),null);assert.equal(adConsent({...consent,advertisingConsentVersion:'old'}),null);
 assert.equal(adConsent(consent).gclid,'CaseSensitive_AbC-123');assert.equal(adConsent({...consent,gclid:'a\nprivate'}).gclid,null);
 assert.deepEqual(adConfig({GOOGLE_ADS_TAG_ID:'<script>',GOOGLE_ADS_PURCHASE_LABEL:'abcd'}),{tagId:null,purchase:null,lead:null});
});
test('purchase evidence uses actual amount, excludes tests and owner, and confirmed refund restates to zero',()=>{
 const o=order();assert.equal(purchaseConversion(o,{}).value,37.99);
 for(const c of [{payment_status:'unpaid'},{payment_mode:'test'},{email:'cravenluke@gmail.com'},{email:'ai+test@breeztechnologies.com'},{data:{...o.data,discount:{ownerTest:true}}},{data:{...o.data,measurement:{}}},{data:{...o.data,measurement:{...o.data.measurement,ads:{...o.data.measurement.ads,revokedAt:'now'}}}},{data:{...o.data,paidAt:undefined}}])assert.equal(purchaseConversion({...o,...c},{}),null);
 assert.equal(purchaseConversion({...o,data:{...o.data,refund:{status:'completed'}}},{}).value,0);
});
test('protected server feed recovers sale without any browser return, retains stable IDs on retries and leaks no private fields',async()=>{
 const e=env(),o=order();insert(e,o);insert(e,order({payment_mode:'test'}));insert(e,order({email:'cravenluke@gmail.com'}));
 const a=await adFeed(req(),e),csv=await a.text();assert.equal(a.status,200);assert.equal(csv.trim().split('\n').length,2);assert.match(csv,/37.99/);assert.match(csv,new RegExp(o.id));assert.match(csv,/CaseSensitive_AbC-123/);assert.doesNotMatch(csv,/reader@|private|story/);
 assert.equal(await(await adFeed(req(),e)).text(),csv);
 assert.equal((await adFeed(req('purchases.csv','wrong'),e)).status,401);assert.equal((await adFeed(req(),{...e,GOOGLE_ADS_FEED_PASSWORD:''})).status,404);
 assert.match(a.headers.get('Cache-Control'),/no-store/);
});
test('preview receipt is stable on retry, separate from sale and marketing signup, and withdrawal suppresses exports',async()=>{
 const e=env(),email='reader@customer.co.uk';const a=await leadConversion(e,email,consent),b=await leadConversion(e,email,consent);
 assert.equal(a.eventId,b.eventId);assert.equal(a.value,0);assert.equal(e.DB.sqlite.prepare('SELECT COUNT(*) n FROM ad_leads').get().n,1);
 assert.equal(e.DB.sqlite.prepare('SELECT COUNT(*) n FROM launch_leads').get().n,0);
 assert.equal(await leadConversion(e,'cravenluke@gmail.com',consent),null);assert.equal(await leadConversion(e,email,{}),null);
 assert.equal((await(await adFeed(req('leads.csv'),e)).text()).trim().split('\n').length,2);
 const revoke=await campaignApi(new Request('https://cq.test/api/ad-revoke',{method:'POST',headers:{Origin:'https://cq.test','Content-Type':'application/json'},body:JSON.stringify({visitId:consent.visitId})}),e);assert.equal(revoke.status,200);
 assert.equal((await(await adFeed(req('leads.csv'),e)).text()).trim().split('\n').length,1);assert.equal(await leadConversion(e,email,consent),null);
});
test('lead receipt failure never prevents a preview email from being saved',async()=>{
 const e=env();e.DB.sqlite.exec('DROP TABLE ad_leads');
 const r=await campaignApi(new Request('https://cq.test/api/preview-email',{method:'POST',headers:{Origin:'https://cq.test','Content-Type':'application/json'},body:JSON.stringify({email:'reader@customer.co.uk',...consent})}),e);
 assert.equal(r.status,200);assert.equal((await r.json()).conversion,null);assert.equal(e.DB.sqlite.prepare('SELECT COUNT(*) n FROM preview_contacts').get().n,1);
});
