import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerAuth,ownerSession} from '../src/owner-auth.js';
import {testDb} from './sqlite-d1.mjs';

const origin='https://cq.test';
function setup(){
  const sent=[];
  const env={DB:testDb(),RESEND_API_KEY:'test-key',ORDER_EMAIL_FROM:'Craven & Quill <books@example.test>',async fetch(url,options){sent.push({url,options});return Response.json({id:'mail-1'});}};
  const post=(path,body,headers={})=>ownerAuth(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(body)}),env);
  return {env,sent,post};
}

test('only the owner address receives a one-use, expiring sign-in link',async()=>{
  const {env,sent,post}=setup();
  assert.equal((await post('/api/owner-auth/request',{email:'other@example.com'})).status,200);
  assert.equal(sent.length,0);
  assert.equal((await post('/api/owner-auth/request',{email:'cravenluke@gmail.com'},{Origin:'https://other.test'})).status,403);
  assert.equal(sent.length,0);
  assert.equal((await post('/api/owner-auth/request',{email:'cravenluke@gmail.com'},{Origin:'null','Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await post('/api/owner-auth/request',{email:'cravenluke@gmail.com'},{Origin:'null','Sec-Fetch-Site':'same-origin'})).status,200);
  assert.equal(sent.length,1);
  assert.deepEqual(JSON.parse(sent[0].options.body).to,['cravenluke@gmail.com']);
  const link=JSON.parse(sent[0].options.body).text.match(/https:\/\/\S+/)[0];
  const page=await ownerAuth(new Request(link),env);
  assert.equal(page.status,200);
  assert.match(await page.text(),/Sign in to your dashboard/);
  const token=new URL(link).searchParams.get('token');
  const login=await post('/api/owner-auth/confirm',{token});
  assert.equal(login.status,303);
  assert.equal(login.headers.get('Location'),'/orders.html');
  const cookie=login.headers.get('Set-Cookie');
  assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
  const request=new Request(origin+'/api/orders/admin',{headers:{Cookie:cookie.split(';')[0]}});
  assert.equal(await ownerSession(request,env),'cravenluke@gmail.com');
  assert.equal((await post('/api/owner-auth/confirm',{token})).status,400);
  assert.equal((await post('/api/owner-auth/request',{email:'cravenluke@gmail.com'})).status,429);
  assert.equal(sent.length,1);
  const logout=await post('/api/owner-auth/logout',{}, {Cookie:cookie.split(';')[0]});
  assert.equal(logout.status,303);
  assert.equal(await ownerSession(request,env),null);
});

test('an expired link cannot create a session',async()=>{
  const {env,sent,post}=setup();
  await post('/api/owner-auth/request',{email:'cravenluke@gmail.com'});
  env.DB.sqlite.prepare("UPDATE owner_login_links SET expires_at='2000-01-01T00:00:00.000Z'").run();
  const token=new URL(JSON.parse(sent[0].options.body).text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
  assert.equal((await post('/api/owner-auth/confirm',{token})).status,400);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM owner_login_sessions').get().n,0);
});
