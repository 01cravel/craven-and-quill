import assert from 'node:assert/strict';
import test from 'node:test';
import {File as NodeFile} from 'node:buffer';
import worker from '../dist/server/index.js';

globalThis.File=globalThis.File||NodeFile;

test('serves clean page URLs from static assets',async()=>{
  let requestedPath='';
  const env={ASSETS:{fetch(request){requestedPath=new URL(request.url).pathname;return new Response('page');}}};
  const response=await worker.fetch(new Request('https://example.com/create'),env);
  assert.equal(response.status,200);assert.equal(requestedPath,'/create.html');
});

test('keeps the OpenAI key on the server and returns the generated image',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/images/edits');
    assert.equal(options.headers.Authorization,'Bearer test-secret');
    assert.equal(options.body.get('model'),'gpt-image-2');
    assert.ok(options.body.get('image[]') instanceof File);
    return new Response(JSON.stringify({data:[{b64_json:'dGVzdA=='}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const form=new FormData();form.append('photo',new File(['image'],'person.jpg',{type:'image/jpeg'}));form.append('name','Amna');form.append('age','teen-adult');form.append('mood','classic');
    const response=await worker.fetch(new Request('https://example.com/api/generate-character',{method:'POST',headers:{Origin:'https://example.com','CF-Connecting-IP':'203.0.113.10'},body:form}),{OPENAI_API_KEY:'test-secret'});
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.image,'data:image/jpeg;base64,dGVzdA==');
  }finally{globalThis.fetch=originalFetch;}
});

// Minimal stand-in for the D1 binding: records every statement and its bound values.
function fakeDb(rows=[]){
  const calls=[];
  return {calls,prepare(sql){const stmt={sql,args:[],bind(...args){stmt.args=args;return stmt;},async run(){calls.push({sql,args:stmt.args});return {success:true};},async all(){calls.push({sql,args:stmt.args});return {results:rows};}};return stmt;}};
}

function signupRequest(body,ip='198.51.100.1'){
  return new Request('https://example.com/api/subscribe',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify(body)});
}

test('stores a launch-list signup with the email, what they asked for and the page',async()=>{
  const DB=fakeDb();
  const response=await worker.fetch(signupRequest({email:'  Reader@Example.com ',interest:'ghosts',page:'/colouring-books/books/ghosts-on-the-early-shift.html'}),{DB});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  const insert=DB.calls.find(c=>c.sql.startsWith('INSERT INTO signups'));
  assert.ok(insert,'row inserted');
  assert.equal(insert.args[0],'reader@example.com');
  assert.equal(insert.args[1],'ghosts');
  assert.equal(insert.args[2],'/colouring-books/books/ghosts-on-the-early-shift.html');
  assert.match(insert.args[3],/^\d{4}-\d{2}-\d{2}T/);
  assert.ok(DB.calls.some(c=>c.sql.startsWith('CREATE TABLE IF NOT EXISTS signups')),'table ensured');
});

test('falls back to a general interest and a root page when values are unknown',async()=>{
  const DB=fakeDb();
  await worker.fetch(signupRequest({email:'a@b.co',interest:'something-else',page:'javascript:alert(1)'}),{DB});
  const insert=DB.calls.find(c=>c.sql.startsWith('INSERT INTO signups'));
  assert.equal(insert.args[1],'general');assert.equal(insert.args[2],'/');
});

test('rejects an invalid email and stores nothing',async()=>{
  const DB=fakeDb();
  const response=await worker.fetch(signupRequest({email:'not-an-email'}),{DB});
  assert.equal(response.status,400);assert.equal(DB.calls.length,0);
});

test('ignores bot submissions that fill the hidden field',async()=>{
  const DB=fakeDb();
  const response=await worker.fetch(signupRequest({email:'bot@example.com',website:'http://spam'}),{DB});
  assert.equal(response.status,200);assert.equal(DB.calls.length,0);
});

test('explains clearly when the database is not connected',async()=>{
  const response=await worker.fetch(signupRequest({email:'a@b.co'}),{});
  assert.equal(response.status,503);
});

test('rejects signups from another origin',async()=>{
  const request=new Request('https://example.com/api/subscribe',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({email:'a@b.co'})});
  const response=await worker.fetch(request,{DB:fakeDb()});
  assert.equal(response.status,403);
});

test('exports the launch list as CSV only with the right token',async()=>{
  const DB=fakeDb([{email:'a@b.co',interest:'animals',page:'/colouring-books/',created_at:'2026-09-15T10:00:00.000Z',updated_at:'2026-09-15T10:00:00.000Z'}]);
  const env={DB,SIGNUPS_EXPORT_TOKEN:'s3cret'};
  assert.equal((await worker.fetch(new Request('https://example.com/api/signups.csv'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://example.com/api/signups.csv?token=wrong'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://example.com/api/signups.csv?token=s3cret'),{DB})).status,503);
  const response=await worker.fetch(new Request('https://example.com/api/signups.csv?token=s3cret'),env);
  assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/text\/csv/);
  const text=await response.text();
  assert.equal(text.split('\n')[0],'email,interest,page,created_at,updated_at');
  assert.match(text,/"a@b.co","animals","\/colouring-books\/"/);
});
