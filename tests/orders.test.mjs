import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {ordersApi,quoteOrder,runArtworkJobs,claimBookSoldAlerts} from '../src/orders.js';
import {PRODUCTS,OWNER_TEST,sha,checkoutReady,BOOK} from '../src/catalog.js';
import {printBook,validatePdf,giver} from '../src/print-book.js';
import {testDb} from './sqlite-d1.mjs';
import worker from '../dist/server/index.js';
const ownerToken='a'.repeat(64),origin='https://cq.test',owner={Cookie:'__Host-cq_owner='+ownerToken},token=crypto.randomUUID()+crypto.randomUUID();
const story={title:'Jamie and the Missing Sandwich',synopsis:'Jamie follows a trail and finds the picnic.',spreads:Array.from({length:10},(_,i)=>({text:'Jamie followed the trail. The sandwich was not far away. Everyone laughed and shared their picnic.',image_scene:'Jamie at the picnic, scene '+i}))};
const jpeg=readFileSync(new URL('../dist/client/assets/amara-book-portrait/page-01.jpg',import.meta.url));
const dataUrl='data:image/jpeg;base64,'+jpeg.toString('base64');
function environment(){const objects=new Map(),DB=testDb(),calls=[];DB.sqlite.exec('CREATE TABLE owner_login_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL)');DB.sqlite.prepare('INSERT INTO owner_login_sessions VALUES (?,?)').run(createHash('sha256').update(ownerToken).digest('hex'),new Date(Date.now()+3600000).toISOString());return {DB,objects,calls,ORDER_LINK_SECRET:'test-only-link-key',ORDERS_ADMIN_EMAIL:'owner@example.com',BOOK_ASSETS:{async put(k,b,o){objects.set(k,{bytes:new Uint8Array(b),type:o.httpMetadata.contentType});},async get(k){const v=objects.get(k);return v&&{arrayBuffer:async()=>v.bytes.buffer.slice(v.bytes.byteOffset,v.bytes.byteOffset+v.bytes.byteLength),httpMetadata:{contentType:v.type}};}},ASSETS:{async fetch(req){const path=new URL(req.url).pathname;try{return new Response(readFileSync(new URL('../dist/client'+path,import.meta.url)));}catch{return new Response('',{status:404});}}},async fetch(url,opts){calls.push({url,opts});throw new Error('Unexpected external request');}};}
async function request(env,path,body,{admin=false,auth=true,method=body?'POST':'GET',headers={}}={}){return ordersApi(new Request(origin+'/api/orders'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{}),...(admin?owner:{}),...headers},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}),env);}
async function create(env,size='a5',measurement=null){const preview=crypto.randomUUID();env.DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,created_at) VALUES (?,'succeeded',?)").run(preview,new Date().toISOString());const id=crypto.randomUUID(),body={requestId:id,accessToken:token,size,measurement,email:'qa-order@example.test',names:'Jamie',age:'6-8',story,characters:[dataUrl],previewId:preview,approvedStory:true,photoPermission:true,recipient:{name:'Test Recipient',address:{line1:'1 Test Street',townOrCity:'York',postalOrZipCode:'YO1 7AA',countryCode:'GB'}},dedication:'For Jamie',senderName:'Mum and Dad',wishes:{details:'Loves her grey cat Pepper and the beach',ownIdea:'',mood:'adventure',storyMode:'invent',idea:'The missing sandwich'}};const r=await request(env,'',body);assert.equal(r.status,201);const saved=(await r.json()).order;assert.equal(saved.senderName,'Mum and Dad');return {id,body,order:saved};}
async function state(env,id){const row=env.DB.sqlite.prepare('SELECT * FROM customer_orders WHERE id=?').get(id);return {...row,data:JSON.parse(row.state)};}
async function paid(env,id,mode='live'){env.DB.sqlite.prepare("UPDATE customer_orders SET payment_status='paid',payment_mode=?,status='awaiting_review',session_id='cs_live_test' WHERE id=?").run(mode,id);}
async function pdf(size='a5'){const doc=await PDFDocument.create();for(let i=0;i<BOOK.pdfPages;i++)doc.addPage([PRODUCTS[size].widthMm*72/25.4,PRODUCTS[size].heightMm*72/25.4]);return doc.save();}
async function upload(env,id){const o=await state(env,id);const r=await ordersApi(new Request(origin+'/api/orders/'+id+'/upload-proof',{method:'POST',headers:{Origin:origin,...owner,'Content-Type':'application/pdf','X-Order-Revision':String(o.revision)},body:await pdf(o.size)}),env);assert.equal(r.status,200);return (await r.json());}
async function approveBoth(env,id){let o=await upload(env,id);let r=await request(env,'/'+id+'/approve-proof',{revision:o.revision,confirm:true,proofHash:o.proof.hash});assert.equal(r.status,200);o=await r.json();r=await request(env,'/'+id+'/approve',{revision:o.revision,checkedPages:true,checkedQuality:true,checkedAddress:true,proofHash:o.proof.hash},{admin:true});assert.equal(r.status,200);return r.json();}
function quoteResponse(tax='0.00'){return {quotes:[{shipmentMethod:'Standard',costSummary:{items:{amount:'8.56',currency:'GBP'},shipping:{amount:'6.50',currency:'GBP'},totalCost:{amount:'15.06',currency:'GBP'},totalTax:{amount:tax,currency:'GBP'}},shipments:[{fulfillmentLocation:{countryCode:'GB'}}]}]};}
function connected(env){Object.assign(env,{ORDERS_ENABLED:'true',ORDER_TAX_CONFIRMED:'true',STRIPE_SECRET_KEY:'sk_live_test',STRIPE_WEBHOOK_SECRET:'whsec_test',PRODIGI_API_KEY:'printer-test-key',RESEND_API_KEY:'email-test-key',ORDER_EMAIL_FROM:'books@example.test'});}
function liveFetch(env,{timeout=false,refunded=false}={}){env.fetch=async(url,opts={})=>{env.calls.push({url,opts});if(url.includes('/checkout/sessions/'))return Response.json({id:'cs_live_test',client_reference_id:env.orderId,amount_total:2898,currency:'gbp',metadata:{cq_order_id:env.orderId},payment_status:'paid',livemode:true,payment_intent:'pi_test'});if(url.includes('/payment_intents/'))return Response.json({status:'succeeded',amount_received:2898,currency:'gbp',metadata:{cq_order_id:env.orderId},latest_charge:{refunded,disputed:false,amount_refunded:refunded?2898:0}});if(url.endsWith('/quotes'))return Response.json(quoteResponse());if(url.endsWith('/products/spine'))return Response.json({success:true,spineInfo:{widthMm:4}});if(url.endsWith('/orders')){if(timeout)throw new Error('network timeout');const b=JSON.parse(opts.body);return Response.json({order:{id:'ord_test',merchantReference:b.merchantReference,status:{stage:'InProgress'}}});}throw new Error('Unexpected route '+url);};}
async function signedEvent(env,e){const raw=JSON.stringify(e),t=String(Math.floor(Date.now()/1000)),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw))).toString('hex');return ordersApi(new Request(origin+'/api/orders/payment-webhook',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${sig}`},body:raw}),env);}

test('Dot book sale alert is claimed once for a live Stripe sale and never for a test payment',async()=>{
 const live=environment(),{id}=await create(live);connected(live);
 live.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(id);
 const event={id:'evt_sale_alert',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_test',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};
 assert.equal((await signedEvent(live,event)).status,200);
 assert.equal((await state(live,id)).data.bookSoldAlert.status,'pending');
 assert.deepEqual(await claimBookSoldAlerts(live),{alerts:[{orderId:id,message:'CONGRATULATIONS! 🎉 Book sold\nJamie and the Missing Sandwich · A5 · £28.98 · qa-order@example.test\nhttps://cravenandquill.com/orders'}]});
 assert.equal((await state(live,id)).data.bookSoldAlert.status,'claimed');
 assert.equal((await signedEvent(live,event)).status,200);
 assert.deepEqual(await claimBookSoldAlerts(live),{alerts:[]});
 const testEnv=environment(),testOrder=await create(testEnv);connected(testEnv);testEnv.STRIPE_SECRET_KEY='sk_test_example';
 testEnv.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(testOrder.id);
 const testEvent={...event,livemode:false,data:{object:{...event.data.object,client_reference_id:testOrder.id,metadata:{cq_order_id:testOrder.id}}}};
 assert.equal((await signedEvent(testEnv,testEvent)).status,200);
 assert.equal((await state(testEnv,testOrder.id)).data.bookSoldAlert,undefined);
 assert.deepEqual(await claimBookSoldAlerts(testEnv),{alerts:[]});
});
test('Dot book sale tool is available only to the Site owner',async()=>{
 const env=environment(),body=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'});
 const call=headers=>worker.fetch(new Request(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',...headers},body}),env);
 assert.equal((await call({})).status,403);
 const response=await call({'oai-authenticated-user-email':env.ORDERS_ADMIN_EMAIL});
 assert.equal(response.status,200);
 assert.ok((await response.json()).result.tools.some(tool=>tool.name==='book_sold_alerts'));
 const {id}=await create(env);connected(env);
 env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(id);
 const event={id:'evt_mcp_alert',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_test',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};
 assert.equal((await signedEvent(env,event)).status,200);
 const callAlerts=()=>worker.fetch(new Request(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-email':env.ORDERS_ADMIN_EMAIL},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'book_sold_alerts',arguments:{}}})}),env);
 const first=await callAlerts();assert.equal(first.status,200);
 assert.equal(JSON.parse((await first.json()).result.content[0].text).alerts[0].orderId,id);
 const second=await callAlerts();assert.deepEqual(JSON.parse((await second.json()).result.content[0].text),{alerts:[]});
});

test('server prices both sizes, includes delivery, ignores customer price, and retry cannot duplicate a saved order',async()=>{const env=environment(),c=await create(env);assert.equal(c.order.amount,2898);const r=await request(env,'',{...c.body,amount:1});assert.equal(r.status,200);assert.equal((await r.json()).order.amount,2898);assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_orders').get().n,1);const second=await create(env,'a4');assert.equal(second.order.amount,3398);assert.equal(env.calls.length,0);});
test('private order and artwork require its secret or the actual owner; public catalogue has no private data',async()=>{const env=environment(),{id}=await create(env);assert.equal((await request(env,'/'+id,null,{auth:false})).status,404);assert.equal((await request(env,'/admin',null,{auth:false})).status,401);assert.equal((await request(env,'/admin',null,{auth:false,headers:{'oai-authenticated-user-email':'owner@example.com'}})).status,401);assert.equal((await request(env,'/admin',null,{auth:false,headers:{'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.com'}})).status,401);const r=await request(env,'/'+id);const o=await r.json();assert.equal(o.email,undefined);assert.equal(o.art,undefined);const row=await state(env,id);assert.ok(!row.state.includes(token));assert.equal((await request(env,'/'+id+'/file?file='+row.data.characters[0])).status,404);assert.equal((await request(env,'/'+id+'/file?file='+row.data.characters[0],null,{admin:true})).status,200);});
test('cross-site save is refused and never places a supplier order',async()=>{const env=environment();const r=await request(env,'',{}, {headers:{Origin:'https://evil.test'}});assert.equal(r.status,403);assert.equal(env.calls.length,0);});
test('disabled checkout fails closed while saved books remain readable',async()=>{const env=environment(),{id,order}=await create(env);const r=await request(env,'/'+id+'/checkout',{revision:order.revision});assert.equal(r.status,503);assert.equal(checkoutReady(env),false);assert.equal(env.calls.length,0);});
test('signed payment records paid status only and never prints, repeat and wrong amount fail safely',async()=>{const env=environment(),{id}=await create(env);connected(env);env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(id);const e={id:'evt_paid',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_test',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};assert.equal((await signedEvent(env,{...e,data:{object:{...e.data.object,amount_total:1}}})).status,400);assert.equal((await signedEvent(env,e)).status,200);assert.equal((await signedEvent(env,e)).status,200);const row=await state(env,id);assert.equal(row.status,'awaiting_review');assert.equal(row.payment_status,'paid');assert.equal(env.calls.length,0);});
test('verified live payment queues artwork, builds each image and proof, and still needs both approvals to print',async()=>{const env=environment(),{id}=await create(env);connected(env);env.OPENAI_API_KEY='test-image-key';env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(id);const e={id:'evt_artwork',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_test',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};assert.equal((await signedEvent(env,e)).status,200);assert.equal((await state(env,id)).data.autoGeneration.status,'pending');env.fetch=async(url,{body})=>{assert.equal(url,'https://api.openai.com/v1/images/edits');assert.deepEqual(Buffer.from(await body.get('image[]').arrayBuffer()),jpeg);assert.match(body.get('prompt'),/references determine appearance/i);assert.doesNotMatch(body.get('prompt'),/aged 6 to 8|never a teenager or adult/i);const cut=body.get('model')==='gpt-image-2.5-sunburst';env.calls.push({url,cut});if(cut){assert.equal(body.get('background'),'transparent');assert.equal(body.get('output_format'),'png');assert.match(body.get('prompt'),/transparent background/i);}return Response.json({data:[{b64_json:cut?'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGMQaHBgAGEQ8R+EASQsBT8PeQszAAAAAElFTkSuQmCC':jpeg.toString('base64')}],usage:{input_tokens:1}});};for(let i=1;i<=12;i++){const result=await runArtworkJobs(env);assert.equal(result.completed,i);assert.equal((await state(env,id)).data.autoGeneration.status,'pending');}const final=await runArtworkJobs(env);assert.equal(final.proofReady,true);const row=await state(env,id);assert.equal(row.status,'proof_ready');assert.equal(row.data.autoGeneration.status,'complete');assert.equal(row.data.art.scenes.filter(Boolean).length,10);assert.ok(row.data.art.back);assert.equal(env.calls.filter(c=>c.cut).length,1);assert.ok(row.data.proof.hash);assert.equal(env.calls.length,12);assert.equal((await runArtworkJobs(env)).worked,false);assert.equal((await request(env,'/'+id+'/submit',{revision:row.revision,confirm:true,proofHash:row.data.proof.hash,maxCostPence:2000},{admin:true})).status,409);});
test('owner can fix one picture by editing it to match another page, keeping the rest',async()=>{const env=environment(),{id}=await create(env);connected(env);env.OPENAI_API_KEY='test-image-key';env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_fix' WHERE id=?").run(id);const e={id:'evt_fix',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_fix',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};assert.equal((await signedEvent(env,e)).status,200);assert.equal((await state(env,id)).data.autoGeneration.status,'pending');env.fetch=async(url,{body})=>{env.calls.push({url,body});const cut=body.get('model')==='gpt-image-2.5-sunburst';return Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{input_tokens:1}});};for(let i=0;i<13;i++)await runArtworkJobs(env);let row=await state(env,id);const before=row.data.art.scenes[8];env.calls.length=0;
const r=await request(env,'/'+id+'/fix-picture',{revision:row.revision,page:8,match:7,instruction:'Make the drawing taped to the wall the same as her drawing.'},{admin:true});assert.equal(r.status,200);assert.equal(env.calls.length,1);const sent=env.calls[0].body;assert.equal(sent.getAll('image[]').length,2);assert.match(sent.get('prompt'),/Keep everything else exactly as it is/);assert.match(sent.get('prompt'),/Make the drawing taped to the wall/);row=await state(env,id);assert.notEqual(row.data.art.scenes[8],before);assert.equal(row.data.proof,null);
assert.equal((await request(env,'/'+id+'/fix-picture',{revision:row.revision,page:8,match:7,instruction:'Make the drawing match.'})).status,403);});
test('owner makes phone pages of the proof; customer sees and can open only those, and the email links to the book page',async()=>{const env=environment(),{id}=await create(env);connected(env);env.OPENAI_API_KEY='test-image-key';env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_bookpage' WHERE id=?").run(id);const e={id:'evt_bookpage',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_bookpage',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};assert.equal((await signedEvent(env,e)).status,200);assert.equal((await state(env,id)).data.autoGeneration.status,'pending');env.fetch=async()=>Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{input_tokens:1}});for(let i=0;i<13;i++)await runArtworkJobs(env);let row=await state(env,id);assert.equal(row.status,'proof_ready');const hash=row.data.proof.hash,img='data:image/jpeg;base64,'+jpeg.subarray(0,200000).toString('base64');
let cust=await (await request(env,'/'+id)).json();assert.equal(cust.bookPages,null);
assert.ok([403,413].includes((await request(env,'/'+id+'/proof-web',{revision:row.revision,hash,page:0,total:24,image:img})).status));
for(let p=0;p<24;p++){row=await state(env,id);const r=await request(env,'/'+id+'/proof-web',{revision:row.revision,hash,page:p,total:24,image:img},{admin:true});assert.equal(r.status,200);}
cust=await (await request(env,'/'+id)).json();assert.equal(cust.bookPages.length,24);assert.equal((await request(env,'/'+id+'/file?file='+cust.bookPages[5])).status,200);assert.equal((await request(env,'/'+id+'/file?file='+row.data.art.scenes[0])).status,404);
row=await state(env,id);assert.equal((await request(env,'/'+id+'/proof-web',{revision:row.revision,hash:'wrong',page:0,total:24,image:img},{admin:true})).status,409);});
test('automatic artwork failure pauses without a blind paid retry',async()=>{const env=environment(),{id}=await create(env);await paid(env,id);let row=await state(env,id);row.data.autoGeneration={status:'pending',queuedAt:new Date().toISOString()};env.DB.sqlite.prepare('UPDATE customer_orders SET state=? WHERE id=?').run(JSON.stringify(row.data),id);env.OPENAI_API_KEY='test-image-key';let calls=0;env.fetch=async url=>{if(String(url).includes('/images/'))calls++;throw Error('provider timeout');};const result=await runArtworkJobs(env);assert.equal(result.paused,true);row=await state(env,id);assert.equal(row.data.autoGeneration.status,'paused');assert.equal(row.data.artAttempts,1);assert.equal((await runArtworkJobs(env)).worked,false);assert.equal(calls,1);});
test('scheduled artwork endpoint needs its private runner token and exposes no order details',async()=>{const env=environment();env.ARTWORK_RUN_TOKEN='a'.repeat(64);const run=auth=>ordersApi(new Request(origin+'/api/orders/artwork-run',{method:'POST',headers:{authorization:auth}}),env);assert.equal((await run('')).status,403);assert.equal((await run('Bearer '+'b'.repeat(64))).status,403);const response=await run('Bearer '+env.ARTWORK_RUN_TOKEN);assert.equal(response.status,200);assert.deepEqual(await response.json(),{worked:false,paused:false,busy:false,proofReady:false,completed:0});});
test('bad signature and stale proof approval cannot change or release a book',async()=>{const env=environment(),{id}=await create(env);connected(env);const bad=await ordersApi(new Request(origin+'/api/orders/payment-webhook',{method:'POST',body:'{}',headers:{'stripe-signature':'t=1,v1=bad'}}),env);assert.equal(bad.status,400);await paid(env,id);const proof=await upload(env,id);const r=await request(env,'/'+id+'/approve-proof',{revision:proof.revision,confirm:true,proofHash:'stale'});assert.equal(r.status,409);assert.equal(env.calls.length,0);});
test('new proof invalidates both approvals and a customer cannot approve on behalf of owner',async()=>{const env=environment(),{id}=await create(env);await paid(env,id);let o=await approveBoth(env,id);assert.equal(o.status,'approved');env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_approval' WHERE id=?").run(id);const r=await request(env,'/'+id+'/approve',{revision:o.revision,checkedPages:true,checkedQuality:true,checkedAddress:true,proofHash:o.proof.hash});assert.equal(r.status,403);o=await upload(env,id);assert.equal(o.customerApproved,false);assert.equal(o.adminApproved,null);});
test('test-paid books can be proofed but never released to live Prodigi',async()=>{const env=environment(),{id}=await create(env);connected(env);await paid(env,id,'test');const o=await approveBoth(env,id);assert.equal((await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:2000},{admin:true})).status,409);assert.equal(env.calls.length,0);});
test('quote uses tax-inclusive total once and refuses non-UK production',async()=>{const env=environment();env.PRODIGI_API_KEY='test';env.fetch=async()=>Response.json(quoteResponse('1.00'));assert.equal((await quoteOrder(env,'a5')).totalPence,1506);env.fetch=async()=>{const q=quoteResponse();q.quotes[0].shipments[0].fulfillmentLocation.countryCode='US';return Response.json(q);};await assert.rejects(()=>quoteOrder(env,'a5'));});
test('release rechecks cost, payment refund and approvals before any paid printer call',async()=>{const env=environment(),{id}=await create(env);connected(env);env.orderId=id;await paid(env,id);let o=await approveBoth(env,id);liveFetch(env);let r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:1000},{admin:true});assert.equal(r.status,409);assert.equal(env.calls.filter(x=>x.url.endsWith('/orders')).length,0);liveFetch(env,{refunded:true});r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:2000},{admin:true});assert.equal(r.status,409);assert.equal(env.calls.filter(x=>x.url.endsWith('/orders')).length,0);});
test('uncertain print response stays held and retry uses identical order key; a second release is refused',async()=>{const env=environment(),{id}=await create(env);connected(env);env.orderId=id;await paid(env,id);let o=await approveBoth(env,id);liveFetch(env,{timeout:true});let r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:2000},{admin:true});assert.equal(r.status,502);o=await state(env,id);assert.equal(o.status,'supplier_unknown');const first=JSON.parse(env.calls.find(x=>x.url.endsWith('/orders')).opts.body);liveFetch(env);r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.data.proof.hash,maxCostPence:2000},{admin:true});assert.equal(r.status,200);const second=JSON.parse(env.calls.filter(x=>x.url.endsWith('/orders')).at(-1).opts.body);assert.equal(first.idempotencyKey,second.idempotencyKey);assert.equal(second.items[0].sku,PRODUCTS.a5.sku);assert.equal(second.items[0].assets[0].pageCount,BOOK.pdfPages);assert.ok(!JSON.stringify(second).includes('qa-order@example.test'));o=await state(env,id);r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.data.proof.hash,maxCostPence:2000},{admin:true});assert.equal(r.status,409);const fileUrl=new URL(second.items[0].assets[0].url);const file=await ordersApi(new Request(fileUrl),env);assert.equal(file.status,200);fileUrl.searchParams.set('signature','tampered');assert.equal((await ordersApi(new Request(fileUrl),env)).status,404);});
test('A5 and A4 PDFs have exactly the catalogue page count of single pages, embedded font, honest image quality and matching dimensions',async()=>{for(const size of ['a5','a4']){const bytes=readFileSync(new URL('../dist/client/assets/story-serif.ttf',import.meta.url)),logo=readFileSync(new URL('../dist/client/assets/logo-mark-on-white.png',import.meta.url));const p=await printBook({size,story,names:'Jamie',dedication:'For Jamie',art:{cover:'x',scenes:Array(10).fill('x')}},async()=>({bytes:jpeg,type:'image/jpeg'}),bytes,logo);assert.equal(p.preflight.pageCount,BOOK.pdfPages);assert.equal(p.preflight.fontsEmbedded,true);assert.equal(p.preflight.allImages300dpi,p.preflight.images.every(x=>x.dpi>=300));assert.equal(p.preflight.images.filter(x=>x.fullPage).length,11);assert.ok(p.preflight.images.every(x=>x.cropPercent>=0));assert.equal(p.preflight.images.length,11);await validatePdf(p.bytes,PRODUCTS[size]);await assert.rejects(()=>validatePdf(p.bytes,PRODUCTS[size==='a5'?'a4':'a5']));}});

function ziinaConnected(env,mode='test'){connected(env);Object.assign(env,{PAYMENT_PROVIDER:'ziina',ZIINA_MODE:mode,ZIINA_ACCESS_TOKEN:'test-token',ZIINA_ACCOUNT_ID:'merchant-test',ZIINA_WEBHOOK_SECRET:'test-webhook'});}
function intent(env,amount=2898,status='requires_payment_instrument'){return {id:'ziina-intent',account_id:env.ZIINA_ACCOUNT_ID,amount,currency_code:'GBP',tip_amount:0,vat_amount:0,status,redirect_url:'https://pay.ziina.com/test'};}
async function signedZiinaEvent(env,data){const raw=JSON.stringify({event:'payment_intent.status.updated',data}),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ZIINA_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))).toString('hex');return ordersApi(new Request(origin+'/api/orders/ziina-webhook',{method:'POST',headers:{'cf-connecting-ip':'3.29.184.186','x-hmac-signature':sig},body:raw}),env);}
test('Dot book sale alert is claimed once for a live Ziina webhook; an alert failure leaves payment paid',async()=>{
 const env=environment(),{id,order}=await create(env);ziinaConnected(env,'live');
 env.fetch=async(url)=>url.includes('api-v2.ziina.com')?Response.json(intent(env,2898,'completed')):Response.json({id:'email-test'});
 assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,200);
 assert.equal((await signedZiinaEvent(env,intent(env,2898,'completed'))).status,200);
 assert.equal((await state(env,id)).payment_status,'paid');
 await assert.rejects(()=>claimBookSoldAlerts({...env,DB:{prepare(){throw Error('Dot check failed');}}}),/Dot check failed/);
 assert.equal((await state(env,id)).payment_status,'paid');
 const first=await claimBookSoldAlerts(env);assert.equal(first.alerts.length,1);assert.equal(first.alerts[0].orderId,id);
 assert.equal((await signedZiinaEvent(env,intent(env,2898,'completed'))).status,200);
 assert.deepEqual(await claimBookSoldAlerts(env),{alerts:[]});
 const testEnv=environment(),testOrder=await create(testEnv);ziinaConnected(testEnv,'test');
 testEnv.fetch=async(url)=>url.includes('api-v2.ziina.com')?Response.json(intent(testEnv,2898,'completed')):Response.json({id:'email-test'});
 assert.equal((await request(testEnv,'/'+testOrder.id+'/checkout',{revision:testOrder.order.revision})).status,200);
 assert.equal((await signedZiinaEvent(testEnv,intent(testEnv,2898,'completed'))).status,200);
 assert.deepEqual(await claimBookSoldAlerts(testEnv),{alerts:[]});
});
test('Ziina prices are server owned, repeated checkout reuses intent, completion never prints and test mode is pinned',async()=>{const env=environment(),{id,order}=await create(env);ziinaConnected(env);let completed=false;env.fetch=async(url,opts)=>{env.calls.push({url,opts});if(opts.method==='POST'){const b=JSON.parse(opts.body);assert.equal(b.amount,2898);assert.equal(b.currency_code,'GBP');assert.equal(b.test,true);return Response.json(intent(env));}return Response.json(intent(env,2898,completed?'completed':'requires_payment_instrument'));};let r=await request(env,'/'+id+'/checkout',{revision:order.revision,amount:1});assert.equal(r.status,200);let o=await state(env,id);r=await request(env,'/'+id+'/checkout',{revision:o.revision});assert.equal(r.status,200);assert.equal(env.calls.filter(x=>x.opts.method==='POST').length,1);env.ZIINA_MODE='live';completed=true;r=await request(env,'/'+id+'/check-payment',{revision:o.revision});assert.equal(r.status,200);o=await state(env,id);assert.equal(o.payment_mode,'test');assert.equal(o.status,'awaiting_review');assert.ok(env.calls.every(x=>x.url.includes('ziina.com')));});
test('uncertain Ziina creation cannot be retried and wrong merchant or amount cannot mark an order paid',async()=>{const env=environment(),{id,order}=await create(env);ziinaConnected(env);env.fetch=async()=>{throw Error('timeout');};assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,502);let o=await state(env,id);assert.equal(o.status,'checkout_pending');assert.match(JSON.parse(o.state).holdReason,/Checkout failed: Could not reach Ziina/);assert.equal((await request(env,'/'+id+'/checkout',{revision:o.revision})).status,409);env.DB.sqlite.prepare("UPDATE customer_orders SET session_id='ziina-intent',status='awaiting_payment' WHERE id=?").run(id);env.fetch=async()=>Response.json({...intent(env,1,'completed')});assert.equal((await request(env,'/'+id+'/check-payment',{revision:o.revision})).status,409);env.fetch=async()=>Response.json({...intent(env,2898,'completed'),account_id:'wrong'});assert.equal((await request(env,'/'+id+'/check-payment',{revision:o.revision})).status,409);assert.equal((await state(env,id)).payment_status,'unpaid');});
test('Ziina webhook rejects spoofed signatures and source IPs',async()=>{const env=environment();ziinaConnected(env);for(const headers of [{},{'cf-connecting-ip':'3.29.184.186','x-hmac-signature':'bad'}]){const r=await ordersApi(new Request(origin+'/api/orders/ziina-webhook',{method:'POST',headers,body:'{}'}),env);assert.equal(r.status,403);}});
test('signed Ziina completion is rechecked with provider; refund event holds the order',async()=>{const env=environment(),{id,order}=await create(env);ziinaConnected(env,'live');env.fetch=async()=>Response.json(intent(env));await request(env,'/'+id+'/checkout',{revision:order.revision});const send=async(event,data)=>{const raw=JSON.stringify({event,data});const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ZIINA_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(raw))).toString('hex');return ordersApi(new Request(origin+'/api/orders/ziina-webhook',{method:'POST',headers:{'cf-connecting-ip':'3.29.184.186','x-hmac-signature':signature},body:raw}),env);};await send('payment_intent.status.updated',intent(env,2898,'completed'));assert.equal((await state(env,id)).payment_status,'unpaid');env.fetch=async()=>Response.json(intent(env,2898,'completed'));assert.equal((await send('payment_intent.status.updated',intent(env))).status,200);assert.equal((await state(env,id)).payment_status,'paid');assert.equal((await send('refund.status.updated',{payment_intent_id:'ziina-intent',status:'pending'})).status,200);assert.equal((await state(env,id)).status,'on_hold');});

test('owner refund holds before provider request and uncertain outcome cannot create a second refund',async()=>{const env=environment(),{id}=await create(env);ziinaConnected(env);await paid(env,id,'test');let o=await state(env,id);o.data.payment={provider:'ziina',mode:'test',accountId:env.ZIINA_ACCOUNT_ID};env.DB.sqlite.prepare('UPDATE customer_orders SET state=? WHERE id=?').run(JSON.stringify(o.data),id);let calls=0;env.fetch=async()=>{calls++;assert.equal((await state(env,id)).status,'on_hold');throw Error('timeout');};assert.equal((await request(env,'/'+id+'/refund',{revision:o.revision,confirm:true,amountPence:2898})).status,403);let r=await request(env,'/'+id+'/refund',{revision:o.revision,confirm:true,amountPence:2898},{admin:true});assert.equal(r.status,200);o=await state(env,id);assert.equal(o.data.refund.status,'unknown');assert.equal(o.data.payment.refundReported,true);r=await request(env,'/'+id+'/refund',{revision:o.revision,confirm:true,amountPence:2898},{admin:true});assert.equal(r.status,409);assert.equal(calls,1);});
test('refund cannot bypass supplier submission and status response must match original payment',async()=>{const env=environment(),{id}=await create(env);ziinaConnected(env);await paid(env,id);let o=await state(env,id);o.data.payment={provider:'ziina',mode:'live'};o.data.refund={id:'refund-test',status:'pending'};env.DB.sqlite.prepare("UPDATE customer_orders SET state=?,status='submitted' WHERE id=?").run(JSON.stringify(o.data),id);assert.equal((await request(env,'/'+id+'/refund',{revision:o.revision,confirm:true,amountPence:2898},{admin:true})).status,409);env.DB.sqlite.prepare("UPDATE customer_orders SET status='on_hold' WHERE id=?").run(id);env.fetch=async()=>Response.json({id:'refund-test',payment_intent_id:'wrong',amount:2898,currency_code:'GBP',status:'completed'});assert.equal((await request(env,'/'+id+'/refund-status',{revision:o.revision},{admin:true})).status,502);});

for (const size of ['a5','a4']) test(`${size}: complete Ziina order journey, emails, exact proof approvals, print release and tracking`,async()=>{
 const env=environment(),{id,order}=await create(env,size);ziinaConnected(env,'live');let paymentComplete=false,printerCalls=0;const emails=[];const price=PRODUCTS[size].pricePence+399;
 env.fetch=async(url,opts={})=>{
  env.calls.push({url,opts});
  if(url.includes('api-v2.ziina.com/api/payment_intent')){if(opts.method==='POST'){const b=JSON.parse(opts.body);assert.equal(b.amount,price);assert.equal(b.currency_code,'GBP');assert.equal(b.allow_tips,false);}return Response.json(intent(env,price,paymentComplete?'completed':'requires_payment_instrument'));}
  if(url==='https://api.resend.com/emails'){const b=JSON.parse(opts.body);emails.push({body:b,key:opts.headers['Idempotency-Key']});return Response.json({id:'email-'+emails.length});}
  if(url.endsWith('/quotes')){const q=quoteResponse();q.quotes[0].costSummary.totalCost.amount=size==='a5'?'15.06':'16.76';return Response.json(q);}
  if(url.endsWith('/products/spine'))return Response.json({success:true,spineInfo:{widthMm:4}});
  if(url.endsWith('/orders')){printerCalls++;const b=JSON.parse(opts.body);assert.equal(b.items[0].sku,PRODUCTS[size].sku);assert.equal(b.items[0].assets[0].pageCount,BOOK.pdfPages);assert.equal(b.copies,undefined);for(const asset of b.items[0].assets){const file=await ordersApi(new Request(asset.url),env);assert.equal(file.status,200);assert.ok((await file.arrayBuffer()).byteLength>100);}return Response.json({order:{id:'ord_journey',merchantReference:id,status:{stage:'InProgress'}}});}
  if(url.endsWith('/orders/ord_journey'))return Response.json({order:{id:'ord_journey',merchantReference:id,status:{stage:'Complete'},shipments:[{carrier:{name:'QA carrier'},trackingNumber:'QA123',trackingUrl:'https://example.test/tracking/QA123'}]}});
  throw Error('Unexpected provider '+url);
 };
 let r=await request(env,'/'+id+'/checkout',{revision:order.revision});assert.equal(r.status,200);let o=await state(env,id);assert.equal(o.payment_status,'unpaid');assert.equal(printerCalls,0);
 paymentComplete=true;r=await request(env,'/'+id+'/check-payment',{revision:o.revision});assert.equal(r.status,200);o=await r.json();assert.equal(o.status,'awaiting_review');assert.equal(emails.length,1);assert.match(emails[0].body.subject,/Payment received/);assert.ok(emails[0].body.text.includes((price/100).toFixed(2)));
 const release=async(current,admin=true)=>request(env,'/'+id+'/submit',{revision:current.revision,confirm:true,checkedPayment:true,proofHash:current.proof?.hash,maxCostPence:2000},{admin});
 assert.equal((await release(o)).status,409);assert.equal(printerCalls,0);
 const render=await printBook({size,story,names:'Jamie',dedication:'For Jamie',art:{cover:'qa',scenes:Array(10).fill('qa')}},async()=>({bytes:jpeg,type:'image/jpeg'}),readFileSync(new URL('../dist/client/assets/story-serif.ttf',import.meta.url)),readFileSync(new URL('../dist/client/assets/logo-mark-on-white.png',import.meta.url)));
 await validatePdf(render.bytes,PRODUCTS[size]);r=await ordersApi(new Request(origin+'/api/orders/'+id+'/upload-proof',{method:'POST',headers:{Origin:origin,...owner,'Content-Type':'application/pdf','X-Order-Revision':String(o.revision)},body:render.bytes}),env);assert.equal(r.status,200);o=await r.json();
 r=await request(env,'/'+id+'/notify-proof',{revision:o.revision},{admin:true});assert.equal(r.status,200);o=await r.json();assert.equal(emails.length,2);assert.match(emails[1].body.subject,/book is ready/);assert.ok(emails[1].key.includes(o.proof.hash));
 assert.equal((await release(o)).status,409);r=await request(env,'/'+id+'/approve-proof',{revision:o.revision,confirm:true,proofHash:o.proof.hash});assert.equal(r.status,200);o=await r.json();assert.equal(o.status,'awaiting_approval');assert.equal((await release(o)).status,409);assert.equal(printerCalls,0);
 r=await request(env,'/'+id+'/approve',{revision:o.revision,checkedPages:true,checkedQuality:true,checkedAddress:true,proofHash:o.proof.hash},{admin:true});assert.equal(r.status,200);o=await r.json();assert.equal(o.status,'approved');assert.equal(printerCalls,0);assert.equal((await release(o,false)).status,403);
 r=await release(o);assert.equal(r.status,200);o=await r.json();assert.equal(o.status,'submitted');assert.equal(printerCalls,1);assert.equal(emails.length,3);assert.match(emails[2].body.text,/not a dispatch confirmation/);
 assert.equal((await release(o)).status,409);assert.equal(printerCalls,1);
 r=await request(env,'/'+id+'/notify-printed',{revision:o.revision},{admin:true});assert.equal(r.status,200);assert.equal(emails.length,3);o=await r.json();
 r=await request(env,'/'+id+'/refresh',{revision:o.revision},{admin:true});assert.equal(r.status,200);o=await r.json();assert.equal(o.shipments[0].trackingNumber,'QA123');
});

test('private £1 live diagnostic is owner-only, one-time, price-pinned and isolated from book orders and Prodigi',async()=>{
 const env=environment();ziinaConnected(env,'test');env.ORDERS_ENABLED='false';env.ORDER_TAX_CONFIRMED='false';let done=false,creates=0,refunds=0,refundBody;
 env.fetch=async(url,opts={})=>{assert.ok(url.startsWith('https://api-v2.ziina.com/'));if(url.endsWith('/payment_intent')){creates++;const b=JSON.parse(opts.body);assert.equal(b.amount,100);assert.equal(b.test,false);assert.equal(b.allow_tips,false);return Response.json(intent(env,100));}if(url.includes('/payment_intent/'))return Response.json(intent(env,100,done?'completed':'requires_payment_instrument'));if(url.endsWith('/refund')){refunds++;refundBody=JSON.parse(opts.body);assert.equal(refundBody.test,false);return Response.json({...refundBody,status:'completed'});}if(url.includes('/refund/'))return Response.json({...refundBody,status:'completed'});throw Error('Unexpected request');};
 assert.equal((await request(env,'/live-payment-test',null,{auth:false})).status,401);
 assert.equal((await request(env,'/live-payment-test',{action:'create',confirm:true},{admin:true,headers:{Origin:'https://evil.test'}})).status,403);
 let r=await request(env,'/live-payment-test',{action:'create',confirm:true,amount:9999},{admin:true});assert.equal(r.status,200);assert.equal((await r.json()).amountPence,100);
 assert.equal((await request(env,'/live-payment-test',{action:'create',confirm:true},{admin:true})).status,200);assert.equal(creates,1);
 assert.equal((await request(env,'/live-payment-test',{action:'refund',confirm:true},{admin:true})).status,409);done=true;
 r=await request(env,'/live-payment-test',{action:'refresh'},{admin:true});assert.equal((await r.json()).test.status,'completed');
 r=await request(env,'/live-payment-test',{action:'refund',confirm:true},{admin:true});assert.equal(r.status,200);assert.equal((await r.json()).test.refund.status,'completed');
 assert.equal((await request(env,'/live-payment-test',{action:'refund',confirm:true},{admin:true})).status,409);assert.equal(refunds,1);
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM customer_orders').get().n,0);assert.equal(checkoutReady(env),false);
});
test('ambiguous private test checkout cannot create a second payment',async()=>{const env=environment();ziinaConnected(env);let count=0;env.fetch=async()=>{count++;throw Error('timeout');};assert.equal((await request(env,'/live-payment-test',{action:'create',confirm:true},{admin:true})).status,503);const r=await request(env,'/live-payment-test',{action:'create',confirm:true},{admin:true});assert.equal((await r.json()).test.status,'creation_unknown');assert.equal(count,1);});

test('live test retains provider failure details without retrying a refund',async()=>{const env=environment();ziinaConnected(env);let refund;
env.fetch=async(url,opts={})=>{if(url.endsWith('/payment_intent'))return Response.json(intent(env,100));if(url.includes('/payment_intent/'))return Response.json(intent(env,100,'completed'));if(url.endsWith('/refund')){refund=JSON.parse(opts.body);return Response.json({...refund,status:'pending'});}return Response.json({...refund,status:'failed',error:{code:'EXAMPLE_FAILURE',message:'Provider explanation'}});};
await request(env,'/live-payment-test',{action:'create',confirm:true},{admin:true});await request(env,'/live-payment-test',{action:'refund',confirm:true},{admin:true});const r=await request(env,'/live-payment-test',{action:'refund-status'},{admin:true});assert.equal(r.status,200);const d=await r.json();assert.equal(d.test.refund.status,'failed');assert.equal(d.test.refund.error.code,'EXAMPLE_FAILURE');assert.equal((await request(env,'/live-payment-test',{action:'refund',confirm:true},{admin:true})).status,409);});

test('second £1 diagnostic requires original balance failure, stays isolated and cannot create a third charge',async()=>{
 const env=environment();ziinaConnected(env);env.ORDERS_ENABLED='false';let creates=0;
 env.fetch=async(url,opts)=>{assert.ok(url.startsWith('https://api-v2.ziina.com/'));assert.ok(url.endsWith('/payment_intent'));creates++;const body=JSON.parse(opts.body);assert.equal(body.amount,100);assert.equal(body.currency_code,'GBP');assert.equal(body.test,false);assert.match(body.success_url,/payment=2/);return Response.json({...intent(env,100),id:'second-payment'});};
 assert.equal((await request(env,'/live-payment-test?payment=2',{action:'create',confirm:true},{admin:true})).status,409);
 const original={status:'completed',paymentId:'original-payment',refund:{id:'original-refund',status:'failed',error:{code:'INSUFFICIENT_BALANCE'}}};
 env.DB.sqlite.prepare('INSERT INTO live_payment_test (id,state) VALUES (1,?)').run(JSON.stringify(original));
 assert.equal((await request(env,'/live-payment-test?payment=2',{action:'create',confirm:true},{auth:false})).status,401);
 for(let i=0;i<2;i++){const r=await request(env,'/live-payment-test?payment=2',{action:'create',confirm:true,amount:200},{admin:true});assert.equal(r.status,200);assert.equal((await r.json()).test.paymentId,'second-payment');}
 assert.equal(creates,1);
 assert.deepEqual((await (await request(env,'/live-payment-test',null,{admin:true})).json()).test,original);
 assert.equal((await request(env,'/live-payment-test?payment=3',{action:'create',confirm:true},{admin:true})).status,400);
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM customer_orders').get().n,0);assert.equal(checkoutReady(env),false);
});

test('unlinked second checkout recovery is atomic, one-time and retains failed attempt',async()=>{
 const env=environment();ziinaConnected(env);let creates=0;
 await request(env,'/live-payment-test?payment=2',null,{admin:true});await request(env,'/live-payment-test',null,{admin:true});
 const original={status:'completed',refund:{status:'failed',error:{code:'INSUFFICIENT_BALANCE'}}};
 env.DB.sqlite.prepare('INSERT INTO live_payment_test (id,state) VALUES (1,?)').run(JSON.stringify(original));
 const failed={status:'creation_unknown',createdAt:'2026-10-25T12:18:00Z'};
 env.DB.sqlite.prepare('INSERT INTO live_payment_test_second (id,state) VALUES (1,?)').run(JSON.stringify(failed));
 env.fetch=async(url,opts)=>{assert.ok(url.endsWith('/payment_intent'));assert.equal(JSON.parse(opts.body).amount,100);assert.ok(JSON.parse(opts.body).message.length<=64);creates++;return Response.json(intent(env,100));};
 assert.equal((await request(env,'/live-payment-test?payment=1',{action:'recover',confirm:true},{admin:true})).status,409);
 let r=await request(env,'/live-payment-test?payment=2',{action:'recover',confirm:true},{admin:true});assert.equal(r.status,200);let d=await r.json();assert.equal(d.test.recoveryAttempted,true);assert.deepEqual(d.test.previousAttempt,failed);
 assert.equal((await request(env,'/live-payment-test?payment=2',{action:'recover',confirm:true},{admin:true})).status,409);assert.equal(creates,1);
 assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM customer_orders').get().n,0);
});

test('explicit message-length rejection may recover with short message but unknown repeated failure stays locked',async()=>{
 const env=environment();ziinaConnected(env);await request(env,'/live-payment-test?payment=2',null,{admin:true});await request(env,'/live-payment-test',null,{admin:true});
 env.DB.sqlite.prepare('INSERT INTO live_payment_test (id,state) VALUES (1,?)').run(JSON.stringify({status:'completed',refund:{status:'failed',error:{code:'INSUFFICIENT_BALANCE'}}}));
 const state={status:'creation_unknown',recoveryAttempted:true,creationError:'Ziina could not confirm the request (HTTP 400, MESSAGE_LENGTH_INVALID). Keep this order on hold.'};env.DB.sqlite.prepare('INSERT INTO live_payment_test_second (id,state) VALUES (1,?)').run(JSON.stringify(state));let calls=0;
 env.fetch=async(url,opts)=>{calls++;assert.ok(JSON.parse(opts.body).message.length<40);throw Error('timeout');};
 assert.equal((await request(env,'/live-payment-test?payment=2',{action:'recover',confirm:true},{admin:true})).status,503);assert.equal((await request(env,'/live-payment-test?payment=2',{action:'recover',confirm:true},{admin:true})).status,409);assert.equal(calls,1);
});

test('owner launch switch enables checkout without falsely attesting tax status; printing still needs approvals',async()=>{
 const env=environment(),{id}=await create(env);ziinaConnected(env,'live');env.ORDER_TAX_CONFIRMED='false';assert.equal(checkoutReady(env),true);await paid(env,id,'live');const o=await state(env,id);const r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,checkedPayment:true,maxCostPence:2000},{admin:true});assert.equal(r.status,409);assert.equal(env.calls.length,0);
});

test('draft return links encrypt large artwork, require the secret, send only to the requested email, and cannot print',async()=>{
 const env=environment();connected(env);const {body}=await create(env);const id=crypto.randomUUID();let mail;
 env.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');mail=JSON.parse(opts.body);return Response.json({id:'draft-email'});};
 const draft={state:{names:'Jamie',storyDraft:story,characterImages:[dataUrl],photos:['must be removed'],photoChecks:[true]},values:{names:'Jamie'},orderRequest:{secret:'remove'}};
 const r=await request(env,'/drafts/'+id,{draft,previewId:body.previewId,email:'qa-draft@example.test'},{method:'PUT'});assert.equal(r.status,200);assert.equal((await r.json()).sent,true);assert.deepEqual(mail.to,['qa-draft@example.test']);assert.match(mail.text,/#draft=/);
 // Short branded email, one button back to the preview, named after the child, no pictures of the book.
 assert.equal(mail.subject,'Craven & Quill: Jamie’s book is saved');assert.match(mail.html,/See Jamie’s book<\/a>/);assert.match(mail.html,/create\?utm_source=email[^"]*#draft=/);assert.equal((mail.html.match(/<img /g)||[]).length,1);assert.match(mail.text,/whole finished book before we print/);
 const recovered=await request(env,'/drafts/'+id);assert.equal(recovered.status,200);const d=await recovered.json();assert.equal(d.state.storyDraft.title,story.title);assert.deepEqual(d.state.photos,[]);assert.equal(d.orderRequest,null);
 assert.equal((await request(env,'/drafts/'+id,null,{auth:false})).status,404);
 assert.equal((await request(env,'/drafts/'+id,null,{headers:{Authorization:'Bearer '+crypto.randomUUID()+crypto.randomUUID()}})).status,404);
 const object=[...env.objects.entries()].find(([k])=>k.startsWith('drafts/'))[1];assert.ok(!new TextDecoder().decode(object.bytes).includes('Jamie'));
 assert.equal((await request(env,'/drafts/'+id,{draft,previewId:body.previewId,email:'qa-draft@example.test'},{method:'PUT'})).status,429);
 assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_orders').get().n,1);
});

test('quoted non-buyers require their own preview and explicit offer consent',async()=>{
 const env=environment(),preview=crypto.randomUUID(),email='quote@example.test';
 env.DB.sqlite.prepare("INSERT INTO preview_contacts(email,source,medium,campaign,creative,country,created_at,updated_at) VALUES (?,'direct','none','none','none','GB',?,?)").run(email,new Date().toISOString(),new Date().toISOString());
 env.DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,created_at,email) VALUES (?,'succeeded',?,?)").run(preview,new Date().toISOString(),email);
 const view={email,previewId:preview,size:'a5',pricePence:2499};
 const choice={email,previewId:preview,optIn:true};
 assert.ok((await request(env,'/quote-interest',{...view,offerConsent:true},{auth:false})).status>=400);
 assert.equal((await request(env,'/reminder-choice',choice,{auth:false})).status,409);
 assert.equal((await request(env,'/quote-view',{...view,email:'other@example.test'},{auth:false})).status,400);
 assert.equal((await request(env,'/quote-view',{...view,pricePence:3999},{auth:false})).status,400);
 assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_quotes').get().n,0);
 assert.equal((await request(env,'/quote-view',{...view,offerConsent:true},{auth:false})).status,200);
 let d=await (await request(env,'/admin-quotes',null,{admin:true})).json();
 assert.equal(d.totals.quotedNotBought,1);assert.equal(d.quotes[0].offer_consent_at,null);
 assert.equal((await request(env,'/reminder-choice',choice,{auth:false})).status,200);
 assert.equal(env.DB.sqlite.prepare('SELECT last_shown_at FROM customer_quotes').get().last_shown_at,d.quotes[0].last_shown_at);
 assert.equal((await request(env,'/reminder-choice',{...choice,optIn:false},{auth:false})).status,200);
 assert.equal(env.DB.sqlite.prepare('SELECT consent_at FROM followup_sequences').get().consent_at,null);
 assert.equal((await request(env,'/reminder-choice',choice,{auth:false})).status,200);
 env.DB.sqlite.prepare('UPDATE customer_quotes SET last_shown_at=? WHERE email=?').run(new Date(Date.now()-90000000).toISOString(),email);
 d=await (await request(env,'/admin-quotes',null,{admin:true})).json();
 assert.equal(d.totals.offerEligible,0);assert.equal(d.quotes[0].eligible,false);assert.equal(d.quotes[0].has_sequence_consent,1);
 const token=env.DB.sqlite.prepare('SELECT unsubscribe_token FROM customer_quotes WHERE email=?').get(email).unsubscribe_token;
 assert.equal((await request(env,'/offer-unsubscribe',{token},{auth:false})).status,200);
 d=await (await request(env,'/admin-quotes',null,{admin:true})).json();assert.equal(d.totals.offerEligible,0);
});

test('one offer email creates a single-use discount, never starts payment or printing',async()=>{
 // Manual offers need price headroom, so this test runs at the earlier £39.99 A5 price.
 const launchPrice=PRODUCTS.a5.pricePence;PRODUCTS.a5.pricePence=3999;try{
 const env=environment(),{id}=await create(env),email='qa-order@example.test',preview=crypto.randomUUID();
 env.DB.sqlite.prepare("INSERT INTO preview_contacts(email,source,medium,campaign,creative,country,created_at,updated_at) VALUES (?,'direct','none','none','none','GB',?,?)").run(email,new Date().toISOString(),new Date().toISOString());
 env.DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,created_at,email) VALUES (?,'succeeded',?,?)").run(preview,new Date().toISOString(),email);
 await request(env,'/quote-view',{email,previewId:preview,size:'a5',pricePence:3999},{auth:false});
 await request(env,'/reminder-choice',{email,previewId:preview,optIn:true},{auth:false});
 // Existing one-off opt-ins predate the new two-email consent record.
 env.DB.sqlite.prepare('DELETE FROM followup_sequences WHERE email=?').run(email);
 env.DB.sqlite.prepare('UPDATE customer_quotes SET last_shown_at=? WHERE email=?').run(new Date(Date.now()-90000000).toISOString(),email);
 connected(env);env.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');env.calls.push({url,opts});return Response.json({id:'email-test'});};
 let r=await request(env,'/admin-send-offer',{email,discountPence:300,confirm:true},{admin:true});assert.equal(r.status,200);const offer=await r.json();assert.equal(offer.accepted,true);
 assert.equal((await request(env,'/admin-send-offer',{email,discountPence:300,confirm:true},{admin:true})).status,409);
 let o=await state(env,id);r=await request(env,'/'+id+'/apply-offer',{revision:o.revision,code:offer.code});assert.equal(r.status,200);assert.equal((await r.json()).amount,4098);
 o=await state(env,id);assert.equal(o.payment_status,'unpaid');assert.equal(o.status,'saved');assert.equal(env.calls.length,1);
 const repeated=await request(env,'/'+id+'/apply-offer',{revision:o.revision,code:offer.code});
 assert.equal(repeated.status,200);assert.equal((await repeated.json()).amount,4098);
 }finally{PRODUCTS.a5.pricePence=launchPrice;}
});

test('page regeneration saves the exact prior text and clears proof approvals',async()=>{
 const env=environment(),{id}=await create(env);await paid(env,id);let o=await upload(env,id);
 env.OPENAI_API_KEY='test';env.fetch=async(url)=>{assert.equal(url,'https://api.openai.com/v1/responses');return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({text:'A completely new scene for Jamie and the picnic.',image_scene:'Jamie waves beside the picnic table.'})}]}]});};
 const original=o.story.spreads[0].text;
 const r=await request(env,'/'+id+'/rewrite-page',{revision:o.revision,page:0,confirm:true,redrawImage:true},{admin:true});
 assert.equal(r.status,200);o=await r.json();
 assert.equal(o.status,'building');assert.equal(o.proof,null);assert.equal(o.customerApproved,false);
 assert.equal(o.history[0].story.spreads[0].text,original);assert.notEqual(o.story.spreads[0].text,original);
 const restored=await request(env,'/'+id+'/restore-version',{revision:o.revision,version:1,confirm:true},{admin:true});
 assert.equal(restored.status,200);assert.equal((await restored.json()).story.spreads[0].text,original);
});

test('one final approval releases only the customer-approved live proof',async()=>{
 const env=environment(),{id}=await create(env);connected(env);env.orderId=id;await paid(env,id);
 let o=await upload(env,id);
 let r=await request(env,'/'+id+'/approve-proof',{revision:o.revision,confirm:true,proofHash:o.proof.hash});assert.equal(r.status,200);o=await r.json();
 liveFetch(env);
 r=await request(env,'/'+id+'/approve-and-submit',{revision:o.revision,confirm:true,checkedPages:true,checkedQuality:true,checkedAddress:true,proofHash:o.proof.hash,maxCostPence:2000},{admin:true});
 assert.equal(r.status,200);o=await r.json();assert.equal(o.status,'submitted');assert.equal(o.release.proofHash,o.proof.hash);assert.equal(env.calls.filter(x=>x.url.endsWith('/orders')).length,1);
});

test('owner test code makes a £2 book only for the owner email, and that book can still be released to print',async()=>{const realHash=OWNER_TEST.codeHash;OWNER_TEST.codeHash=await sha('CQTESTCODE01');try{
 const env=environment(),{id}=await create(env);connected(env);env.orderId=id;
 let o=await state(env,id);assert.equal((await request(env,'/'+id+'/apply-offer',{revision:o.revision,code:'CQTESTCODE01'})).status,409);
 env.DB.sqlite.prepare('UPDATE customer_orders SET email=? WHERE id=?').run(OWNER_TEST.email,id);o=await state(env,id);
 assert.equal((await request(env,'/'+id+'/apply-offer',{revision:o.revision,code:'CQWRONGCODE1'})).status,409);
 let r=await request(env,'/'+id+'/apply-offer',{revision:o.revision,code:'CQTESTCODE01'});assert.equal(r.status,200);assert.equal((await r.json()).amount,200);
 o=await state(env,id);assert.equal(o.amount,200);assert.equal(o.data.discount.ownerTest,true);assert.ok(!o.state.includes('CQTESTCODE01'));
 const a4=await create(env,'a4');env.DB.sqlite.prepare('UPDATE customer_orders SET email=? WHERE id=?').run(OWNER_TEST.email,a4.id);let o4=await state(env,a4.id);r=await request(env,'/'+a4.id+'/apply-offer',{revision:o4.revision,code:'CQTESTCODE01'});assert.equal((await r.json()).amount,200);
 o4=await state(env,a4.id);const realExpiry=OWNER_TEST.expiresAt;try{OWNER_TEST.expiresAt='2020-01-01T00:00:00Z';r=await request(env,'/'+a4.id+'/checkout',{revision:o4.revision});assert.equal(r.status,409);o4=await state(env,a4.id);assert.equal(o4.amount,PRODUCTS.a4.pricePence+399);assert.equal(o4.data.discount,null);}finally{OWNER_TEST.expiresAt=realExpiry;}
 await paid(env,id);o=await approveBoth(env,id);liveFetch(env);const base=env.fetch;env.fetch=async(url,opts)=>{const res=await base(url,opts);if(url.includes('/checkout/sessions/')||url.includes('/payment_intents/'))return Response.json(JSON.parse(JSON.stringify(await res.json()).replaceAll('2898','200')));return res;};
 r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:PRODUCTS.a5.pricePence+1},{admin:true});assert.equal(r.status,409);assert.equal(env.calls.filter(x=>x.url.endsWith('/orders')).length,0);
 r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:2000},{admin:true});assert.equal(r.status,200);assert.equal(env.calls.filter(x=>x.url.endsWith('/orders')).length,1);
}finally{OWNER_TEST.codeHash=realHash;}});

for(const provider of ['stripe','ziina'])test(`${provider}: live conversion survives closed browser, webhook retries and tracking failure`,async()=>{
 const {adFeed,AD_CONSENT_VERSION}=await import('../dist/server/ad-measurement.js');
 for(const mode of ['live','test']){
  const env=environment(),{id,order}=await create(env);if(provider==='stripe')connected(env);else ziinaConnected(env,mode);
  env.GOOGLE_ADS_FEED_PASSWORD='f'.repeat(40);env.STRIPE_SECRET_KEY=mode==='live'?'sk_live_test':'sk_test_example';
  const o=await state(env,id);o.data.measurement={visitId:crypto.randomUUID(),source:'google',medium:'cpc',campaign:'cq_gifts',creative:'g_birthday',country:'GB',ads:{version:AD_CONSENT_VERSION,at:new Date().toISOString(),gclid:'RealClick_CaseSensitive'}};
  env.DB.sqlite.prepare('UPDATE customer_orders SET email=?,state=? WHERE id=?').run('reader@customer.co.uk',JSON.stringify(o.data),id);
  let confirm;
  if(provider==='stripe'){
   env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(id);
   const event={id:'evt_tracking',type:'checkout.session.completed',livemode:mode==='live',data:{object:{id:'cs_live_test',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};
   confirm=()=>signedEvent(env,event);
  }else{
   env.fetch=async(url)=>url.includes('api-v2.ziina.com')?Response.json(intent(env,2898,'completed')):Response.json({id:'email-test'});
   assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,200);
   confirm=()=>signedZiinaEvent(env,intent(env,2898,'completed'));
  }
  assert.equal((await confirm()).status,200);const stamp=(await state(env,id)).data.paidAt;assert.ok(stamp);
  assert.equal((await confirm()).status,200);assert.equal((await state(env,id)).data.paidAt,stamp);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM campaign_events WHERE event='purchase_confirmed'").get().n,mode==='live'?1:0);
  // Losing optional event storage must not stop verification or lose the durable payment evidence.
  env.DB.sqlite.exec('DROP TABLE campaign_events');assert.equal((await confirm()).status,200);assert.equal((await state(env,id)).payment_status,'paid');
  const feed=await adFeed(new Request('https://cq.test/api/ads/purchases.csv',{headers:{Authorization:'Basic '+btoa('google-ads:'+env.GOOGLE_ADS_FEED_PASSWORD)}}),env);
  const csv=await feed.text();assert.equal(csv.trim().split('\n').length,mode==='live'?3:2);if(mode==='live'){assert.match(csv,/28.98/);assert.match(csv,new RegExp(id));}
 }
});

test('Meta purchase job reports each consented live sale once, records the outcome and retries a failure',async()=>{
 const env=environment();ziinaConnected(env,'live');env.META_PIXEL_ID='123456789';env.META_CAPI_TOKEN='t'.repeat(40);
 const {runMetaPurchaseJobs}=await import('../src/orders.js');
 const id=crypto.randomUUID();const data={names:'Jo',story:{title:'Jo'},characters:['c'],paidAt:new Date().toISOString(),metaPurchase:{status:'pending'},measurement:{visitId:crypto.randomUUID(),source:'meta',medium:'paid_social',campaign:'cq',creative:'d_static',country:'GB',ads:{version:'ads-2026-11-06',at:new Date().toISOString(),fbclid:'IwAR0click'}}};
 env.DB.sqlite.prepare("INSERT INTO customer_orders (id,token_hash,email,size,amount,status,payment_status,payment_mode,revision,state,created_at,updated_at) VALUES (?,?,?,'a4',3398,'awaiting_review','paid','live',1,?,?,?)").run(id,'h','buyer@customer.co.uk',JSON.stringify(data),new Date().toISOString(),new Date().toISOString());
 let sends=0;env.fetch=async(url)=>{if(!url.includes('graph.facebook.com'))return Response.json({});sends++;return sends===1?new Response('x',{status:500}):Response.json({events_received:1});};
 let r=await runMetaPurchaseJobs(env);assert.equal(r.results[0].status,'failed');assert.equal(JSON.parse((await state(env,id)).state).metaPurchase.status,'failed');
 r=await runMetaPurchaseJobs(env);assert.equal(r.results[0].status,'sent');
 r=await runMetaPurchaseJobs(env);assert.deepEqual(r.results,[]);assert.equal(sends,2);
 const m=JSON.parse((await state(env,id)).state).metaPurchase;assert.equal(m.status,'sent');assert.equal(m.attempts,2);
});

test('10% preview reminder code works at the current price without a quote',async()=>{
 const env=environment(),{id}=await create(env),o=await state(env,id),code='CQ1234567890';
 env.DB.sqlite.prepare("INSERT INTO reminder_offers(email,discount_code,code_expires_at,email_status) VALUES (?,?,?,'accepted')")
   .run(o.email,code,new Date(Date.now()+86400000).toISOString());
 const response=await request(env,'/'+id+'/apply-offer',{revision:o.revision,code});
 assert.equal(response.status,200);
 const price=PRODUCTS[o.size].pricePence+399;
 assert.equal((await response.json()).amount,price-Math.round(PRODUCTS[o.size].pricePence*0.1));
 assert.equal(env.DB.sqlite.prepare('SELECT redeemed_order_id FROM reminder_offers').get().redeemed_order_id,id);
 assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_quotes').get().n,0);
});

test('a Ziina refusal is saved on the order and emailed to the owner',async()=>{const env=environment(),{id,order}=await create(env);ziinaConnected(env);const mails=[];env.fetch=async(url,init)=>{if(url.includes('api.resend.com')){mails.push(JSON.parse(init.body));return Response.json({id:'m'});}return Response.json({code:'UNAUTHORIZED'},{status:401});};assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,502);const o=await state(env,id),d=JSON.parse(o.state);assert.equal(o.status,'checkout_pending');assert.match(d.payment.error,/HTTP 401, UNAUTHORIZED/);assert.match(d.holdReason,/HTTP 401/);const alert=mails.find(m=>/Payment page failed/.test(m.subject));assert.ok(alert);assert.match(alert.text,/HTTP 401, UNAUTHORIZED/);});

test('Ziina checkout description stays short enough for Ziina',async()=>{const env=environment(),{id,order}=await create(env);ziinaConnected(env);let sent;env.fetch=async(url,init)=>{if(url.includes('/payment_intent')&&init?.body){sent=JSON.parse(init.body);return Response.json({...intent(env,order.amount),redirect_url:'https://pay.ziina.com/x'});}return Response.json(intent(env,order.amount));};await request(env,'/'+id+'/checkout',{revision:order.revision});assert.ok(sent);assert.ok(sent.message.length<=28,sent.message);assert.match(sent.message,new RegExp(id.slice(0,8)));});

test('owner can reopen a failed checkout, draw the whole book early, and the customer sees it before paying',async()=>{
 const env=environment(),{id,order}=await create(env);ziinaConnected(env);env.OPENAI_API_KEY='sk-test';
 env.fetch=async(url)=>url.includes('api.resend.com')?Response.json({id:'m'}):Response.json({code:'MESSAGE_LENGTH_INVALID'},{status:400});
 assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,502);
 let o=await state(env,id);assert.equal(o.status,'checkout_pending');
 assert.equal((await request(env,'/'+id+'/prebuild',{revision:o.revision,page:'cover',confirm:true},{admin:true})).status,409);
 assert.equal((await request(env,'/'+id+'/reopen-checkout',{revision:o.revision,confirm:true})).status,403);
 let r=await request(env,'/'+id+'/reopen-checkout',{revision:o.revision,confirm:true},{admin:true});assert.equal(r.status,200);
 o=await state(env,id);assert.equal(o.status,'saved');assert.equal(o.data.payment,null);assert.equal(o.data.failedPayments.length,1);
 env.fetch=async()=>Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{total_tokens:1}});
 for(const page of ['cover',0]){o=await state(env,id);r=await request(env,'/'+id+'/prebuild',{revision:o.revision,page,confirm:true},{admin:true});assert.equal(r.status,200);}
 o=await state(env,id);assert.equal(o.status,'saved');assert.ok(o.data.art.cover&&o.data.art.scenes[0]);assert.equal(o.data.prebuilt,true);
{const before=o.data.art.scenes[0],tries=o.data.artAttempts;const f=await request(env,'/'+id+'/fix-picture',{revision:o.revision,page:0,instruction:'Remove the toy unicorn from the floor.'},{admin:true});assert.equal(f.status,200);const after=await state(env,id);assert.equal(after.status,'saved');assert.equal(after.payment_status,'unpaid');assert.notEqual(after.data.art.scenes[0],before);assert.equal(after.data.artAttempts,tries+1);o=after;}
 const pub=await (await request(env,'/'+id)).json();assert.equal(pub.peek.cover,o.data.art.cover);assert.equal(pub.peek.scenes[0],o.data.art.scenes[0]);
 assert.equal((await request(env,'/'+id+'/file?file='+o.data.art.scenes[0])).status,200);
 // Watermarked web copy: owner only, then the customer sees it instead of the full-size original.
 const webJpeg='data:image/jpeg;base64,'+btoa(String.fromCharCode(0xFF,0xD8,0xFF,0xD9));
 assert.equal((await request(env,'/'+id+'/peek-web',{revision:o.revision,page:0,image:webJpeg})).status,403);
 r=await request(env,'/'+id+'/peek-web',{revision:o.revision,page:0,image:webJpeg},{admin:true});assert.equal(r.status,200);
 o=await state(env,id);r=await request(env,'/'+id+'/peek-web',{revision:o.revision,page:'cover',image:'data:image/jpeg;base64,/9j/'+'A'.repeat(300000)},{admin:true});assert.equal(r.status,200,'a real-size web copy (about 300 KB) must be accepted');
 o=await state(env,id);const webKey=o.data.peekWeb.scenes[0];assert.ok(webKey&&webKey!==o.data.art.scenes[0]);
 const pub2=await (await request(env,'/'+id)).json();assert.equal(pub2.peek.scenes[0],webKey);
 assert.equal((await request(env,'/'+id+'/file?file='+webKey)).status,200);
 assert.equal((await request(env,'/'+id+'/file?file='+o.data.art.scenes[0])).status,404);
 env.fetch=async(url,init)=>url.includes('/payment_intent')&&init?.body?Response.json({...intent(env,o.amount),redirect_url:'https://pay.ziina.com/x'}):Response.json(intent(env,o.amount));
 assert.equal((await request(env,'/'+id+'/preview-pdf',undefined,{admin:true})).status,409);assert.equal((await request(env,'/'+id+'/preview-pdf')).status,403);
 const mails=[];env.fetch=async(url,init)=>{mails.push({url,body:JSON.parse(init.body)});return Response.json({id:'m'});};
 r=await request(env,'/'+id+'/rescue-email',{revision:o.revision,to:'owner',confirm:true},{admin:true});assert.equal(r.status,200);{const before=mails.length;const n=await request(env,'/'+id+'/rescue-email',{revision:o.revision,to:'owner',confirm:true,greeting:'Hi Jan,',note:'Sorry, that <b>link</b> was broken.'},{admin:true});assert.equal(n.status,200);const m=JSON.stringify(mails.at(-1));assert.equal(mails.length,before+1);assert.ok(m.includes('Hi Jan,')&&m.includes('Sorry, that  b link /b  was broken.')||m.includes('Sorry, that'));assert.ok(!m.includes('<b>link'));}
 assert.equal(mails.at(-1).body.to[0],env.ORDERS_ADMIN_EMAIL);assert.match(mails.at(-1).body.subject,/Preview, not sent to customer/);assert.equal(mails.at(-1).body.attachments.length,2);assert.match(mails.at(-1).body.html,/cid:cover/);assert.match(mails.at(-1).body.text,/order\.html\?id=/);
 assert.equal((await request(env,'/'+id+'/rescue-email',{revision:o.revision,to:'customer',confirm:true})).status,403);
 o=await state(env,id);r=await request(env,'/'+id+'/rescue-email',{revision:o.revision,to:'customer',confirm:true},{admin:true});assert.equal(r.status,200);assert.equal(mails.at(-1).body.to[0],'qa-order@example.test');
 o=await state(env,id);assert.equal(o.data.emails.rescue.sent,true);assert.equal((await request(env,'/'+id+'/rescue-email',{revision:o.revision,to:'customer',confirm:true},{admin:true})).status,409);
 env.fetch=async(url,init)=>url.includes('/payment_intent')&&init?.body?Response.json({...intent(env,o.amount),redirect_url:'https://pay.ziina.com/x'}):Response.json(intent(env,o.amount));o=await state(env,id);
 r=await request(env,'/'+id+'/checkout',{revision:o.revision});assert.equal(r.status,200);assert.match((await r.json()).url,/pay\.ziina\.com/);
});

test('owner can draw and email a book whose card page opened but was not paid; an ended card page is replaced, an open one reused',async()=>{
 const env=environment(),{id,order}=await create(env);ziinaConnected(env);env.OPENAI_API_KEY='sk-test';env.RESEND_API_KEY='re_test';env.ORDER_EMAIL_FROM='orders@example.test';
 let ziinaStatus='requires_payment_instrument',made=0;const mails=[];
 env.fetch=async(url,init)=>{if(url.includes('api.resend.com')){mails.push(JSON.parse(init.body));return Response.json({id:'m'});}if(url.includes('api.openai.com'))return Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{total_tokens:1}});if(url.includes('/payment_intent')&&init?.method==='POST'){made++;return Response.json({...intent(env,order.amount),id:'ziina-intent-'+made});}return Response.json({...intent(env,order.amount,ziinaStatus),id:'ziina-intent-'+made});};
 assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,200);
 let o=await state(env,id);assert.equal(o.status,'awaiting_payment');
 assert.equal((await request(env,'/'+id+'/prebuild',{revision:o.revision,page:'cover',confirm:true})).status,403);
 let r=await request(env,'/'+id+'/prebuild',{revision:o.revision,page:'cover',confirm:true},{admin:true});assert.equal(r.status,200);
 o=await state(env,id);r=await request(env,'/'+id+'/prebuild',{revision:o.revision,page:0,confirm:true},{admin:true});assert.equal(r.status,200);
 o=await state(env,id);assert.equal(o.status,'awaiting_payment');assert.equal(o.session_id,'ziina-intent-1');
 r=await request(env,'/'+id+'/rescue-email',{revision:o.revision,to:'owner',confirm:true},{admin:true});assert.equal(r.status,200);assert.ok(!JSON.stringify(mails.at(-1)).includes('sorry'));
 o=await state(env,id);r=await request(env,'/'+id+'/checkout',{revision:o.revision});assert.equal(r.status,200);assert.equal(made,1,'an open card page is reused');
 ziinaStatus='canceled';o=await state(env,id);r=await request(env,'/'+id+'/checkout',{revision:o.revision});assert.equal(r.status,200);assert.equal(made,2,'an ended card page is replaced');
 o=await state(env,id);assert.equal(o.session_id,'ziina-intent-2');assert.equal(o.status,'awaiting_payment');assert.equal(o.data.failedPayments.at(-1).sessionId,'ziina-intent-1');
 ziinaStatus='pending';o=await state(env,id);assert.equal((await request(env,'/'+id+'/checkout',{revision:o.revision})).status,409);assert.equal(made,2,'a payment in progress is never replaced');
});

test('a confirmed sale retains the original organic search engine, landing page, and visit',async()=>{
  const env=environment(),measurement={visitId:crypto.randomUUID(),source:'organic_search',medium:'organic',campaign:'google',creative:'seo_birthday'};
  const {id}=await create(env,'a5',measurement);
  env.DB.sqlite.prepare("UPDATE customer_orders SET email='reader@customer.co.uk',status='awaiting_payment',session_id='cs_live_test' WHERE id=?").run(id);
  connected(env);
  const event={id:'evt_organic',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_test',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};
  assert.equal((await signedEvent(env,event)).status,200);
  const sale=env.DB.sqlite.prepare("SELECT visit_id AS visitId,source,medium,campaign,creative FROM campaign_events WHERE event='purchase_confirmed'").get();
  assert.deepEqual({...sale},measurement);
});

test('the customer story wishes are saved on the order and shown only to the owner',async()=>{
 const env=environment(),{id,order}=await create(env);
 assert.equal(order.wishes,undefined);
 const saved=await state(env,id);assert.equal(saved.data.wishes.details,'Loves her grey cat Pepper and the beach');assert.equal(saved.data.wishes.idea,'The missing sandwich');
 const r=await request(env,'/'+id,undefined,{admin:true});const owner=await r.json();assert.equal(owner.wishes.details,'Loves her grey cat Pepper and the beach');assert.equal(owner.wishes.mood,'adventure');
});
test('before payment: owner builds a whole-book preview, customer flips it and buys A4 or A5 straight from the book page',async()=>{
 const env=environment(),{id,order}=await create(env);ziinaConnected(env);env.OPENAI_API_KEY='sk-test';env.RESEND_API_KEY='re_test';env.ORDER_EMAIL_FROM='orders@example.test';
 let ziinaStatus='requires_payment_instrument',made=0,amount=order.amount;const mails=[];
 env.fetch=async(url,init)=>{if(url.includes('api.resend.com')){mails.push(JSON.parse(init.body));return Response.json({id:'m'});}if(url.includes('api.openai.com'))return Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{total_tokens:1}});if(url.includes('/payment_intent')&&init?.method==='POST'){made++;amount=JSON.parse(init.body).amount;return Response.json({...intent(env,amount),id:'ziina-intent-'+made});}return Response.json({...intent(env,amount,ziinaStatus),id:'ziina-intent-'+made});};
 assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,200);
 let o=await state(env,id);
 for(const page of ['cover',0,1,2,3,4,5,6,7,8,9,'back']){o=await state(env,id);assert.equal((await request(env,'/'+id+'/prebuild',{revision:o.revision,page,confirm:true},{admin:true})).status,200,'draw '+page);}
 o=await state(env,id);assert.ok(o.data.art.back);assert.equal(o.status,'awaiting_payment');
 assert.equal((await request(env,'/'+id+'/preview-email',{revision:o.revision,to:'owner'},{admin:true})).status,409,'no email before the preview exists');
 assert.equal((await request(env,'/'+id+'/preview-book',{revision:o.revision})).status,403);
 let r=await request(env,'/'+id+'/preview-book',{revision:o.revision},{admin:true});assert.equal(r.status,200);
 o=await state(env,id);assert.equal(o.status,'awaiting_payment');assert.ok(!o.data.proof);const hash=o.data.preview.hash;
 let cust=await (await request(env,'/'+id)).json();assert.equal(cust.previewBook.hash,hash);assert.equal(cust.bookPages,null);
 const total=BOOK.pdfPages;
 const img='data:image/jpeg;base64,'+jpeg.subarray(0,200000).toString('base64');
 for(let page=0;page<total;page++){o=await state(env,id);assert.equal((await request(env,'/'+id+'/proof-web',{revision:o.revision,hash,page,total,image:img},{admin:true})).status,200);}
 cust=await (await request(env,'/'+id)).json();assert.equal(cust.bookPages.length,total);
 assert.equal((await request(env,'/'+id+'/file?file='+cust.bookPages[0])).status,200,'customer opens a page');
 o=await state(env,id);r=await request(env,'/'+id+'/preview-email',{revision:o.revision,to:'owner'},{admin:true});assert.equal(r.status,200);let m=mails.at(-1);assert.ok(m.subject.startsWith('[Test] '));assert.ok(m.text.includes('/book.html?id='+id+'&test=1#key='));assert.notEqual(m.to[0],o.email);
 o=await state(env,id);r=await request(env,'/'+id+'/preview-email',{revision:o.revision,to:'customer',greeting:'Hi Jan,',note:'Sorry the last link didn’t work.'},{admin:true});assert.equal(r.status,200);m=mails.at(-1);
 assert.equal(m.to[0],o.email);assert.equal(m.from,'orders@example.test');assert.ok(m.text.includes('Hi Jan,')&&m.text.includes('Sorry the last link'));assert.ok(m.text.includes('I’ve put together Jamie’s whole book'));assert.ok(m.text.includes('See Jamie’s book: '));assert.ok(!m.html.includes('<img src="cid:'),'no attachments');assert.ok(m.text.includes('/book.html?id='+id+'#key='));
 // The email shows the whole book: cover, ten spreads of two, back cover, all from signed public picture links.
 const pics=[...m.html.matchAll(/src="([^"]*\/preview-image\?[^"]*)"/g)].map(x=>x[1].replaceAll('&amp;','&'));assert.equal(pics.length,0,'link only, like the proof email');
 // A4 from the book page: the open A5 card page is retired and a new A4 one made.
 o=await state(env,id);r=await request(env,'/'+id+'/checkout',{revision:o.revision,size:'a4'});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));assert.equal(made,2);
 o=await state(env,id);assert.equal(o.size,'a4');assert.equal(o.amount,PRODUCTS.a4.pricePence+399);assert.equal(o.session_id,'ziina-intent-2');assert.equal(o.status,'awaiting_payment');assert.equal(o.data.failedPayments.at(-1).replacedForSize,'a4');
 r=await request(env,'/'+id+'/checkout',{revision:o.revision,size:'a4'});assert.equal(r.status,200);assert.equal(made,2,'same size reuses the open card page');
 ziinaStatus='pending';o=await state(env,id);assert.equal((await request(env,'/'+id+'/checkout',{revision:o.revision,size:'a5'})).status,409);o=await state(env,id);assert.equal(o.size,'a4','a payment in progress keeps its size');
});
test('gift sender wording is not doubled in the book',()=>{for(const [i,o] of [['With love from Nanny and Grandad','Nanny and Grandad'],['love from Mum','Mum'],['From Auntie Sue','Auntie Sue'],['With lots of love from Dad','Dad'],['Nanny and Grandad','Nanny and Grandad'],['Love','Love']])assert.equal(giver(i),o);});
test('owner thank-you discount: £5 off applied at checkout, kept when switching size, open card page at old price retired',async()=>{
 const env=environment(),{id,order}=await create(env);ziinaConnected(env);let made=0,amount=order.amount,status='requires_payment_instrument';
 env.fetch=async(url,init)=>{if(url.includes('/payment_intent')&&init?.method==='POST'){made++;amount=JSON.parse(init.body).amount;return Response.json({...intent(env,amount),id:'ziina-intent-'+made});}return Response.json({...intent(env,amount,status),id:'ziina-intent-'+made});};
 assert.equal((await request(env,'/'+id+'/checkout',{revision:order.revision})).status,200);
 let o=await state(env,id);assert.equal((await request(env,'/'+id+'/gift-discount',{revision:o.revision,amountPence:500,confirm:true})).status,403);
 let r=await request(env,'/'+id+'/gift-discount',{revision:o.revision,amountPence:500,confirm:true},{admin:true});assert.equal(r.status,200);
 o=await state(env,id);assert.equal(o.amount,PRODUCTS[o.size].pricePence+399-500);assert.equal(o.session_id,null);assert.equal(o.data.discount.ownerGift,true);
 assert.equal((await request(env,'/'+id+'/gift-discount',{revision:o.revision,amountPence:500,confirm:true},{admin:true})).status,409,'only once');
 r=await request(env,'/'+id+'/checkout',{revision:o.revision});assert.equal(r.status,200);assert.equal(made,2);assert.equal(amount,PRODUCTS[o.size].pricePence+399-500,'Ziina charges the discounted price');
 o=await state(env,id);const other=o.size==='a4'?'a5':'a4';r=await request(env,'/'+id+'/checkout',{revision:o.revision,size:other});assert.equal(r.status,200);assert.equal(made,3);
 o=await state(env,id);assert.equal(o.size,other);assert.equal(o.amount,PRODUCTS[other].pricePence+399-500);assert.equal(amount,o.amount);
 const pub=await (await request(env,'/'+id)).json();assert.equal(pub.discount.amountPence,500);
});
test('a refused print order keeps Prodigi’s reason on the order and empty address fields are not sent',async()=>{const env=environment(),{id}=await create(env);connected(env);env.orderId=id;await paid(env,id);let o=await approveBoth(env,id);liveFetch(env);const real=env.fetch;let sent;env.fetch=async(url,init)=>{if(String(url).endsWith('/orders')&&init?.method==='POST'){sent=JSON.parse(init.body);env.calls.push({url:String(url),opts:init});return Response.json({statusCode:400,outcome:'ValidationFailed',failures:{'items[0].assets':[{code:'NotValid',providedValue:null}]},traceParent:'00-abc'},{status:400});}return real(url,init);};
 const r=await request(env,'/'+id+'/submit',{revision:o.revision,confirm:true,proofHash:o.proof.hash,maxCostPence:2000},{admin:true});assert.equal(r.status,502);const e=await r.json();assert.match(e.error,/ValidationFailed/);assert.match(e.error,/items\[0\]\.assets/);
 o=await state(env,id);assert.equal(o.status,'supplier_unknown');assert.match(o.data.supplierError.message,/400/);for(const v of Object.values(sent.recipient.address))assert.ok(String(v).trim());assert.ok(!sent.recipient.email);});
test('paid book draws itself from the order desk loop, and every picture gets the fixed cast list plus earlier pictures of the book',async()=>{const env=environment(),{id}=await create(env);connected(env);env.OPENAI_API_KEY='test-image-key';env.DB.sqlite.prepare("UPDATE customer_orders SET status='awaiting_payment',session_id='cs_live_auto' WHERE id=?").run(id);
 const e={id:'evt_auto',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_auto',client_reference_id:id,metadata:{cq_order_id:id},amount_total:2898,currency:'gbp',payment_status:'paid'}}};assert.equal((await signedEvent(env,e)).status,200);
 let castCalls=0;const draws=[];env.fetch=async(url,init)=>{if(String(url).includes('/v1/responses')){castCalls++;return Response.json({output_text:JSON.stringify({items:[{name:'the cat',look:'small grey tabby cat with a white chest'}]})});}if(String(url).includes('/images/')){const names=[...init.body.entries()].filter(([k])=>k==='image[]').map(([,v])=>v.name);draws.push({prompt:init.body.get('prompt'),names});}return Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{input_tokens:1}});};
 assert.equal((await request(env,'/artwork-step',{})).status,401,'customers cannot drive it');
 let last;for(let i=0;i<14;i++){const r=await request(env,'/artwork-step',{},{admin:true});assert.equal(r.status,200);last=await r.json();if(last.proofReady)break;}
 assert.equal(last.proofReady,true);const row=await state(env,id);assert.equal(row.status,'proof_ready');assert.equal(castCalls,1,'cast list written once per book');assert.equal(row.data.cast[0].name,'the cat');
 assert.ok(draws.every(d=>d.prompt.includes('small grey tabby cat with a white chest')),'every picture gets the cast list');
 assert.ok(!draws[0].names.includes('book-cover.jpg'),'the cover has no earlier picture');assert.ok(draws[1].names.includes('book-cover.jpg')&&!draws[1].names.includes('previous-page.jpg'),'page 1 copies the cover');assert.ok(draws[2].names.includes('previous-page.jpg'),'later pages copy the page before');
 assert.ok(draws.every(d=>d.prompt.includes('Do not add any pet, animal or person')));
 const nothing=await (await request(env,'/artwork-step',{},{admin:true})).json();assert.equal(nothing.worked,false);});

test('one-hour price hold: offer price within the hour, regular price after it, and the timer the shopper sees is the server\'s',async()=>{
 const env=environment();ziinaConnected(env);
 // Inside the hour: the usual offer price, and the catalogue reports when the hold ends.
 const early=await create(env,'a4');assert.equal(early.order.amount,2999+399);assert.equal(early.order.fullPrice,false);
 const c=await (await request(env,'/catalog?preview='+early.body.previewId,null,{auth:false})).json();
 assert.ok(Math.abs(Date.parse(c.hold.endsAt)-Date.parse(c.hold.now)-3600000)<5000);
 assert.equal((await (await request(env,'/catalog',null,{auth:false})).json()).hold,undefined);
 // After the hour: a book saved from that preview costs the regular price, and stays there across sizes.
 const preview=crypto.randomUUID(),id=crypto.randomUUID(),email='late@example.test',old=new Date(Date.now()-2*3600000).toISOString();
 env.DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,created_at,email) VALUES (?,'succeeded',?,?)").run(preview,old,email);
 env.DB.sqlite.prepare("INSERT INTO preview_contacts(email,source,medium,campaign,creative,country,created_at,updated_at) VALUES (?,'direct','none','none','none','GB',?,?)").run(email,old,old);
 const r=await request(env,'',{...early.body,requestId:id,previewId:preview,email,size:'a4'});assert.equal(r.status,201);
 let late=(await r.json()).order;assert.equal(late.amount,3999+399);assert.equal(late.fullPrice,true);
 let amount=0;env.fetch=async(url,init)=>{if(url.includes('/payment_intent')&&init?.method==='POST')amount=JSON.parse(init.body).amount;return Response.json({...intent(env,amount||late.amount),id:'ziina-late'});};
 assert.equal((await request(env,'/'+id+'/checkout',{revision:late.revision,size:'a5'})).status,200);
 late=await state(env,id);assert.equal(late.amount,3499+399);
 // The price the page reports must match the hold: the offer price is refused once the hour is up.
 const view={email,previewId:preview,size:'a4'};
 assert.equal((await request(env,'/quote-view',{...view,pricePence:2999},{auth:false})).status,400);
 assert.equal((await request(env,'/quote-view',{...view,pricePence:3999},{auth:false})).status,200);
});
test('owner 10% thank-you is worked out per size, shown per size on the book page, and recalculated on a size change',async()=>{
 const {orderTotal}=await import('../src/catalog.js');const env=environment(),{id,order}=await create(env);ziinaConnected(env);let amount=order.amount,made=0;
 env.fetch=async(url,init)=>{if(url.includes('/payment_intent')&&init?.method==='POST'){made++;amount=JSON.parse(init.body).amount;return Response.json({...intent(env,amount),id:'ziina-intent-'+made});}return Response.json({...intent(env,amount),id:'ziina-intent-'+made});};
 let o=await state(env,id);assert.equal((await request(env,'/'+id+'/gift-discount',{revision:o.revision,percent:10,confirm:true})).status,403);
 for(const percent of [4,25,10.5,'10'])assert.equal((await request(env,'/'+id+'/gift-discount',{revision:o.revision,percent,confirm:true},{admin:true})).status,400,'percent '+percent);
 assert.equal((await request(env,'/'+id+'/gift-discount',{revision:o.revision,percent:10,confirm:true},{admin:true})).status,200);
 const tenth=size=>Math.round(orderTotal(size)*10/100);o=await state(env,id);assert.equal(o.size,'a5');assert.equal(o.amount,orderTotal('a5')-tenth('a5'));assert.deepEqual([o.data.discount.code,o.data.discount.percent,o.data.discount.amountPence],['THANKYOU10PC',10,tenth('a5')]);
 const pub=await (await request(env,'/'+id)).json();assert.deepEqual(pub.discount.offBySize,{a4:tenth('a4'),a5:tenth('a5')});
 assert.equal((await request(env,'/'+id+'/checkout',{revision:o.revision,size:'a4'})).status,200);o=await state(env,id);assert.equal(o.amount,orderTotal('a4')-tenth('a4'));assert.equal(amount,o.amount,'Ziina charges 10% off the A4 price');assert.equal(o.data.discount.amountPence,tenth('a4'));
 const html=readFileSync(new URL('../dist/client/book.html',import.meta.url),'utf8');assert.match(html,/g\.percent\+'%'/);assert.match(html,/offBySize\?\.\[size\]/);
});
test('recent characters: owner lists emailed drafts without keys, turns one into a saved A4 book once, and can draw it',async()=>{
 const {orderTotal}=await import('../src/catalog.js');const env=environment();connected(env);env.OPENAI_API_KEY='test-image-key';
 env.fetch=async(url)=>{url=String(url);if(url.includes('api.resend.com'))return Response.json({id:'mail'});if(url.includes('/v1/responses'))return Response.json({output_text:JSON.stringify({items:[]})});if(url.includes('/images/'))return Response.json({data:[{b64_json:jpeg.toString('base64')}],usage:{}});throw Error('unexpected '+url);};
 const receipt=(ago=0)=>{const pid=crypto.randomUUID();env.DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,created_at) VALUES (?,'succeeded',?)").run(pid,new Date(Date.now()-ago).toISOString());return pid;};
 const put=async(email,pid,names)=>{const draftId=crypto.randomUUID(),draft={state:{names,age:'3-5',storyDraft:story,characterImages:[dataUrl],previewId:pid,details:'Loves owls',mood:'adventure',storyMode:'invent',ideas:[['The owl who lost her hoot','x']],selected:0},values:{names,dedication:'For '+names,'sender-name':'Gran'}};assert.equal((await request(env,'/drafts/'+draftId,{draft,previewId:pid,email},{method:'PUT'})).status,200);return draftId;};
 const mayaDraft=await put('maya@example.test',receipt(2*3600000),'Maya');await put('buyer@example.test',receipt(),'Ben');
 env.DB.sqlite.prepare("INSERT INTO customer_orders (id,token_hash,email,size,amount,status,payment_status,revision,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(),'x','buyer@example.test','a4',4398,'awaiting_review','paid',1,'{}',new Date().toISOString(),new Date().toISOString());
 assert.equal((await request(env,'/recent-drafts')).status,401);
 let r=await request(env,'/recent-drafts',null,{admin:true});assert.equal(r.status,200);let d=await r.json();
 assert.deepEqual(d.drafts.map(x=>[x.email,x.names,x.title]),[['maya@example.test','Maya',story.title]],'buyers are left out');assert.ok(d.drafts[0].expiresAt&&d.drafts[0].characterAt);
 const raw=JSON.stringify(d);assert.ok(!raw.includes(mayaDraft)&&!raw.includes('data:image')&&!raw.includes('key'),'no draft ids, keys or pictures');
 assert.equal((await request(env,'/from-draft',{email:'maya@example.test'})).status,401);
 assert.equal((await request(env,'/from-draft',{email:'maya@example.test'},{admin:true,headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await request(env,'/from-draft',{email:'nobody@example.test'},{admin:true})).status,404);
 r=await request(env,'/from-draft',{email:'Maya@Example.test'},{admin:true});assert.equal(r.status,201);const made=(await r.json()).order;
 let o=await state(env,made.id);assert.equal(o.status,'saved');assert.equal(o.payment_status,'unpaid');assert.equal(o.size,'a4');assert.equal(o.email,'maya@example.test');assert.equal(o.session_id,null);
 assert.equal(o.amount,orderTotal('a4',true),'the price hold from their preview has ended');assert.equal(o.data.fullPrice,true);
 assert.equal(o.data.names,'Maya');assert.equal(o.data.senderName,'Gran');assert.equal(o.data.dedication,'For Maya');assert.equal(o.data.wishes.idea,'The owl who lost her hoot');assert.equal(o.data.recipient.name,'');assert.equal(o.data.fromDraft.draftId,mayaDraft);assert.equal(o.data.characters.length,1);assert.equal(o.data.story.title,story.title);
 assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM order_audit WHERE order_id=? AND kind='created_from_draft'").get(made.id).n,1);
 r=await request(env,'/from-draft',{email:'maya@example.test'},{admin:true});assert.equal(r.status,200);const again=await r.json();assert.equal(again.existing,true);assert.equal(again.order.id,made.id);
 assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM customer_orders WHERE email='maya@example.test'").get().n,1,'one book per draft');
 d=await (await request(env,'/recent-drafts',null,{admin:true})).json();assert.equal(d.drafts.length,0,'made drafts drop off the list');
 r=await request(env,'/'+made.id+'/prebuild',{revision:o.revision,page:'cover',confirm:true},{admin:true});assert.equal(r.status,200);o=await state(env,made.id);assert.ok(o.data.art.cover);assert.equal(o.data.prebuilt,true);
 const link=await request(env,'/'+made.id+'/customer-link',{revision:o.revision},{admin:true});const key=(await link.json()).url.split('#key=')[1];assert.equal((await ordersApi(new Request(origin+'/api/orders/'+made.id,{headers:{Authorization:'Bearer '+key}}),env)).status,200,'the new book has its own private key');
});
test('order desk watermarks unpaid preview phone pages only',async()=>{
 const {runInNewContext}=await import('node:vm');const src=readFileSync(new URL('../dist/client/orders-admin.js',import.meta.url),'utf8');
 const ctx={Math};runInNewContext(src.match(/const markPages=[^\n]*/)[0].replace('const markPages','markPages')+'\n'+src.match(/function stampPreview[^\n]*/)[0],ctx);
 assert.equal(ctx.markPages({paymentStatus:'unpaid',proof:null,previewBook:{hash:'h'}}),true);assert.equal(ctx.markPages({paymentStatus:'paid',proof:{hash:'p'},previewBook:null}),false);assert.equal(ctx.markPages({paymentStatus:'unpaid',proof:{hash:'p'},previewBook:null}),false);
 const calls=[];const g=new Proxy({},{get:(t,k)=>k in t?t[k]:(k==='measureText'?()=>({width:400}):(...a)=>calls.push([k,...a])),set:(t,k,v)=>{t[k]=v;return true;}});
 ctx.stampPreview(g,1000,1414);const texts=calls.filter(c=>c[0]==='fillText');assert.ok(texts.length>=15,'repeated across the page');assert.ok(texts.every(c=>c[1]==='Craven & Quill'));assert.equal(g.fillStyle,'rgba(255,255,255,.14)');assert.match(g.strokeStyle,/rgba\(30,24,18/);assert.ok(calls.some(c=>c[0]==='rotate'));
 assert.match(src,/if\(mark\)stampPreview\(/);
});
