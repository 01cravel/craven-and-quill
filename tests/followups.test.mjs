import test from 'node:test';
import assert from 'node:assert/strict';
import {testDb} from './sqlite-d1.mjs';
import {recordFollowupConsent,runFollowups,unsubscribeFollowup,followupStatus,recordPreviewChoice} from '../dist/server/orders.js';

function fixture(){
  const DB=testDb(),sent=[],email='reader@example.test',token=crypto.randomUUID();
  DB.sqlite.prepare(`INSERT INTO customer_quotes (email,size,price_pence,catalogue_version,first_shown_at,last_shown_at,offer_consent_at,unsubscribe_token)
    VALUES (?,?,?,?,?,?,?,?)`).run(email,'a5',3999,'test','2026-10-20T00:00:00.000Z','2026-10-20T00:00:00.000Z','2026-10-20T00:00:00.000Z',token);
  DB.sqlite.exec("UPDATE customer_quotes SET confirmed_view_at=last_shown_at");
  const env={DB,RESEND_API_KEY:'test-key',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push({url,options,body:JSON.parse(options.body)});return Response.json({id:'email-'+sent.length});}};
  return {env,DB,sent,email,token};
}

test('new consent sends one reminder and then a single 10% email after three days',async()=>{
  const {env,DB,sent,email}=fixture();
  await recordFollowupConsent(env,email,'yes');
  assert.deepEqual(await runFollowups(env),{paused:true});
  assert.equal(sent.length,0);
  env.FOLLOWUP_EMAILS_ENABLED='true';
  let result=await runFollowups(env);
  assert.equal(result.first.accepted,1);
  assert.equal(sent.length,1);
  assert.match(sent[0].body.html,/book is waiting/);
  assert.match(sent[0].body.html,/https:\/\/cravenandquill.com\/assets\/craven-quill-gold-logo.png/);
  assert.ok(sent[0].body.text.includes('Stop these emails'));
  assert.ok(sent[0].body.text.includes('create.html?utm_source=email&utm_medium=email&utm_campaign=reminder&utm_content=reminder_1'));
  DB.sqlite.prepare('UPDATE followup_sequences SET first_sent_at=? WHERE email=?').run('2026-10-20T00:00:00.000Z',email);
  result=await runFollowups(env);
  assert.equal(result.second.accepted,1);
  assert.equal(sent.length,2);
  assert.match(sent[1].body.html,/10% off/);
  assert.match(sent[1].body.text,/create\.html\?offer=[^&\s]+&utm_source=email&utm_medium=email&utm_campaign=reminder&utm_content=reminder_2/);
  assert.equal(DB.sqlite.prepare('SELECT discount_pence FROM customer_quotes WHERE email=?').get(email).discount_pence,250);
  await runFollowups(env);
  assert.equal(sent.length,2);
});

test('unsubscribe and paid orders suppress follow-ups',async()=>{
  const {env,DB,sent,email,token}=fixture();
  await recordFollowupConsent(env,email,'yes');env.FOLLOWUP_EMAILS_ENABLED='true';
  await unsubscribeFollowup(env,token);
  await runFollowups(env);
  assert.equal(sent.length,0);
  await recordFollowupConsent(env,email,'yes');
  DB.sqlite.prepare('UPDATE customer_quotes SET offer_consent_at=?,offer_unsubscribed_at=NULL WHERE email=?').run(new Date().toISOString(),email);
  DB.sqlite.prepare(`INSERT INTO customer_orders (id,token_hash,email,size,amount,status,payment_status,revision,state,created_at,updated_at)
    VALUES (?,?,?,?,?,'awaiting_review','paid',1,'{}',?,?)`).run(crypto.randomUUID(),'hash',email,'a5',3999,new Date().toISOString(),new Date().toISOString());
  await runFollowups(env);
  assert.equal(sent.length,0);
  assert.equal((await followupStatus(env)).firstSent,0);
});

test('neither reminder can use assumed permission or an unverified price',async()=>{
 for(const problem of ['legacy consent','legacy quote']){
  const {env,DB,sent,email}=fixture();
  env.FOLLOWUP_EMAILS_ENABLED='true';
  await recordFollowupConsent(env,email,'yes');
  if(problem==='legacy consent')DB.sqlite.exec("UPDATE followup_sequences SET consent_text='soft opt-in'");
  else DB.sqlite.exec('UPDATE customer_quotes SET confirmed_view_at=NULL');
  await runFollowups(env);
  DB.sqlite.exec("UPDATE followup_sequences SET first_status='accepted', first_sent_at='2020-01-01'");
  await runFollowups(env);
  assert.equal(sent.length,0,problem);
 }
});

test('only a new disclosed preview receives the sequence, without creating a quote',async()=>{
  const DB=testDb(),sent=[],env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push(JSON.parse(options.body));return Response.json({id:'sent'+sent.length});}};
  const email='reader@somewhere.invalid',no='declined@somewhere.invalid';
  for(const address of [email,no]){
    const id=crypto.randomUUID();
    DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(id,address,new Date().toISOString());
    assert.equal(await recordPreviewChoice(env,address,id,address===no),address!==no);
    assert.equal(await recordPreviewChoice(env,address,id,false),address!==no);
  }
  assert.equal((await runFollowups(env)).first.accepted,0);
  DB.sqlite.exec("UPDATE followup_sequences SET consent_at='2020-01-01' WHERE consent_at IS NOT NULL");
  assert.equal((await runFollowups(env)).first.accepted,1);
  DB.sqlite.exec("UPDATE followup_sequences SET first_sent_at='2020-01-01' WHERE first_status='accepted'");
  assert.equal((await runFollowups(env)).second.accepted,1);
  assert.deepEqual(sent.map(x=>x.to[0]),[email,email]);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM customer_quotes').get().n,0);
  const token=DB.sqlite.prepare('SELECT episode_id FROM followup_sequences WHERE email=?').get(email).episode_id;
  assert.equal(await unsubscribeFollowup(env,token),true);
  assert.equal(DB.sqlite.prepare('SELECT consent_at FROM followup_sequences WHERE email=?').get(email).consent_at,null);
});

test('reminder shows the child\'s character when one is saved',async()=>{
  const {env,sent,email}=fixture();
  const store=new Map();env.BOOK_ASSETS={async head(k){return store.has(k)?{}:null;},async get(k){return store.get(k)||null;},async put(k,v){store.set(k,v);}};
  const {sha}=await import('../src/catalog.js');store.set('followup/'+await sha(email),new Uint8Array([255,216]));
  await recordFollowupConsent(env,email,'yes');env.FOLLOWUP_EMAILS_ENABLED='true';
  await runFollowups(env);
  assert.match(sent[0].body.html,/api\/orders\/followup-character\?t=/);
  assert.match(sent[0].body.html,/as we drew them/);
});

test('unsubscribing from the first preview reminder stops the discount email and survives a new submission',async()=>{
  const {env,DB,sent,email}=fixture();
  const preview=crypto.randomUUID();
  DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(preview,email,new Date().toISOString());
  env.FOLLOWUP_EMAILS_ENABLED='true';
  assert.equal(await recordPreviewChoice(env,email,preview,false),true);
  DB.sqlite.exec("UPDATE followup_sequences SET consent_at='2020-01-01'");
  assert.equal((await runFollowups(env)).first.accepted,1);
  const link=sent[0].body.html.match(/href="([^"]+)"[^>]*>Unsubscribe<\/a>/);
  assert.ok(link);
  assert.equal(await unsubscribeFollowup(env,new URL(link[1]).searchParams.get('token')),true);
  assert.equal(await recordPreviewChoice(env,email,preview,false),false);
  DB.sqlite.exec("UPDATE followup_sequences SET first_sent_at='2020-01-01'");
  assert.equal((await runFollowups(env)).second.accepted,0);
  assert.equal(sent.length,1);
});

test('owner-approved one-off: past preview contacts get both reminders, opt-outs and owner skipped',async()=>{
  const {enrolPastContacts}=await import('../dist/server/orders.js');
  const DB=testDb(),sent=[];
  const env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'k',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push(JSON.parse(options.body));return Response.json({id:'e'+sent.length});}};
  const old='2026-10-01T00:00:00.000Z';
  const cols=DB.sqlite.prepare("PRAGMA table_info(preview_contacts)").all().map(c=>c.name);
  const add=email=>{const row={email,created_at:old,updated_at:old,source:'direct',medium:'none',campaign:'none',creative:'none',country:'GB'};const keys=cols.filter(k=>k in row);DB.sqlite.prepare(`INSERT INTO preview_contacts (${keys}) VALUES (${keys.map(()=>'?')})`).run(...keys.map(k=>row[k]));};
  ['mum@gmail.com','cravenluke@gmail.com','gone@gmail.com'].forEach(add);
  DB.sqlite.prepare(`INSERT INTO customer_quotes (email,size,price_pence,catalogue_version,first_shown_at,last_shown_at,offer_unsubscribed_at,unsubscribe_token) VALUES (?,?,?,?,?,?,?,?)`).run('gone@gmail.com','a5',3999,'t',old,old,old,crypto.randomUUID());
  assert.equal((await enrolPastContacts(env)).added,1);
  let r=await runFollowups(env);
  assert.deepEqual(sent.map(s=>s.to[0]),['mum@gmail.com']);
  assert.match(sent[0].subject,/book is waiting/);
  DB.sqlite.prepare('UPDATE followup_sequences SET first_sent_at=? WHERE email=?').run('2026-11-14T12:36:00.000Z','mum@gmail.com');
  r=await runFollowups(env);
  assert.equal(r.second.accepted,1);
  assert.equal(sent.length,2);
  assert.match(sent[1].subject,/10% off/);
  assert.equal((await runFollowups(env)).first.accepted,0);
  const token=DB.sqlite.prepare('SELECT episode_id FROM followup_sequences').get().episode_id;
  assert.match(token,/^[0-9a-f-]{36}$/);
  assert.equal(await unsubscribeFollowup(env,token),true);
  assert.equal((await enrolPastContacts(env)).added,0);
});

test('five-email chase: right email at the right time, saved-book link, one 10% code from email 3, never two close together',async()=>{
  const {CHASE_NOTICE,chaseDue,saveChaseLink}=await import('../dist/server/orders.js');
  const DB=testDb(),sent=[],email='chaser@somewhere.invalid',id=crypto.randomUUID();
  const env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'books@example.test',ORDER_LINK_SECRET:'s'.repeat(40),
    async fetch(url,options){sent.push(JSON.parse(options.body));return Response.json({id:'sent'+sent.length});}};
  DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(id,email,new Date().toISOString());
  assert.equal(await recordPreviewChoice(env,email,id,false,CHASE_NOTICE),true);
  DB.sqlite.exec("CREATE TABLE IF NOT EXISTS followup_details (email TEXT PRIMARY KEY, names TEXT, title TEXT, updated_at TEXT NOT NULL)");
  DB.sqlite.prepare("INSERT INTO followup_details VALUES (?,?,?,?)").run(email,'Mia','Mia and the Dinosaur Dig','2026-11-21');
  const draftId=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
  assert.equal(await saveChaseLink(env,email,draftId,token,Date.now()+7*86400000),true);
  assert.equal(DB.sqlite.prepare('SELECT sealed FROM chase_links').get().sealed.includes(token),false,'the private link is stored sealed');
  const age=hours=>DB.sqlite.prepare('UPDATE followup_sequences SET consent_at=? WHERE email=?').run(new Date(Date.now()-hours*3600000).toISOString(),email);
  const rest=()=>DB.sqlite.exec("UPDATE chase_steps SET sent_at='2020-01-01T00:00:00.000Z'");
  // Nothing in the first three hours, and the old two-email reminders never touch a chase shopper.
  let r=await runFollowups(env);assert.equal(sent.length,0);assert.equal(r.first.accepted,0);
  age(4);r=await runFollowups(env);assert.equal(r.chase.accepted,1);assert.equal(sent[0].subject,'We drew Mia. Come and look');
  assert.ok(sent[0].text.includes(`https://cravenandquill.com/create?utm_source=email&utm_medium=email&utm_campaign=chase&utm_content=chase_1#draft=${draftId}&key=${token}`),'opens their saved book');
  assert.equal(/Your code/.test(sent[0].html),false);assert.ok(sent[0].headers['List-Unsubscribe']);
  assert.ok(sent[0].html.indexOf('class="button"')<sent[0].html.indexOf('Any questions'),'button sits high in the email');
  // A day later but the last email went an hour ago: wait.
  age(25);await runFollowups(env);assert.equal(sent.length,1);
  rest();await runFollowups(env);assert.equal(sent[1].subject,'Picture Mia opening this');
  rest();age(73);await runFollowups(env);assert.equal(sent[2].subject,'“Again! The one about me.”');
  const code=DB.sqlite.prepare('SELECT discount_code,email_status,code_expires_at FROM reminder_offers WHERE email=?').get(email);
  assert.match(code.discount_code,/^CQ[A-Z0-9]{10}$/);assert.equal(code.email_status,'accepted');assert.ok(sent[2].html.includes(code.discount_code));
  assert.ok(sent[2].text.includes(`create?offer=${code.discount_code}&utm_source=email`));
  // Missed day 5 entirely: day 6 sends the last email, not a late bunch, with the same code.
  rest();age(150);await runFollowups(env);assert.equal(sent.length,4);assert.equal(sent[3].subject,'Tomorrow, Mia’s book is gone');assert.ok(sent[3].html.includes(code.discount_code));
  rest();await runFollowups(env);assert.equal(sent.length,4,'nothing after the last email');
  assert.deepEqual((await followupStatus(env)).chase,{enrolled:1,sent:[1,1,1,0,1]});
  assert.equal(chaseDue(170,[]),0,'nothing once the saved book has been deleted');assert.equal(chaseDue(2,[]),0);assert.equal(chaseDue(121,[]),4);
});

test('chase stops for buyers and unsubscribers, and falls back to the plain link without a saved book',async()=>{
  const {CHASE_NOTICE}=await import('../dist/server/orders.js');
  const DB=testDb(),sent=[],env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push(JSON.parse(options.body));return Response.json({id:'sent'+sent.length});}};
  const people=['plain@somewhere.invalid','gone@somewhere.invalid'];
  for(const email of people){const id=crypto.randomUUID();
    DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(id,email,new Date().toISOString());
    await recordPreviewChoice(env,email,id,false,CHASE_NOTICE);}
  DB.sqlite.prepare('UPDATE followup_sequences SET consent_at=?').run(new Date(Date.now()-30*3600000).toISOString());
  const token=DB.sqlite.prepare('SELECT episode_id FROM followup_sequences WHERE email=?').get(people[1]).episode_id;
  assert.equal(await unsubscribeFollowup(env,token),true);
  await runFollowups(env);
  assert.equal(sent.length,1);assert.deepEqual(sent[0].to,[people[0]]);assert.equal(sent[0].subject,'Picture them opening this');
  assert.ok(sent[0].text.includes('https://cravenandquill.com/create.html?utm_source=email&utm_medium=email&utm_campaign=chase&utm_content=chase_2'));
});

test('Christmas emails: everyone we hold an email for, once each, only inside the send window, never unsubscribers or shoppers mid-chase',async()=>{
  const {CHASE_NOTICE,seasonMessage,seasonDue}=await import('../dist/server/orders.js');
  const DB=testDb(),sent=[],env={DB,FOLLOWUP_EMAILS_ENABLED:'true',RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'books@example.test',
    async fetch(url,options){sent.push(JSON.parse(options.body));return Response.json({id:'sent'+sent.length});}};
  const add=email=>DB.sqlite.prepare("INSERT INTO preview_contacts(email,source,medium,campaign,creative,country,created_at,updated_at) VALUES (?,'a','b','c','d','GB',?,?)").run(email,'2026-11-18T00:00:00.000Z','2026-11-18T00:00:00.000Z');
  add('old@somewhere.invalid');add('gone@somewhere.invalid');add('luke@breeztechnologies.com');
  const chaser='chasing@somewhere.invalid',id=crypto.randomUUID();
  DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,email,created_at) VALUES (?,'succeeded',?,?)").run(id,chaser,new Date().toISOString());
  await recordPreviewChoice(env,chaser,id,false,CHASE_NOTICE);
  DB.sqlite.prepare('UPDATE followup_sequences SET consent_at=? WHERE email=?').run(new Date(Date.now()-3600000).toISOString(),chaser);
  env.NOW='2026-11-23T12:00:00Z';let r=await runFollowups(env);assert.deepEqual(r.season,{accepted:0,unknown:0});assert.equal(sent.length,0,'nothing before the first date');
  env.NOW='2026-11-24T09:00:00Z';r=await runFollowups(env);assert.equal(r.season.accepted,2);
  const token=DB.sqlite.prepare('SELECT episode_id FROM followup_sequences WHERE email=?').get('gone@somewhere.invalid').episode_id;
  assert.deepEqual(sent.map(m=>m.to[0]).sort(),['gone@somewhere.invalid','old@somewhere.invalid']);
  assert.equal(sent[0].subject,'A Christmas book with your child in it');assert.ok(sent[0].text.includes('order by 14 December'));
  assert.ok(sent[0].text.includes('https://cravenandquill.com/create?utm_source=email&utm_medium=email&utm_campaign=season&utm_content=xmas26_1'));
  assert.ok(sent[0].text.includes('Stop these emails'));assert.ok(sent[0].headers['List-Unsubscribe']);
  r=await runFollowups(env);assert.equal(r.season.accepted,0,'never twice');
  assert.equal(await unsubscribeFollowup(env,token),true);
  env.NOW='2026-11-27T09:00:00Z';await runFollowups(env);assert.equal(sent.length,2,'nothing between dates');
  env.NOW='2026-12-03T09:00:00Z';await runFollowups(env);assert.equal(sent.length,3);assert.deepEqual(sent[2].to,['old@somewhere.invalid']);
  env.NOW='2026-12-13T09:00:00Z';await runFollowups(env);assert.equal(sent[3].subject,'The last day for Christmas is tomorrow');
  assert.deepEqual((await followupStatus(env)).season.sent,{'xmas26-1':2,'xmas26-2':1,'xmas26-3':1});
  assert.equal(seasonDue(Date.parse('2026-12-14T09:00:00Z')),null);
  const m=seasonMessage('xmas26-2',{names:'Mia',image:'https://x/y.jpg',link:'https://l',unsub:'https://u'});
  assert.equal(m.subject,'Mia opening this on Christmas morning');assert.ok(m.html.includes('Make Mia’s book'));assert.ok(!m.html.includes('of 5'));
});
