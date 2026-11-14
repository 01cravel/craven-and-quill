import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyticsApi,ukMidnight,ukDay,FUNNEL} from '../src/analytics.js';
import {campaignApi,shortIp} from '../dist/server/campaign.js';
import worker from '../dist/server/index.js';
import {testDb} from './sqlite-d1.mjs';

const origin='https://cq.test',ownerToken='b'.repeat(64),owner={Cookie:'__Host-cq_owner='+ownerToken};
function environment(){
  const DB=testDb();
  DB.sqlite.exec('CREATE TABLE owner_login_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL)');
  DB.sqlite.prepare('INSERT INTO owner_login_sessions VALUES (?,?)').run(createHash('sha256').update(ownerToken).digest('hex'),'2999-01-01T00:00:00.000Z');
  return {DB};
}
const get=(env,query='',headers=owner)=>analyticsApi(new Request(origin+'/api/owner-analytics'+query,{headers}),env);
const spend=(env,body,headers={})=>analyticsApi(new Request(origin+'/api/owner-analytics/spend',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...owner,...headers},body:JSON.stringify(body)}),env);
const day=ukDay(Date.now());
function visit(env,events,{creative='d_static',source='meta',country='GB',at=new Date().toISOString()}={}){
  const id=crypto.randomUUID();
  for(const e of events)env.DB.sqlite.prepare('INSERT INTO campaign_events VALUES (?,?,?,?,?,?,?,?,?)').run(id+':'+e,id,e,source,'paid_social','cq_d',creative,country,at);
  return id;
}
function order(env,{visitId=null,creative='d_static',paid=true,email='buyer@example.test',amount=3999,mode='live'}={}){
  const id=crypto.randomUUID(),state={names:'Ruby',age:'3-5',story:{title:'Ruby and the Moon',synopsis:'A night trip.'},characters:['c1'],measurement:visitId?{visitId,source:'meta',medium:'paid_social',campaign:'cq_d',creative,country:'GB'}:null};
  env.DB.sqlite.prepare("INSERT INTO customer_orders (id,token_hash,email,size,amount,status,payment_status,payment_mode,revision,state,created_at,updated_at) VALUES (?,?,?,'a5',?,?,?,?,1,?,?,?)").run(id,'h',email,amount,paid?'awaiting_review':'saved',paid?'paid':'unpaid',paid?mode:null,JSON.stringify(state),new Date().toISOString(),new Date().toISOString());
  return id;
}

test('analytics is owner-only, including through the site worker',async()=>{
  const env=environment();
  assert.equal((await get(env,'',{})).status,401);
  assert.equal((await get(env,'',{Cookie:'__Host-cq_owner='+'c'.repeat(64)})).status,401);
  assert.equal((await get(env,'',{'oai-authenticated-user-email':'cravenluke@gmail.com'})).status,401);
  assert.equal((await worker.fetch(new Request(origin+'/api/owner-analytics'),env)).status,401);
  const r=await worker.fetch(new Request(origin+'/api/owner-analytics',{headers:owner}),env);
  assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/no-store/);
  assert.equal((await spend(env,{day,creative:'d_static',pounds:5},{Cookie:''})).status,401);
});

test('funnel counts each visit once per step, shows losses and links measured paid orders',async()=>{
  const env=environment();
  const buyer=visit(env,['maker_start','step_1','step_2','preview_start','preview_success','step_5','step_4','price_visible','step_7','checkout_start','device_mobile']);
  visit(env,['maker_start','step_1','step_2','preview_start','preview_error','device_mobile']);
  visit(env,['landing_view','device_desktop'],{creative:'none',source:'direct'});
  order(env,{visitId:buyer});
  order(env,{email:'cravenluke@gmail.com',amount:200});
  const d=await(await get(env)).json();
  const count=step=>d.funnel.find(f=>f.step===step).visits;
  assert.deepEqual(d.funnel.map(f=>f.step),FUNNEL.map(([s])=>s));
  assert.equal(count('visit'),3);assert.equal(count('maker_start'),2);assert.equal(count('preview_success'),1);assert.equal(count('paid'),1);
  assert.equal(d.errorVisits.preview_error,1);
  assert.equal(d.headline.sales,1);assert.equal(d.headline.revenuePence,3999);assert.equal(d.headline.testOrders,1);
  assert.deepEqual(d.traffic.device.map(x=>[x.key,x.count]),[['mobile',2],['desktop',1]]);
  assert.equal(d.journeys[0].device!==undefined,true);
  assert.equal(d.journeys.find(j=>j.steps.includes('paid')).furthest,'Paid');
  assert.ok(d.errors.some(e=>e.kind==='Preview failed'));
  // A measured buyer's journey shows the book they saved; the raw visit id is never sent to the page.
  const bought=d.journeys.find(j=>j.made?.book);assert.equal(bought.made.book.title,'Ruby and the Moon');assert.equal(bought.made.book.paid,true);assert.equal(bought.made.email,'buyer@example.test');
  assert.ok(!JSON.stringify(d).includes(buyer));assert.equal(d.orders[0].visitId,undefined);
});

test('ad filter narrows funnel, sales and spend, and cost per sale uses entered spend',async()=>{
  const env=environment();
  const a=visit(env,['maker_start','preview_start','preview_success','checkout_start'],{creative:'d_static'});
  visit(env,['maker_start'],{creative:'d_video'});visit(env,['maker_start'],{creative:'d_video'});
  order(env,{visitId:a,creative:'d_static'});
  assert.equal((await spend(env,{day,creative:'d_static',pounds:12.5})).status,200);
  assert.equal((await spend(env,{day,creative:'d_video',pounds:7.5})).status,200);
  assert.equal((await spend(env,{day,creative:'d_video',pounds:8})).status,200);
  const all=await(await get(env)).json();
  assert.equal(all.headline.visits,3);assert.equal(all.headline.spendPence,2050);assert.equal(all.headline.costPerSalePence,2050);
  assert.deepEqual(all.options.creatives,['d_static','d_video']);
  const video=all.ads.find(x=>x.creative==='d_video');assert.equal(video.visits,2);assert.equal(video.spendPence,800);assert.equal(video.sales,0);
  const only=await(await get(env,'?creative=d_static')).json();
  assert.equal(only.headline.visits,1);assert.equal(only.headline.sales,1);assert.equal(only.headline.spendPence,1250);assert.equal(only.headline.costPerSalePence,1250);
  assert.equal(only.funnel.find(f=>f.step==='paid').visits,1);
  assert.equal((await spend(env,{day,creative:'d_static',pounds:0})).status,200);
  assert.equal((await(await get(env,'?creative=d_static')).json()).headline.spendPence,0);
});

test('spend entry refuses cross-site posts and bad input',async()=>{
  const env=environment();
  assert.equal((await spend(env,{day,creative:'d_static',pounds:5},{Origin:'https://evil.test'})).status,403);
  for(const body of [{day:'yesterday',creative:'x',pounds:1},{day,creative:'<b>',pounds:1},{day,creative:'x',pounds:-1},{day,creative:'x',pounds:'lots'}])assert.equal((await spend(env,body)).status,400);
  assert.equal((await(await get(env)).json()).spend.length,0);
});

test('date range uses UK days and excludes events outside it',async()=>{
  const env=environment();
  visit(env,['maker_start'],{at:'2026-07-01T22:30:00.000Z'});// 23:30 on 1 July, UK summer time
  visit(env,['maker_start'],{at:'2026-07-02T00:30:00.000Z'});
  assert.equal(ukMidnight('2026-07-02'),'2026-07-01T23:00:00.000Z');
  assert.equal(ukMidnight('2026-11-02'),'2026-11-02T00:00:00.000Z');
  const d=await(await get(env,'?from=2026-07-01&to=2026-07-01')).json();
  assert.equal(d.headline.visits,1);assert.equal(d.traffic.byHour.find(h=>h.hour===23).visits,1);
  assert.deepEqual(d.range,{from:'2026-07-01',to:'2026-07-01'});
});

test('previews, emails, quotes and failures appear in what people made',async()=>{
  const env=environment(),now=new Date().toISOString();
  env.DB.sqlite.prepare("INSERT INTO preview_receipts VALUES (?,?,?,?)").run(crypto.randomUUID(),'succeeded',now,'maker@example.test');
  env.DB.sqlite.prepare("INSERT INTO preview_receipts VALUES (?,?,?,?)").run(crypto.randomUUID(),'failed',now,'maker@example.test');
  env.DB.sqlite.prepare("INSERT INTO preview_contacts VALUES (?,?,?,?,?,?,?,?)").run('maker@example.test','meta','paid_social','cq_d','d_video','GB',now,now);
  env.DB.sqlite.prepare("INSERT INTO preview_daily_usage VALUES (?,?)").run(day,50);
  order(env,{email:'maker@example.test',paid:false});
  const d=await(await get(env)).json();
  assert.equal(d.headline.previewsTried,2);assert.equal(d.headline.previewsMade,1);assert.equal(d.headline.booksSaved,1);assert.equal(d.headline.sales,0);
  assert.equal(d.previews[0].triesByEmail,2);assert.equal(d.previews[0].creative,'d_video');assert.equal(d.previews[0].savedBook,'Ruby and the Moon');
  assert.equal(d.orders[0].names,'Ruby');assert.equal(d.orders[0].title,'Ruby and the Moon');
  assert.ok(d.errors.some(e=>e.kind==='Daily free preview limit reached'));
  assert.ok(d.errors.some(e=>e.kind==='Drawing service refused or failed'));
});

test('one people view joins every email record, and keeps unlinked visits visible',async()=>{
  const env=environment(),now=new Date().toISOString(),email='reader@example.test';
  const linked=visit(env,['maker_start','step_2','step_1','step_10','preview_start','preview_success','step_8','step_9','step_3','step_4','step_6','price_visible','step_11','step_7']);
  visit(env,['maker_start','step_2']);
  env.DB.sqlite.prepare('INSERT INTO visit_links VALUES (?,?,?,?)').run(linked,'contact',email,now);
  env.DB.sqlite.prepare('INSERT INTO preview_contacts VALUES (?,?,?,?,?,?,?,?)').run(email,'meta','paid_social','cq_d','d_static','GB',now,now);
  env.DB.sqlite.prepare('INSERT INTO preview_receipts VALUES (?,?,?,?)').run(crypto.randomUUID(),'succeeded',now,email);
  env.DB.sqlite.prepare('INSERT INTO preview_receipts VALUES (?,?,?,?)').run(crypto.randomUUID(),'failed',now,null);
  env.DB.sqlite.prepare('INSERT INTO customer_quotes (email,size,price_pence,catalogue_version,first_shown_at,last_shown_at,confirmed_view_at,unsubscribe_token) VALUES (?,?,?,?,?,?,?,?)').run(email,'a5',3999,'v1',now,now,now,crypto.randomUUID());
  order(env,{visitId:linked,email,paid:false});
  env.DB.sqlite.prepare('INSERT INTO launch_leads (email,product,price_pence,consent_version,consent_text,consent_at,source,medium,campaign,creative,visit_id,preview_id,country,unsubscribe_token,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('launch@example.test','hardback',3500,'v1','consent',now,'meta','paid_social','cq_d','d_static',null,'p','GB',crypto.randomUUID(),now);
  env.DB.sqlite.exec('CREATE TABLE signups (email TEXT PRIMARY KEY, interest TEXT NOT NULL, page TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
  env.DB.sqlite.prepare('INSERT INTO signups VALUES (?,?,?,?,?)').run('colour@example.test','colouring','/',now,now);
  const d=await(await get(env)).json();
  assert.equal(d.knownEmailTotal,3);assert.equal(d.anonymousTotal,2);assert.equal(d.peopleTotal,5);
  const reader=d.people.find(p=>p.email===email);
  assert.equal(reader.visits,1);assert.equal(reader.furthest,'Saved a book');assert.equal(reader.previewMade,1);assert.equal(reader.offerConsent,false);
  assert.deepEqual(reader.activity.sort(),['Preview email','Preview request','Saved book','Saw price'].sort());
  assert.ok(reader.steps.includes('step_11'));
  assert.equal(d.people.find(p=>p.email==='launch@example.test').furthest,'No measured visit');
  assert.ok(d.people.find(p=>p.email==='launch@example.test').activity.includes('Storybook interest list'));
  assert.equal(d.people.find(p=>p.email==='colour@example.test').activity[0],'Colouring list');
  assert.ok(d.people.some(p=>p.kind==='preview'&&p.email===null));
  const filtered=await(await get(env,'?creative=d_static')).json();
  assert.equal(filtered.knownEmailTotal,2);assert.ok(!filtered.people.some(p=>p.email==='colour@example.test'));
});

test('all eleven maker pages can be counted and linked to a visit',async()=>{
  const env=environment(),visitId=crypto.randomUUID();
  for(const n of [3,8,9,10,11])assert.equal((await campaignApi(post('campaign-event',{event:'step_'+n,visitId}),env)).status,200);
  assert.equal((await campaignApi(post('campaign-event',{event:'step_12',visitId}),env)).status,400);
  const d=await(await get(env)).json();
  assert.equal(d.journeys[0].furthest,'Delivery page');
  assert.ok(d.journeys[0].steps.includes('step_10'));
});

const post=(path,input,{ip='81.2.69.142',cf={city:'Leeds',region:'England'}}={})=>{const r=new Request('https://cq.test/api/'+path,{method:'POST',headers:{Origin:'https://cq.test','Content-Type':'application/json','CF-IPCountry':'GB','CF-Connecting-IP':ip},body:JSON.stringify(input)});Object.defineProperty(r,'cf',{value:cf});return r;};

test('IP addresses are shortened before saving',()=>{
  assert.equal(shortIp('81.2.69.142'),'81.2.69.0');
  assert.equal(shortIp('2a00:23c5:9f01:4b00:1d2c:aa:bb:cc'),'2a00:23c5:9f01::');
  assert.equal(shortIp('2001:db8::1'),'2001:db8:0::');
  assert.equal(shortIp('::1'),'0:0:0::');
  for(const bad of ['','unknown','1.2.3','<script>','1:2'])assert.equal(shortIp(bad),null);
});

test('shortened IP, town and links are saved for every visit with a valid reference',async()=>{
  const env=environment(),visitId=crypto.randomUUID(),other=crypto.randomUUID();
  assert.equal((await campaignApi(post('campaign-event',{event:'maker_start',visitId,measurementConsent:true,creative:'d_static'}),env)).status,200);
  assert.equal((await campaignApi(post('campaign-event',{event:'step_1',visitId,measurementConsent:true},{ip:'9.9.9.9',cf:{city:'York'}}),env)).status,200);
  assert.equal((await campaignApi(post('campaign-event',{event:'maker_start',visitId:'not-a-reference'}),env)).status,400);
  const rows=env.DB.sqlite.prepare('SELECT * FROM visit_details').all();
  assert.equal(rows.length,1);assert.equal(rows[0].ip_prefix,'81.2.69.0');assert.equal(rows[0].town,'Leeds');assert.equal(rows[0].region,'England');
  assert.ok(!JSON.stringify(rows).includes('81.2.69.142'));
  assert.equal((await campaignApi(post('preview-email',{email:'Maker@Example.test',visitId,measurementConsent:true}),env)).status,200);
  assert.equal((await campaignApi(post('preview-email',{email:'quiet@example.test'}),env)).status,200);void other;
  assert.deepEqual(env.DB.sqlite.prepare('SELECT visit_id, kind, ref FROM visit_links').all().map(x=>({...x})),[{visit_id:visitId,kind:'contact',ref:'maker@example.test'}]);
  const d=await(await get(env)).json();const j=d.journeys[0];
  assert.deepEqual(j.where,{town:'Leeds',region:'England',ip:'81.2.69.0'});assert.equal(j.made.email,'maker@example.test');
  assert.equal(d.contacts.find(c=>c.email==='maker@example.test').where.town,'Leeds');assert.equal(d.contacts.find(c=>c.email==='quiet@example.test').where,null);
});

test('a preview request links to the visit when it carries the visit reference',async()=>{
  const env={...environment(),OPENAI_API_KEY:'test-only'},visitId=crypto.randomUUID(),real=globalThis.fetch;
  const photo=()=>new File([new Uint8Array([255,216,255,217])],'p.jpg',{type:'image/jpeg'});
  const send=fields=>{const form=new FormData();form.append('photo',photo());for(const [k,v] of Object.entries(fields))form.append(k,v);return worker.fetch(new Request('https://cq.test/api/generate-character',{method:'POST',headers:{Origin:'https://cq.test','CF-Connecting-IP':'10.0.0.'+Math.floor(Math.random()*250)},body:form}),env);};
  globalThis.fetch=async()=>Response.json({error:{code:'server_error'}},{status:500});
  try{await send({name:'Ruby',visitId});await send({name:'Ruby'});}finally{globalThis.fetch=real;}
  const links=env.DB.sqlite.prepare("SELECT visit_id, kind FROM visit_links").all();
  assert.equal(links.length,1);assert.equal(links[0].visit_id,visitId);assert.equal(links[0].kind,'preview');
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM preview_receipts').get().n,2);
});

test('visit detail is deleted after 90 days',async()=>{
  const env=environment(),old=new Date(Date.now()-91*86400000).toISOString(),fresh=new Date().toISOString();
  env.DB.sqlite.prepare('INSERT INTO visit_details VALUES (?,?,?,?,?)').run('a','1.2.3.0','Leeds','England',old);
  env.DB.sqlite.prepare('INSERT INTO visit_details VALUES (?,?,?,?,?)').run('b','1.2.4.0','York','England',fresh);
  env.DB.sqlite.prepare('INSERT INTO visit_links VALUES (?,?,?,?)').run('a','contact','old@example.test',old);
  await get(env);
  assert.deepEqual(env.DB.sqlite.prepare('SELECT visit_id FROM visit_details').all().map(x=>x.visit_id),['b']);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM visit_links').get().n,0);
});

test('town falls back to visitor-location headers when the host sends them that way',async()=>{
  const env=environment(),visitId=crypto.randomUUID();
  const r=new Request('https://cq.test/api/campaign-event',{method:'POST',headers:{Origin:'https://cq.test','Content-Type':'application/json','CF-Connecting-IP':'81.2.69.142','cf-ipcity':'S%C3%A3o Paulo','cf-region':'Sao Paulo'},body:JSON.stringify({event:'maker_start',visitId,measurementConsent:true})});
  assert.equal((await campaignApi(r,env)).status,200);
  const row=env.DB.sqlite.prepare('SELECT town, region FROM visit_details').get();
  assert.equal(row.town,'São Paulo');assert.equal(row.region,'Sao Paulo');
  const d=await(await get(env)).json();
  assert.deepEqual(d.hostLocation,{locationObject:false,town:false,townHeader:false,region:false,regionHeader:false});
});

const count=(input,{ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148',origin='https://cq.test'}={})=>new Request('https://cq.test/api/visit-count',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-IPCountry':'GB','CF-Connecting-IP':'81.2.69.142','User-Agent':ua},body:JSON.stringify(input)});
test('cookie-free counts add up daily totals per ad and step, with no visitor id or IP',async()=>{
  const env=environment(),ad={source:'meta',medium:'paid_social',campaign:'cq_d',creative:'d_static'};
  for(let i=0;i<3;i++)assert.equal((await campaignApi(count({...ad,event:'arrive'}),env)).status,200);
  assert.equal((await campaignApi(count({...ad,event:'arrive'},{ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'}),env)).status,200);
  assert.equal((await campaignApi(count({...ad,event:'preview_start',visitId:crypto.randomUUID()}),env)).status,200);
  assert.equal((await campaignApi(count({event:'arrive'}),env)).status,200);
  assert.equal((await campaignApi(count({...ad,event:'arrive'},{ua:'facebookexternalhit/1.1'}),env)).status,200);
  assert.equal((await campaignApi(count({...ad,event:'device_mobile'}),env)).status,400);
  assert.equal((await campaignApi(count({...ad,event:'nope'}),env)).status,400);
  assert.equal((await campaignApi(count({...ad,event:'arrive'},{origin:'https://evil.test'}),env)).status,403);
  const rows=env.DB.sqlite.prepare('SELECT * FROM visit_counts ORDER BY event, device, creative').all().map(r=>({...r}));
  assert.deepEqual(rows.map(r=>[r.event,r.creative,r.device,r.country,r.n]),[['arrive','d_static','desktop','GB',1],['arrive','d_static','mobile','GB',3],['arrive','none','mobile','GB',1],['preview_start','d_static','mobile','GB',1]]);
  assert.equal(rows[0].day,day);
  const saved=JSON.stringify(rows);assert.ok(!saved.includes('81.2.69')&&!/[0-9a-f]{8}-[0-9a-f]{4}/.test(saved));
});
test('photo page attempts are counted without cookies',async()=>{
  const env=environment(),ad={source:'meta',medium:'paid_social',campaign:'cq_d',creative:'d_static'};
  for(const event of ['photo_open','photo_picked','photo_passed','photo_failed'])assert.equal((await campaignApi(count({...ad,event}),env)).status,200);
  const events=env.DB.sqlite.prepare('SELECT event FROM visit_counts ORDER BY event').all().map(r=>r.event);
  assert.deepEqual(events,['photo_failed','photo_open','photo_passed','photo_picked']);
});
test('report shows everyone counted without cookies, per ad, filtered and by day',async()=>{
  const env=environment(),ad={source:'meta',medium:'paid_social',campaign:'cq_d'};
  const add=(creative,event,n)=>env.DB.sqlite.prepare('INSERT INTO visit_counts VALUES (?,?,?,?,?,?,?,?,?)').run(day,event,ad.source,ad.medium,ad.campaign,creative,'GB','mobile',n);
  add('d_static','arrive',20);add('d_static','maker_start',18);add('d_static','preview_start',3);add('d_video','arrive',5);
  env.DB.sqlite.prepare('INSERT INTO visit_counts VALUES (?,?,?,?,?,?,?,?,?)').run(day,'arrive','meta','paid_social','cq_d','d_video','AE','desktop',2);
  env.DB.sqlite.prepare('INSERT INTO visit_counts VALUES (?,?,?,?,?,?,?,?,?)').run('2020-01-01','arrive','meta','paid_social','cq_d','d_static','GB','mobile',99);
  assert.equal((await (await get(env)).json()).everyone.steps[0].count,25,'default view leaves out visits from abroad');
  const e=(await (await get(env,'?audience=all')).json()).everyone;
  assert.equal(e.steps[0].count,27);assert.equal(e.steps.find(s=>s.step==='preview_start').count,3);
  assert.deepEqual(e.ads.map(a=>[a.creative,a.counts.arrive,a.counts.maker_start]),[['d_static',20,18],['d_video',7,0]]);
  assert.equal(e.byDay.at(-1).arrived,27);assert.deepEqual(e.devices,[{key:'mobile',count:25},{key:'desktop',count:2}]);assert.deepEqual(e.countries,[{key:'GB',count:25},{key:'AE',count:2}]);
  const only=(await (await get(env,'?creative=d_video&audience=all')).json()).everyone;
  assert.equal(only.steps[0].count,7);assert.equal(only.ads.length,1);
});

test('profit uses owner costs, counts every preview, and shows ad room and the stop line',async()=>{
  const env=environment();
  const v=visit(env,['landing_view','maker_start','preview_start','preview_success','price_visible','checkout_start']);
  order(env,{visitId:v,amount:5999});
  env.DB.sqlite.prepare("UPDATE customer_orders SET size='a4', state=json_set(state,'$.paidAt',?)").run(new Date(Date.now()-3*86400000).toISOString());
  env.DB.sqlite.prepare('INSERT INTO preview_daily_usage (day, attempts) VALUES (?, 4)').run(day);
  assert.equal((await spend(env,{day,creative:'all',pounds:20})).status,200);
  let e=(await (await get(env)).json()).economics;
  assert.equal(e.sales,1);assert.equal(e.revenuePence,5999);assert.equal(e.feesPence,266);assert.equal(e.printPence,1800);assert.equal(e.artPence,150);
  assert.equal(e.previewAttempts,4);assert.equal(e.previewPence,40);assert.equal(e.spendPence,2000);assert.equal(e.profitPence,5999-266-1800-150-40-2000);
  assert.deepEqual(e.room.map(r=>[r.size,r.adRoomPence]),[['a4',2999-143-1800-150-500],['a5',2499-122-1600-150-500]]);
  assert.equal(e.stop.spentSinceSalePence,2000);assert.ok(e.stop.lastSaleAt);
  const costs=(env,body)=>analyticsApi(new Request(origin+'/api/owner-analytics/costs',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...owner},body:JSON.stringify(body)}),env);
  assert.equal((await costs(env,{print_a4:19,fee_percent:3,bogus:1})).status,200);
  assert.equal((await costs(env,{print_a4:-1})).status,400);
  assert.equal((await costs(env,{nothing:1})).status,400);
  e=(await (await get(env)).json()).economics;
  assert.equal(e.costs.print_a4,1900);assert.equal(e.costs.fee_percent,300);assert.equal(e.printPence,1900);assert.equal(e.feesPence,200);
  const ad=(await (await get(env)).json()).ads.find(a=>a.creative==='d_static');assert.equal(ad.costPence,200+1900+150);
});

test('default view shows UK shoppers only; crawlers and visits from abroad are counted and hidden',async()=>{
  const env=environment(),now=new Date().toISOString();
  visit(env,['maker_start','step_1','device_mobile'],{source:'google',creative:'g_birthday'});
  const checker=visit(env,['maker_start','step_1','device_desktop'],{source:'google',creative:'g_birthday',country:'US'});
  const crawler=visit(env,['landing_view','device_mobile'],{source:'direct',creative:'none'});
  visit(env,['landing_view','device_desktop'],{source:'direct',creative:'none',country:'FR'});
  const detail=env.DB.sqlite.prepare('INSERT INTO visit_details (visit_id, ip_prefix, town, region, created_at) VALUES (?,?,?,?,?)');
  detail.run(checker,'74.125.210.0',null,null,now);detail.run(crawler,'66.249.74.0',null,null,now);
  const uk=await(await get(env)).json();
  assert.equal(uk.headline.visits,1);assert.equal(uk.funnel.find(f=>f.step==='maker_start').visits,1);
  assert.deepEqual(uk.audience,{mode:'uk',hidden:{crawlers:2,abroad:1}});
  assert.deepEqual(uk.traffic.country.map(x=>x.key),['GB']);
  const all=await(await get(env,'?audience=all')).json();
  assert.equal(all.headline.visits,4);assert.deepEqual(all.audience,{mode:'all',hidden:{crawlers:0,abroad:0}});
});

test('a preview email links its own drawing without creating a quote or enrolling on dashboard load',async()=>{
 const env=environment(),id=crypto.randomUUID(),email='reader@somewhere.invalid';
 env.FOLLOWUP_EMAILS_ENABLED='true';env.RESEND_API_KEY='test';env.ORDER_EMAIL_FROM='test@cq.test';
 const stamp=new Date().toISOString();
 env.DB.sqlite.prepare("INSERT INTO preview_receipts (id,status,created_at) VALUES (?,'succeeded',?)").run(id,stamp);
 const capture=address=>campaignApi(new Request(origin+'/api/preview-email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:address,previewId:id})}),env);
 assert.equal((await capture(email)).status,200);
 assert.equal((await capture('different@somewhere.invalid')).status,200);
 assert.equal(env.DB.sqlite.prepare('SELECT email FROM preview_receipts').get().email,email);
 visit(env,['price_view','step_6']);
 assert.equal((await get(env)).status,200);
 assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_quotes').get().n,0);
 assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM followup_sequences').get().n,0);
 env.DB.sqlite.prepare("INSERT INTO customer_quotes (email,size,price_pence,catalogue_version,first_shown_at,last_shown_at,unsubscribe_token) VALUES (?,'a4',2999,'legacy',?,?,?)").run(email,stamp,stamp,crypto.randomUUID());
 const report=await (await get(env)).json();
 assert.equal(report.quotes.length,0);
});

test('the preview form enrols only submissions with the current notice and respects a later opt-out',async()=>{
 const env=environment(),email='shopper@somewhere.invalid',id=crypto.randomUUID();
 env.DB.sqlite.prepare("INSERT INTO preview_receipts (id,status,created_at) VALUES (?,'succeeded',?)").run(id,new Date().toISOString());
 const submit=async extra=>(await (await campaignApi(new Request(origin+'/api/preview-email',{method:'POST',
   headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,previewId:id,...extra})}),env)).json());
 assert.equal((await submit({})).reminderActive,false);
 assert.equal((await submit({reminderNotice:'preview-price-v1',noReminders:false})).reminderActive,true);
 assert.equal((await submit({reminderNotice:'preview-price-v1',noReminders:true})).reminderActive,false);
 assert.equal((await submit({reminderNotice:'preview-price-v1',noReminders:false})).reminderActive,false);
 assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_quotes').get().n,0);
});
