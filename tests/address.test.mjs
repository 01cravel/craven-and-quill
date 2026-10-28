import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {addressFromSupplier} from '../dist/server/address.js';
let ip=1;
const get=(env,path,{origin}={})=>worker.fetch(new Request('https://cq.test/api/address/'+path,{headers:{...(origin?{Origin:origin}:{}),'CF-Connecting-IP':`198.51.100.${ip++}`}}),env);
const hit={id:'paf_23747771',suggestion:'10 Downing Street, London, SW1A',udprn:23747771,urls:{udprn:'/v1/udprn/23747771'}};
const full={line_1:'Flat 2',line_2:'10 Downing Street',line_3:'',post_town:'LONDON',postcode:'sw1a 2aa',county:'London'};
function supplierEnv(){const calls=[];return {calls,IDEAL_POSTCODES_API_KEY:'ak_test_key',fetch:async url=>{calls.push(String(url));const u=new URL(url);if(u.pathname.endsWith('/gbr'))return Response.json({result:full,code:2000,message:'Success'});return Response.json({result:{hits:[hit,{id:'bad id!',suggestion:'x'}]},code:2000,message:'Success'});}};}

test('without a key the finder reports unavailable and the page falls back to typing',async()=>{
 const env={};assert.deepEqual(await (await get(env,'status')).json(),{available:false});
 assert.equal((await get(env,'search?q=10%20Downing')).status,503);assert.equal((await get(env,'resolve?id=paf_1')).status,503);
});
test('search returns only safe suggestions and never leaks the key',async()=>{
 const env=supplierEnv();assert.deepEqual(await (await get(env,'status')).json(),{available:true});
 const r=await get(env,'search?q=10%20Downing');const body=await r.text();
 assert.equal(r.status,200);assert.ok(!body.includes('ak_test_key'));assert.deepEqual(JSON.parse(body),{hits:[{id:hit.id,suggestion:hit.suggestion}]});
 const called=new URL(env.calls[0]);assert.equal(called.origin+called.pathname,'https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses');assert.equal(called.searchParams.get('query'),'10 Downing');assert.equal(called.searchParams.get('api_key'),'ak_test_key');
 assert.deepEqual(await (await get(env,'search?q=a')).json(),{hits:[]});assert.equal(env.calls.length,1);
});
test('resolve fills a UK address the order form accepts',async()=>{
 const env=supplierEnv();const r=await get(env,'resolve?id=paf_23747771');
 assert.equal(r.status,200);assert.deepEqual((await r.json()).address,{line1:'Flat 2',line2:'10 Downing Street',townOrCity:'LONDON',county:'London',postcode:'SW1A 2AA'});
 assert.ok(env.calls[0].includes('/autocomplete/addresses/paf_23747771/gbr'));
 assert.equal((await get(env,'resolve?id=..%2Fsecret')).status,400);assert.equal(env.calls.length,1);
});
test('cross-site requests, wrong methods and supplier failures fail closed',async()=>{
 const env=supplierEnv();assert.equal((await get(env,'search?q=10%20Downing',{origin:'https://evil.test'})).status,403);
 assert.equal((await worker.fetch(new Request('https://cq.test/api/address/search',{method:'POST'}),env)).status,404);
 env.fetch=async()=>Response.json({code:4020,message:'Token balance depleted'},{status:402});
 assert.equal((await get(env,'resolve?id=paf_1')).status,502);assert.equal((await get(env,'search?q=10%20Downing')).status,502);
});
test('paid lookups are limited per visitor',async()=>{
 const env=supplierEnv();const headers={'CF-Connecting-IP':'203.0.113.9'};let last;
 for(let i=0;i<31;i++)last=await worker.fetch(new Request('https://cq.test/api/address/resolve?id=paf_1',{headers}),env);
 assert.equal(last.status,429);assert.equal(env.calls.length,30);
});
test('supplier fields map to our address shape',()=>{
 assert.deepEqual(addressFromSupplier({line_1:'1 High St',line_2:'',line_3:'Little Snoring',post_town:'FAKENHAM',postcode:'nr21 0aa'}),{line1:'1 High St',line2:'Little Snoring',townOrCity:'FAKENHAM',county:'',postcode:'NR21 0AA'});
});
