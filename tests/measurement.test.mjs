import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../dist/client/campaign.js',import.meta.url),'utf8');
function harness(saved={},search='?utm_source=meta&utm_medium=paid_social&utm_campaign=cq_uk_validation_2026',config={pixelId:'1234567890'},host='example.com',pathname='/'){
  const calls=[],scripts=[],store=new Map(Object.entries(saved)),session=new Map(),settings=[],links=[],replaced=[];
  const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  const document={cookie:'',referrer:'',createElement(tag){return {tag,dataset:{},setAttribute(){},addEventListener(name,cb){this[name]=cb;}};},querySelectorAll(selector){return selector==='.measurement-settings'?settings:selector.startsWith('a[href')?links:[];},body:{append(){},prepend(){}},head:{append(node){if(node.tag==='script')scripts.push(node);}}};
  const window={};const context={matchMedia:()=>({matches:true}),document,window,URL,URLSearchParams,crypto,localStorage:storage(store),sessionStorage:storage(session),history:{state:null,replaceState:(s,t,url)=>replaced.push(String(url))},location:{search,pathname,hostname:host,href:'https://'+host+pathname+search,origin:'https://'+host},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>config};}};
  vm.runInNewContext(code,context);
  return {window,calls,scripts,store,session,links,replaced,choose(choice){window.cqMeasurement.choose(choice);},flush:()=>new Promise(resolve=>setImmediate(resolve))};
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
