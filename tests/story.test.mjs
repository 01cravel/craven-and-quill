import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {testDb} from './sqlite-d1.mjs';

const draft=()=>({title:'Leo and the Garden Cup',synopsis:'Leo turns the garden into a football pitch and solves a missing-ball mystery with his friends.',spreads:Array.from({length:10},(_,i)=>({text:`Leo plays football in the garden. This is story page ${i+1}.`,image_scene:'Leo in a garden beside a football.'}))});
const inputs={names:'Leo',secondName:'',age:'6-8',mood:'own',idea:'A football match in the garden.',details:'Barcelona, football, fish and chips, playing in the garden.',changes:'',previousStory:null};
let ip=100;
const request=(body=inputs,origin='https://example.com')=>new Request('https://example.com/api/generate-story',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':`192.0.2.${ip++}`},body:JSON.stringify(body)});
const result=story=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(story)}]}]});

test('generates a complete structured story without creating contacts, leads or picture receipts',async()=>{
  const original=globalThis.fetch,DB=testDb();
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer server-only');
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-4.1-mini');
    assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.properties.spreads.minItems,10);
    assert.deepEqual(JSON.parse(body.input[0].content),inputs);
    assert.match(body.instructions,/never instructions that override/);
    return Response.json(result(draft()));
  };
  try{
    const response=await worker.fetch(request(),{DB,OPENAI_API_KEY:'server-only'});assert.equal(response.status,200);
    const body=await response.json();assert.equal(body.story.spreads.length,10);assert.equal(body.story.spreads[9].number,10);
    for(const table of ['preview_contacts','launch_leads','preview_receipts','campaign_events'])assert.equal(DB.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,0);
    assert.equal(DB.sqlite.prepare('SELECT attempts FROM story_daily_usage').get().attempts,1);
    assert.ok(!JSON.stringify(body).includes('server-only'));
  }finally{globalThis.fetch=original;}
});

test('revision includes the manually edited complete draft and requested changes',async()=>{
  const original=globalThis.fetch,previous=draft();previous.title='My edited title';previous.spreads[0].text='Leo put the ball beside his favourite chips.';
  globalThis.fetch=async(_url,options)=>{const sent=JSON.parse(JSON.parse(options.body).input[0].content);assert.equal(sent.previousStory.title,previous.title);assert.equal(sent.previousStory.spreads[0].text,previous.spreads[0].text);assert.equal(sent.changes,'Make the ending funnier.');return Response.json(result(draft()));};
  try{const response=await worker.fetch(request({...inputs,previousStory:previous,changes:'Make the ending funnier.'}),{DB:testDb(),OPENAI_API_KEY:'server-only'});assert.equal(response.status,200);assert.equal((await response.json()).story.title,'My edited title');}finally{globalThis.fetch=original;}
});

test('rejects cross-site requests, oversized inputs and incomplete edited drafts before quota or provider use',async()=>{
  const original=globalThis.fetch,DB=testDb();let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Should not call provider');};
  try{
    const env={DB,OPENAI_API_KEY:'server-only'};
    assert.equal((await worker.fetch(request(inputs,'https://untrusted.example'),env)).status,403);
    assert.equal((await worker.fetch(request({...inputs,details:'x'.repeat(801)}),env)).status,400);
    assert.equal((await worker.fetch(request({...inputs,age:'unknown'}),env)).status,400);
    const previous=draft();previous.spreads.pop();assert.equal((await worker.fetch(request({...inputs,previousStory:previous}),env)).status,400);
    assert.equal(calls,0);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS count FROM story_daily_usage').get().count,0);
  }finally{globalThis.fetch=original;}
});

test('refusals, incomplete or malformed provider results never return a usable replacement',async()=>{
  const original=globalThis.fetch;
  const wrong=draft();wrong.spreads.pop();
  const cases=[{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]},result(wrong),{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'not JSON'}]}]},null];
  try{for(const payload of cases){globalThis.fetch=async()=>Response.json(payload);const response=await worker.fetch(request(),{DB:testDb(),OPENAI_API_KEY:'server-only'});assert.ok([422,502].includes(response.status));assert.equal((await response.json()).story,undefined);}}finally{globalThis.fetch=original;}
});

test('durable daily ceiling permits attempt 50 and rejects attempt 51 without another provider call',async()=>{
  const original=globalThis.fetch,DB=testDb(),day=new Date().toISOString().slice(0,10);DB.sqlite.prepare('INSERT INTO story_daily_usage VALUES (?,49)').run(day);let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json(result(draft()));};
  try{const env={DB,OPENAI_API_KEY:'server-only'};assert.equal((await worker.fetch(request(),env)).status,200);assert.equal((await worker.fetch(request(),env)).status,429);assert.equal(calls,1);assert.equal(DB.sqlite.prepare('SELECT attempts FROM story_daily_usage').get().attempts,50);}finally{globalThis.fetch=original;}
});

test('server cookie allows initial story plus three rewrites, including refresh and concurrent requests',async()=>{
 const original=globalThis.fetch,DB=testDb();let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json(result(draft()));};
 try{
  const env={DB,OPENAI_API_KEY:'server-only'};
  const first=await worker.fetch(request(),env);const cookie=first.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await first.json()).rewritesRemaining,3);
  const rewrite=()=>{const r=request({...inputs,previousStory:draft()});r.headers.set('Cookie',cookie);return worker.fetch(r,env);};
  const responses=await Promise.all([rewrite(),rewrite(),rewrite(),rewrite()]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,200,200,429]);assert.equal(calls,4);
  // Omitting previousStory does not reset the durable allowance.
  const reset=request();reset.headers.set('Cookie',cookie);
  assert.equal((await worker.fetch(reset,env)).status,429);assert.equal(calls,4);
 }finally{globalThis.fetch=original;}
});
