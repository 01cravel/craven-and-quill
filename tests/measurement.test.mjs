import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../dist/client/campaign.js',import.meta.url),'utf8');
function harness(saved={},search='?utm_source=meta&utm_medium=paid_social&utm_campaign=cq_uk_validation_2026',config={pixelId:'1234567890'},host='example.com',pathname='/',referrer='',targets=[],historyState=null){
  const calls=[],scripts=[],store=new Map(Object.entries(saved)),session=new Map(),settings=[],replaced=[],states=[];
  const links=targets.map(target=>({href:target,getAttribute(){return this.href;},addEventListener(name,callback){this[name]=callback;}}));
  const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  const document={cookie:'',referrer,createElement(tag){return {tag,dataset:{},setAttribute(){},addEventListener(name,cb){this[name]=cb;}};},querySelectorAll(selector){return selector==='.measurement-settings'?settings:selector.startsWith('a[href')?links:[];},body:{append(){},prepend(){}},head:{append(node){if(node.tag==='script')scripts.push(node);}}};
  const window={};const context={matchMedia:()=>({matches:true}),document,window,URL,URLSearchParams,crypto,localStorage:storage(store),sessionStorage:storage(session),history:{state:historyState,replaceState:(s,t,url)=>{states.push(s);replaced.push(String(url));}},location:{search,pathname,hostname:host,href:'https://'+host+pathname+search,origin:'https://'+host},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>config};}};
  vm.runInNewContext(code,context);
  return {window,calls,scripts,store,session,links,replaced,states,choose(choice){window.cqMeasurement.choose(choice);},flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
const measured=h=>h.calls.filter(c=>c.path==='/api/campaign-event').map(c=>JSON.parse(c.options.body));
const counts=h=>h.calls.filter(c=>c.path==='/api/visit-count').map(c=>JSON.parse(c.options.body));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('every visit is measured first-party; an earlier opt-out keeps advertising scripts out',async()=>{
  for(const saved of [{'cq-measurement-v2':'no'},{'cq-measurement-v3':'no'}]){
    const h=harness(saved);await h.flush();
    assert.equal(h.scripts.length,0);assert.equal(h.session.size,0);assert.equal(h.store.size,Object.keys(saved).length);
    assert.deepEqual(measured(h).map(e=>e.event),['landing_view','device_mobile']);
    assert.ok(measured(h).every(e=>UUID.test(e.visitId)&&e.source==='meta'&&e.creative==='none'));
  }
});
test('the visit reference travels in the page link and is reused from it',async()=>{
  const h=harness();await h.flush();
  const id=measured(h)[0].visitId;assert.equal(h.replaced.length,1);assert.ok(h.replaced[0].includes('v='+id));
  const link={href:'',getAttribute:()=>'create.html'};const again=harness({},'?utm_content=g_birthday&v='+id);
  assert.equal(measured(again)[0].visitId,id);assert.equal(again.replaced.length,0);
  const linked=harness({},'?utm_content=g_birthday&v=not-a-reference');assert.notEqual(measured(linked)[0].visitId,'not-a-reference');assert.ok(UUID.test(measured(linked)[0].visitId));
  const h2=(()=>{const h=harness({},'?v='+id);return h;})();assert.equal(measured(h2)[0].visitId,id);
  void link;
});
test('each event is sent once per visit and page totals carry only ad codes and the step',async()=>{
  const h=harness();await h.flush();
  assert.deepEqual(counts(h),[{source:'meta',medium:'paid_social',campaign:'cq_uk_validation_2026',creative:'none',event:'arrive'},{source:'meta',medium:'paid_social',campaign:'cq_uk_validation_2026',creative:'none',event:'landing_view'}]);
  h.window.cqMeasurement.record('step_1');h.window.cqMeasurement.record('step_1');
  assert.equal(counts(h).filter(c=>c.event==='step_1').length,1);assert.equal(measured(h).filter(e=>e.event==='step_1').length,1);
  h.choose('no');h.window.cqMeasurement.record('step_2');assert.equal(measured(h).filter(e=>e.event==='step_2').length,1);
  assert.equal(h.store.get('cq-measurement-v3'),'no');
});
test('no banner: Meta loads by default; ?measurement=no turns it off and is remembered',async()=>{
  for(const saved of [{},{'cq-measurement-v1':'yes'},{'cq-measurement-v2':'site'}]){const d=harness(saved);await d.flush();assert.equal(d.scripts.length,1);}
  const off=harness({},'?utm_source=meta&measurement=no');await off.flush();assert.equal(off.scripts.length,0);assert.equal(off.store.get('cq-measurement-v3'),'no');
  const back=harness({'cq-measurement-v3':'no'},'?measurement=ads');await back.flush();assert.equal(back.scripts.length,1);assert.equal(back.store.get('cq-measurement-v3'),'ads');
});
test('saved leads send only random receipt and deduplicate in browser',async()=>{
  const h=harness();await h.flush();assert.equal(h.scripts.length,1);
  const id=crypto.randomUUID();await h.window.cqMeasurement.savedLead(id);await h.window.cqMeasurement.savedLead(id);
  const queue=h.window.fbq.queue.map(args=>Array.from(args));
  assert.ok(queue.some(args=>args[0]==='set'&&args[1]==='autoConfig'&&args[2]===false));
  const lead=queue.filter(args=>args[2]==='Lead');assert.equal(lead.length,1);assert.equal(JSON.stringify(lead[0][3]),'{}');assert.equal(lead[0][4].eventID,id);
  h.choose('no');await h.window.cqMeasurement.savedLead(crypto.randomUUID());assert.equal(h.window.fbq.queue.filter(args=>args[2]==='Lead').length,1);assert.ok(h.window.fbq.queue.some(args=>args[0]==='consent'&&args[1]==='revoke'));
});
test('revocation while configuration loads prevents any Meta script being added',async()=>{
  const h=harness();h.choose('no');await h.flush();assert.equal(h.scripts.length,0);
});

const googleConfig={google:{tagId:'AW-18555913000',lead:'AW-18555913000/leadLabel',purchase:'AW-18555913000/purchaseLabel'}};
const googleQueue=h=>(h.window.dataLayer||[]).map(args=>Array.from(args));
test('Google stays off after an opt-out, and never loads in QA or on a private book',async()=>{
 for(const saved of [{'cq-measurement-v3':'no'}]){
  const h=harness(saved,'?gclid=AbC_12-34',googleConfig,'cravenandquill.com');await h.flush();
  assert.equal(h.scripts.length,0);assert.equal(h.window.cqMeasurement.context().gclid,undefined);
 }
 for(const [host,path,search] of [['localhost','/','?gclid=abc'],['cravenandquill.com','/order.html','?id=private'],['cravenandquill.com','/','?utm_source=qa']]){
  const h=harness({'cq-measurement-v3':'ads'},search,googleConfig,host,path);await h.flush();assert.equal(h.scripts.length,0);
 }
});
test('Google click context and a saved preview receipt produce one secondary event without personal fields',async()=>{
 const h=harness({},'?utm_content=g_birthday&gclid=AbC_12-34&email=private@example.com#key=secret',googleConfig,'cravenandquill.com');
 await h.flush();assert.equal(h.scripts.length,1);assert.match(h.scripts[0].src,/googletagmanager/);
 assert.equal(h.window.cqMeasurement.context().source,'google');
 const receipt={eventId:'a'.repeat(64),value:0,email:'never-sent@example.com',name:'Private Child'};
 await h.window.cqMeasurement.previewLead(receipt);await h.window.cqMeasurement.previewLead(receipt);
 const events=googleQueue(h).filter(x=>x[0]==='event');assert.equal(events.length,1);
 assert.equal(events[0][2].transaction_id,receipt.eventId);assert.equal(events[0][2].value,0);
 assert.equal(events[0][2].send_to,googleConfig.google.lead);
 assert.doesNotMatch(JSON.stringify(googleQueue(h)),/private@|never-sent|Private Child|secret|email=/);
 const defaults=googleQueue(h).find(x=>x[0]==='consent'&&x[1]==='default');assert.equal(defaults[2].ad_storage,'denied');
 assert.equal(googleQueue(h).find(x=>x[0]==='consent'&&x[1]==='update')[2].ad_personalization,'denied');
 h.choose('no');await h.window.cqMeasurement.previewLead({...receipt,eventId:'b'.repeat(64)});
 assert.equal(googleQueue(h).filter(x=>x[0]==='event').length,1);assert.equal(h.store.has('cq-ad-click-v1'),false);
 assert.equal(h.window.cqMeasurement.context().gclid,undefined);
 assert.ok(h.calls.some(x=>x.path==='/api/ad-revoke'));
});
test('Google revocation during config fetch prevents loading and a rejected or missing receipt never converts',async()=>{
 const h=harness({},'?gclid=abc',googleConfig,'cravenandquill.com');h.choose('no');await h.flush();assert.equal(h.scripts.length,0);
 await h.window.cqMeasurement.previewLead(null);await h.window.cqMeasurement.previewLead({eventId:'fake',value:1});assert.equal(googleQueue(h).length,0);
});
test('a made character tells Meta once per visit, with no personal fields, and never in QA or after opt-out',async()=>{
  const h=harness();await h.flush();
  await h.window.cqMeasurement.characterMade();await h.window.cqMeasurement.characterMade();
  const ev=h.window.fbq.queue.map(a=>Array.from(a)).filter(a=>a[2]==='CompleteRegistration');
  assert.equal(ev.length,1);assert.equal(JSON.stringify(ev[0][3]),'{"content_name":"free_character"}');assert.match(ev[0][4].eventID,/^character-[0-9a-f-]{36}$/);
  const qa=harness({},'?utm_source=qa&utm_campaign=qa_test');await qa.flush();await qa.window.cqMeasurement.characterMade();
  assert.equal((qa.window.fbq?.queue||[]).filter(a=>a[2]==='CompleteRegistration').length,0);
  const off=harness({}, '?measurement=no');await off.flush();await off.window.cqMeasurement.characterMade();
  assert.equal(off.window.fbq,undefined);
});

test('organic search retains engine, original public page and visit through the example, maker, and checkout',async()=>{
  const site='cravenandquill.com', birthday='/personalised-birthday-book', example='/examples/the-map-beneath-the-moon';
  const saved={'cq-ad-click-v1':JSON.stringify({expires:Date.now()+60000,click:{gclid:'Old'},attribution:{source:'google',medium:'cpc',campaign:'old',creative:'old'}})};
  const landing=harness(saved,'?email=private@example.com',googleConfig,site,birthday,'https://www.google.co.uk/search?q=private',[example,'https://other.example/create','/order?id=private','#details','/test-book?sample=1&book=amara&order=1']);
  const arrival=measured(landing)[0];
  assert.equal(arrival.source,'organic_search');assert.equal(arrival.medium,'organic');assert.equal(arrival.campaign,'google');assert.equal(arrival.creative,'seo_birthday');
  assert.equal(arrival.gclid,null);assert.equal(landing.store.has('cq-ad-click-v1'),false);
  assert.equal(landing.links[0].href,example);
  assert.ok(landing.links.slice(1).every(link=>!link.click));
  landing.links[0].click();
  const target=new URL(landing.links[0].href,'https://'+site);
  assert.doesNotMatch(target.href,/private|gclid|utm_/);
  const sample=harness({},target.search,googleConfig,site,target.pathname,'https://'+site+birthday,['/create']);
  sample.links[0].click();
  const maker=harness({},new URL(sample.links[0].href,'https://'+site).search,googleConfig,site,'/create','https://'+site+example);
  maker.window.cqMeasurement.record('checkout_start');
  for(const context of [measured(sample)[0],measured(maker).at(-1),maker.window.cqMeasurement.context()]){
    assert.equal(context.visitId,arrival.visitId);assert.equal(context.source,'organic_search');assert.equal(context.creative,'seo_birthday');assert.equal(context.campaign,'google');
  }
  const refreshed=harness({},'?v='+arrival.visitId,googleConfig,site,birthday,'',[],landing.states[0]);
  assert.equal(measured(refreshed)[0].creative,'seo_birthday');
  await landing.flush();assert.equal(landing.scripts.length,0);
});
test('paid and tagged visits take precedence, direct and unrelated referrals do not become organic search',()=>{
  const site='cravenandquill.com',page='/examples/the-map-beneath-the-moon';
  const source=(search,ref)=>measured(harness({},search,{},site,page,ref))[0];
  assert.equal(source('?gclid=Real','https://www.google.co.uk/').medium,'cpc');
  assert.equal(source('?msclkid=abc','https://www.bing.com/').medium,'cpc');
  assert.equal(source('?gad_source=1','https://www.google.co.uk/').medium,'cpc');
  assert.equal(source('?utm_content=g_birthday','https://www.google.com/').source,'google');
  assert.equal(source('?utm_source=newsletter&utm_medium=email','https://www.google.com/').source,'newsletter');
  assert.equal(source('?fbclid=ABC','https://www.google.com/').source,'facebook');
  assert.equal(source('','https://www.google.co.uk.evil.example/').source,'referral');
  assert.equal(source('','https://mail.google.com/').source,'referral');
  assert.equal(source('','').campaign,'unattributed');
  assert.equal(source('','https://www.bing.com/').creative,'seo_amara');
});
test('public sample handoff preserves sample selectors, excludes embedded and private books, respects advertising opt-out',()=>{
  const url='/test-book?book=luke&sample=1',site='cravenandquill.com';
  const h=harness({'cq-measurement-v3':'no'},'?gclid=abcd&token=private',{},site,'/','https://www.google.com/',[url]);
  h.links[0].click();
  const next=new URL(h.links[0].href,'https://'+site);
  assert.equal(next.searchParams.get('book'),'luke');assert.equal(next.searchParams.get('sample'),'1');assert.equal(next.searchParams.get('utm_medium'),'cpc');
  assert.doesNotMatch(next.href,/gclid|private/);
  for(const search of ['?order=1','?sample=1&book=noah&embed=1','?sample=1&book=noah&order=1']){
    const privateViewer=harness({},search,googleConfig,site,'/test-book');
    assert.equal(privateViewer.calls.length,0);assert.equal(privateViewer.replaced.length,0);
  }
});

test('a Christmas search carries the selected book and the original visit into the maker',async()=>{
  const site='cravenandquill.com';
  const page=harness({},'',googleConfig,site,'/personalised-christmas-book','https://www.google.co.uk/',['/create?like=christmas','/create?like=private','/create?like=christmas&email=private']);
  const arrival=measured(page)[0];
  page.links[0].click();
  const destination=new URL(page.links[0].href,'https://'+site);
  assert.equal(destination.searchParams.get('like'),'christmas');
  assert.equal(destination.searchParams.get('v'),arrival.visitId);
  assert.equal(destination.searchParams.get('cq_entry'),'christmas');
  assert.ok(page.links.slice(1).every(link=>!link.click));
  const maker=harness({},destination.search,googleConfig,site,'/create','https://'+site+'/personalised-christmas-book');
  assert.equal(maker.window.cqMeasurement.context().creative,'seo_christmas');
  await page.flush();assert.equal(page.scripts.length,0);
});
