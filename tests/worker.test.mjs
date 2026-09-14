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
