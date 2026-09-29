import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../dist/client/campaign.js',import.meta.url),'utf8');
function harness(saved={}){
  const calls=[],scripts=[],store=new Map(Object.entries(saved)),session=new Map(),settings=[];
  const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  let banner;
  const document={cookie:'',createElement(tag){return {tag,dataset:{},setAttribute(){},addEventListener(name,cb){this[name]=cb;}};},querySelectorAll(selector){return selector==='.measurement-settings'?settings:[];},body:{append(node){banner=node;}},head:{append(node){if(node.tag==='script')scripts.push(node);}}};
  const window={};const context={document,window,URL,URLSearchParams,crypto,localStorage:storage(store),sessionStorage:storage(session),location:{search:'?utm_source=meta&utm_medium=paid_social&utm_campaign=cq_uk_validation_2026',pathname:'/',hostname:'example.com',href:'https://example.com/'},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({pixelId:'1234567890'})};}};
  vm.runInNewContext(code,context);
  return {window,calls,scripts,store,choose(choice){banner.click({target:{dataset:{choice}}});},flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('no Meta script or requests before consent, including historical site-only consent',async()=>{
  for(const saved of [{},{'cq-measurement-v1':'yes'},{'cq-measurement-v2':'no'}]){const h=harness(saved);await h.flush();assert.equal(h.scripts.length,0);assert.equal(h.calls.length,0);}
});
test('site-only consent sends first-party events without contacting Meta',async()=>{
  const h=harness();h.choose('site');await h.flush();assert.equal(h.scripts.length,0);assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/campaign-event');
});
test('Meta requires separate consent; saved leads send only random receipt and deduplicate in browser',async()=>{
  const h=harness();h.choose('ads');await h.flush();assert.equal(h.scripts.length,1);
  const id=crypto.randomUUID();await h.window.cqMeasurement.savedLead(id);await h.window.cqMeasurement.savedLead(id);
  const queue=h.window.fbq.queue.map(args=>Array.from(args));
  assert.ok(queue.some(args=>args[0]==='set'&&args[1]==='autoConfig'&&args[2]===false));
  const lead=queue.filter(args=>args[2]==='Lead');assert.equal(lead.length,1);assert.equal(JSON.stringify(lead[0][3]),'{}');assert.equal(lead[0][4].eventID,id);
  h.choose('no');await h.window.cqMeasurement.savedLead(crypto.randomUUID());assert.equal(h.window.fbq.queue.filter(args=>args[2]==='Lead').length,1);assert.ok(h.window.fbq.queue.some(args=>args[0]==='consent'&&args[1]==='revoke'));
});
test('revocation while configuration loads prevents any Meta script being added',async()=>{
  const h=harness();h.choose('ads');h.choose('no');await h.flush();assert.equal(h.scripts.length,0);
});
