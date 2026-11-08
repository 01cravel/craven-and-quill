import {adConfig,metaConfig} from './ad-measurement.js';
import {ownerSession} from './owner-auth.js';
import {PRODUCTS} from './catalog.js';

// Owner-only analytics. Every visit is measured without cookies: a random visit reference travels in
// the page link. The privacy notice covers a shortened IP, town, and links from the visit to its
// previews, preview email, saved book and launch-list signup. That extra detail is deleted after 90 days.
const OWNER_EMAIL='cravenluke@gmail.com';
const ZONE='Europe/London';
const SPEND_TABLE='CREATE TABLE IF NOT EXISTS owner_ad_spend (day TEXT NOT NULL, creative TEXT NOT NULL, pence INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (day, creative))';
// Owner-entered unit costs. Values are pence, except fee_percent which is hundredths of a percent (410 = 4.1%).
const COSTS_TABLE='CREATE TABLE IF NOT EXISTS owner_cost_model (key TEXT PRIMARY KEY, value INTEGER NOT NULL, updated_at TEXT NOT NULL)';
export const COST_DEFAULTS={print_a5:1600,print_a4:1800,fee_percent:410,fee_fixed:20,art_book:150,preview:10};
const PROFIT_TARGET=500;
const SIGNUPS_TABLE='CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY, interest TEXT NOT NULL, page TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)';
const LIST_LIMIT=300;
const DETAIL_DAYS=90;
// Builder pages in the order a visitor meets them.
export const FUNNEL=[
  ['visit','Arrived on the site'],['maker_start','Opened the book maker'],['step_1','Name page'],['step_8','Reading level page'],['step_9','Story details page'],['step_3','Story tone page'],
  ['step_2','Photo page'],['photo_picked','Added a photo'],['photo_passed','Photo passed the check'],['step_10','Preview email page'],['preview_start','Asked for a free preview'],['preview_success','Got their character'],['step_5','Saw their character'],
  ['step_4','Read their story'],['step_6','Book size page'],['price_view','Saw the prices'],['step_11','Delivery page'],['step_7','Reached review and pay'],['book_saved','Saved a book'],['checkout_start','Pressed pay'],['paid','Paid']
];
// Page-open totals per step, kept with no visitor reference at all.
export const COUNT_STEPS=[
  ['arrive','Arrived'],['maker_start','Opened the book maker'],['step_1','Name page'],['step_8','Reading level page'],['step_9','Story details page'],['step_3','Story tone page'],
  ['step_2','Photo page'],['photo_open','Tapped add photo'],['photo_picked','Picked a photo'],['photo_passed','Photo passed check'],['photo_failed','Photo failed check'],
  ['step_10','Preview email page'],['preview_start','Asked for a preview'],['preview_success','Got their character'],['step_5','Character page'],
  ['step_4','Story page'],['step_6','Book size page'],['price_view','Saw the prices'],['step_11','Delivery page'],['step_7','Review and pay'],['book_saved','Saved a book'],['checkout_start','Pressed pay']
];
const ERRORS={preview_error:'Preview failed',checkout_error:'Payment page failed'};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const code=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(value)?value:'';
const isDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'));
const parts=(t,options)=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hourCycle:'h23',...options}).formatToParts(new Date(t)).map(p=>[p.type,p.value]));
export const ukDay=t=>{const p=parts(t,{year:'numeric',month:'2-digit',day:'2-digit'});return `${p.year}-${p.month}-${p.day}`;};
export const ukHour=t=>Number(parts(t,{hour:'2-digit'}).hour)%24;
// First instant of a UK calendar day, whatever the clocks are doing.
export function ukMidnight(day){
  const guess=Date.parse(day+'T00:00:00Z');
  const p=parts(guess,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const offset=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-guess;
  return new Date(guess-offset).toISOString();
}
const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const json=value=>{try{return JSON.parse(value);}catch{return {};}};
const rows=async statement=>(await statement.all()).results||[];
// Visit detail tables arrive with a migration; until it runs the report still works without them.
const optional=async statement=>{try{return await rows(statement);}catch{return [];}};
function sameOrigin(req){const origin=req.headers.get('Origin');return req.headers.get('Sec-Fetch-Site')!=='cross-site'&&origin===new URL(req.url).origin;}

function range(url){
  const today=ukDay(Date.now());
  let from=url.searchParams.get('from'),to=url.searchParams.get('to');
  if(!isDay(to))to=today;if(!isDay(from))from=addDays(to,-6);
  if(from>to)[from,to]=[to,from];
  if(Date.parse(to)-Date.parse(from)>366*86400000)from=addDays(to,-366);
  return {from,to,since:ukMidnight(from),until:ukMidnight(addDays(to,1))};
}

function tally(list,key,value=1){const found=list.get(key)||0;list.set(key,found+value);}
const sorted=map=>[...map].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count||String(a.key).localeCompare(String(b.key)));

export function countReport(list,from,to){
  const steps=new Map(COUNT_STEPS.map(([step])=>[step,0])),ads=new Map(),days=new Map(),devices=new Map(),countries=new Map();
  for(let day=from;day<=to;day=addDays(day,1))days.set(day,{day,arrived:0,previews:0});
  for(const r of list){
    if(!steps.has(r.event))continue;
    steps.set(r.event,steps.get(r.event)+r.n);
    const key=r.creative||'none';if(!ads.has(key))ads.set(key,{creative:key,source:r.source,counts:Object.fromEntries(COUNT_STEPS.map(([step])=>[step,0]))});
    ads.get(key).counts[r.event]+=r.n;
    const d=days.get(r.day);if(d&&r.event==='arrive')d.arrived+=r.n;if(d&&r.event==='preview_success')d.previews+=r.n;
    if(r.event==='arrive'){tally(devices,r.device,r.n);tally(countries,r.country||'unknown',r.n);}
  }
  return {
    steps:COUNT_STEPS.map(([step,label])=>({step,label,count:steps.get(step)})),
    ads:[...ads.values()].sort((a,b)=>b.counts.arrive-a.counts.arrive||a.creative.localeCompare(b.creative)),
    byDay:[...days.values()],devices:sorted(devices),countries:sorted(countries),
  };
}

export async function buildReport(env,url,req=null){
  const {from,to,since,until}=range(url);
  const filter={source:code(url.searchParams.get('source')),creative:code(url.searchParams.get('creative'))};
  const filtered=Boolean(filter.source||filter.creative);
  const matches=a=>Boolean(a)&&(!filter.source||a.source===filter.source)&&(!filter.creative||a.creative===filter.creative);
  await env.DB.prepare(SPEND_TABLE).run();await env.DB.prepare(SIGNUPS_TABLE).run();await env.DB.prepare(COSTS_TABLE).run();
  const q=(sql,...v)=>env.DB.prepare(sql).bind(...v);
  const expired=new Date(Date.now()-DETAIL_DAYS*86400000).toISOString();
  try{await q('DELETE FROM visit_details WHERE created_at < ?1',expired).run();await q('DELETE FROM visit_links WHERE created_at < ?1',expired).run();}catch{}
  const inRange='SELECT DISTINCT visit_id FROM campaign_events WHERE created_at >= ?1 AND created_at < ?2';
  const [events,receipts,contacts,leads,quotes,orderRows,spendRows,usage,signups,options,detailRows,linkRows,countRows,costRows,lastSale,spendSinceSale]=await Promise.all([
    rows(q('SELECT visit_id, event, source, medium, campaign, creative, country, created_at FROM campaign_events WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at LIMIT 200000',since,until)),
    rows(q('SELECT id, status, created_at, email FROM preview_receipts WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at DESC',since,until)),
    rows(q('SELECT email, source, medium, campaign, creative, country, created_at, updated_at FROM preview_contacts WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at DESC',since,until)),
    rows(q('SELECT email, product, price_pence, source, medium, campaign, creative, visit_id, country, created_at, unsubscribed_at FROM launch_leads WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at DESC',since,until)),
    rows(q('SELECT email, size, price_pence, first_shown_at, last_shown_at, offer_consent_at, email_status, redeemed_order_id FROM customer_quotes WHERE last_shown_at >= ?1 AND last_shown_at < ?2 ORDER BY last_shown_at DESC',since,until)),
    rows(q('SELECT id, email, size, amount, status, payment_status, payment_mode, state, created_at, updated_at FROM customer_orders WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at DESC',since,until)),
    rows(q('SELECT day, creative, pence FROM owner_ad_spend WHERE day >= ?1 AND day <= ?2 ORDER BY day DESC, creative',from,to)),
    rows(q('SELECT day, attempts FROM preview_daily_usage WHERE day >= ?1 AND day <= ?2 ORDER BY day',from,to)),
    rows(q('SELECT email, interest, page, created_at FROM signups WHERE created_at >= ?1 AND created_at < ?2 ORDER BY created_at DESC',since,until)),
    rows(q("SELECT DISTINCT source, creative FROM campaign_events WHERE created_at >= ?1 UNION SELECT DISTINCT 'meta', creative FROM owner_ad_spend",new Date(Date.now()-180*86400000).toISOString())),
    optional(q(`SELECT visit_id, ip_prefix, town, region FROM visit_details WHERE visit_id IN (${inRange})`,since,until)),
    optional(q(`SELECT l.visit_id, l.kind, l.ref, l.created_at, r.status FROM visit_links l LEFT JOIN preview_receipts r ON l.kind='preview' AND r.id=l.ref WHERE l.visit_id IN (${inRange}) ORDER BY l.created_at`,since,until)),
    optional(q('SELECT day, event, source, creative, country, device, SUM(n) AS n FROM visit_counts WHERE day >= ?1 AND day <= ?2 GROUP BY day, event, source, creative, country, device',from,to)),
    rows(q('SELECT key, value FROM owner_cost_model')),
    q("SELECT MAX(COALESCE(json_extract(state,'$.paidAt'),updated_at)) AS at FROM customer_orders WHERE payment_status='paid' AND payment_mode='live' AND email<>?1",OWNER_EMAIL).first(),
    q("SELECT COALESCE(SUM(pence),0) AS pence FROM owner_ad_spend WHERE day > COALESCE((SELECT substr(MAX(COALESCE(json_extract(state,'$.paidAt'),updated_at)),1,10) FROM customer_orders WHERE payment_status='paid' AND payment_mode='live' AND email<>?1),'')",OWNER_EMAIL).first(),
  ]);
  const costs={...COST_DEFAULTS};for(const r of costRows)if(r.key in costs)costs[r.key]=r.value;
  // Cost of one paid book at this price: payment fee, printing and the finished drawings.
  const bookCost=(size,amountPence)=>Math.round(amountPence*costs.fee_percent/10000)+costs.fee_fixed+(size==='a4'?costs.print_a4:costs.print_a5)+costs.art_book;

  // One journey per random visit id. Attribution comes from the visit's first event.
  const visits=new Map();
  for(const e of events){
    let v=visits.get(e.visit_id);
    if(!v){v={id:e.visit_id,source:e.source,medium:e.medium,campaign:e.campaign,creative:e.creative,country:e.country,firstAt:e.created_at,lastAt:e.created_at,events:new Map(),device:'unknown'};visits.set(e.visit_id,v);}
    if(e.created_at>v.lastAt)v.lastAt=e.created_at;
    if(e.event==='device_mobile')v.device='mobile';else if(e.event==='device_desktop')v.device='desktop';
    else if(!v.events.has(e.event))v.events.set(e.event,e.created_at);
  }

  const orders=orderRows.map(o=>{const d=json(o.state),m=d.measurement||null;return {
    id:o.id,email:o.email,size:o.size,amountPence:o.amount,status:o.status,paymentStatus:o.payment_status,paymentMode:o.payment_mode,createdAt:o.created_at,updatedAt:o.updated_at,
    names:d.names||'',age:d.age||'',title:d.story?.title||'',synopsis:d.story?.synopsis||'',dedication:d.dedication||'',characters:Array.isArray(d.characters)?d.characters.slice(0,2):[],
    source:m?.source||null,medium:m?.medium||null,campaign:m?.campaign||null,creative:m?.creative||null,country:m?.country||null,
    ownerTest:o.email===OWNER_EMAIL||o.payment_mode==='test',visitId:m?.visitId||null};});
  const paidVisits=new Set(orders.filter(o=>o.paymentStatus==='paid'&&!o.ownerTest&&o.visitId).map(o=>o.visitId));
  for(const v of visits.values())if(paidVisits.has(v.id))v.events.set('paid',v.lastAt);

  // A visit that reached a later page passed the earlier ones, even if an earlier event was missed.
  const index=new Map(FUNNEL.map(([s],i)=>[s,i]));
  for(const v of visits.values())v.far=Math.max(0,...[...v.events.keys()].map(s=>index.get(s)??0));
  const scope=[...visits.values()].filter(v=>!filtered||matches(v));
  const reached=(v,step)=>(index.get(step)??Infinity)<=v.far;
  const funnel=FUNNEL.map(([step,label])=>({step,label,visits:scope.filter(v=>reached(v,step)).length}));
  const errorVisits=Object.fromEntries(Object.keys(ERRORS).map(k=>[k,scope.filter(v=>v.events.has(k)).length]));

  const byDay=new Map(),byHour=new Map(),source=new Map(),creative=new Map(),campaign=new Map(),country=new Map(),device=new Map();
  for(let day=from;day<=to;day=addDays(day,1))byDay.set(day,{day,visits:0,previews:0,prices:0});
  for(let h=0;h<24;h++)byHour.set(h,0);
  const furthest=v=>FUNNEL[v.far];
  for(const v of scope){
    const day=byDay.get(ukDay(v.firstAt));if(day){day.visits++;if(v.events.has('preview_success'))day.previews++;if(v.events.has('price_view'))day.prices++;}
    tally(byHour,ukHour(v.firstAt));tally(source,v.source);tally(campaign,v.campaign);tally(country,v.country);tally(device,v.device);
  }
  // Per-ad table always shows every ad so they can be compared, even while one is filtered.
  const ads=new Map();
  const ad=key=>{if(!ads.has(key))ads.set(key,{creative:key,visits:0,previews:0,prices:0,checkouts:0,sales:0,revenuePence:0,spendPence:0,costPence:0});return ads.get(key);};
  for(const v of visits.values()){if(filter.source&&v.source!==filter.source)continue;const a=ad(v.creative);a.visits++;if(v.events.has('preview_success'))a.previews++;if(v.events.has('price_view'))a.prices++;if(v.events.has('checkout_start'))a.checkouts++;}
  const liveSales=orders.filter(o=>o.paymentStatus==='paid'&&!o.ownerTest);
  for(const o of liveSales)if(o.creative&&(!filter.source||o.source===filter.source)){const a=ad(o.creative);a.sales++;a.revenuePence+=o.amountPence;}
  for(const s of spendRows)if(s.creative!=='all')ad(s.creative).spendPence+=s.pence;
  for(const v of scope)tally(creative,v.creative);

  const scopedOrders=filtered?orders.filter(o=>matches(o)):orders;
  const sales=scopedOrders.filter(o=>o.paymentStatus==='paid'&&!o.ownerTest);
  const spendPence=spendRows.filter(s=>filter.creative?s.creative===filter.creative:!filter.source||filter.source==='meta').reduce((n,s)=>n+s.pence,0);
  const revenuePence=sales.reduce((n,o)=>n+o.amountPence,0);
  for(const o of liveSales)if(o.creative&&(!filter.source||o.source===filter.source))ad(o.creative).costPence+=bookCost(o.size,o.amountPence);
  const at=step=>funnel.find(f=>f.step===step).visits;
  const previewCounts=filtered?{tried:at('preview_start'),made:at('preview_success'),failed:errorVisits.preview_error}:{tried:receipts.length,made:receipts.filter(r=>r.status==='succeeded').length,failed:receipts.filter(r=>r.status==='failed').length};
  // Profit after every cost we know about, including previews drawn for people who never bought.
  const previewAttempts=filtered?previewCounts.tried:Math.max(previewCounts.tried,usage.reduce((n,u)=>n+u.attempts,0));
  const feesPence=sales.reduce((n,o)=>n+Math.round(o.amountPence*costs.fee_percent/10000)+costs.fee_fixed,0);
  const printPence=sales.reduce((n,o)=>n+(o.size==='a4'?costs.print_a4:costs.print_a5),0);
  const artPence=sales.length*costs.art_book,previewPence=previewAttempts*costs.preview;
  const profitPence=revenuePence-feesPence-printPence-artPence-previewPence-spendPence;
  const room=size=>{const p=PRODUCTS[size];return {size,label:p.label,pricePence:p.pricePence,adRoomPence:p.pricePence-bookCost(size,p.pricePence)-PROFIT_TARGET};};
  const economics={costs,target:PROFIT_TARGET,sales:sales.length,revenuePence,feesPence,printPence,artPence,previewAttempts,previewPence,spendPence,profitPence,
    profitPerSalePence:sales.length?Math.round(profitPence/sales.length):null,room:[room('a4'),room('a5')],
    stop:{limitPence:10000,spentSinceSalePence:spendSinceSale?.pence||0,lastSaleAt:lastSale?.at||null}};
  const scopedContacts=filtered?contacts.filter(matches):contacts,scopedLeads=filtered?leads.filter(matches):leads;
  const headline={visits:scope.length,previewsTried:previewCounts.tried,previewsMade:previewCounts.made,previewsFailed:previewCounts.failed,
    previewEmails:scopedContacts.length,quotes:filtered?null:quotes.length,launchSignups:scopedLeads.length,booksSaved:scopedOrders.filter(o=>!o.ownerTest).length,
    sales:sales.length,revenuePence,spendPence,costPerSalePence:sales.length&&spendPence?Math.round(spendPence/sales.length):null,
    costPerVisitPence:scope.length&&spendPence?Math.round(spendPence/scope.length):null,testOrders:scopedOrders.filter(o=>o.ownerTest).length};

  const leadByVisit=new Map(leads.filter(l=>l.visit_id).map(l=>[l.visit_id,l]));
  const detailByVisit=new Map(detailRows.map(x=>[x.visit_id,x]));
  const madeByVisit=new Map(),visitByRef=new Map();
  const made=id=>{if(!madeByVisit.has(id))madeByVisit.set(id,{previews:[],email:null,book:null});return madeByVisit.get(id);};
  for(const l of linkRows){visitByRef.set(l.kind+':'+l.ref,l.visit_id);if(l.kind==='preview')made(l.visit_id).previews.push({at:l.created_at,status:l.status||'unknown'});else if(l.kind==='contact')made(l.visit_id).email=l.ref;}
  for(const o of orders)if(o.visitId){const m=made(o.visitId);if(!m.book)m.book={title:o.title,names:o.names,paid:o.paymentStatus==='paid',test:o.ownerTest};m.email||=o.email;}
  const place=visitId=>{const d=visitId&&detailByVisit.get(visitId);return d?{town:d.town||null,region:d.region||null,ip:d.ip_prefix||null}:null;};
  const journeys=scope.sort((a,b)=>b.firstAt.localeCompare(a.firstAt)).slice(0,LIST_LIMIT).map(v=>{const last=furthest(v),lead=leadByVisit.get(v.id);return {
    firstAt:v.firstAt,lastAt:v.lastAt,source:v.source,medium:v.medium,campaign:v.campaign,creative:v.creative,country:v.country,device:v.device,
    furthest:last[1],furthestIndex:FUNNEL.indexOf(last),steps:FUNNEL.filter(([s])=>reached(v,s)).map(([s])=>s),
    errors:Object.keys(ERRORS).filter(k=>v.events.has(k)).map(k=>ERRORS[k]),extras:['story_generated','story_edited'].filter(k=>v.events.has(k)),
    signup:lead?{email:lead.email,product:lead.product}:null,where:place(v.id),made:madeByVisit.get(v.id)||null};});

  const previewsByEmail=new Map();for(const r of receipts)if(r.email)tally(previewsByEmail,r.email);
  const contactByEmail=new Map(contacts.map(c=>[c.email,c]));
  const ordersByEmail=new Map();for(const o of orders)if(!ordersByEmail.has(o.email))ordersByEmail.set(o.email,o);
  const limit=Number(env.PREVIEW_DAILY_LIMIT||50);
  const errors=[
    ...events.filter(e=>ERRORS[e.event]&&(!filtered||matches(e))).map(e=>({at:e.created_at,kind:ERRORS[e.event],detail:[e.creative!=='none'?'Ad '+e.creative:'Not from an ad',e.country].join(', ')})),
    ...(filtered?[]:receipts.filter(r=>r.status==='failed'||(r.status==='started'&&Date.parse(r.created_at)<Date.now()-600000)).map(r=>({at:r.created_at,kind:r.status==='failed'?'Drawing service refused or failed':'Preview never finished',detail:r.email||'No email given'}))),
    ...(filtered?[]:usage.filter(u=>u.attempts>=limit).map(u=>({at:ukMidnight(u.day),kind:'Daily free preview limit reached',detail:`${u.attempts} of ${limit} previews used on ${u.day}`}))),
  ].sort((a,b)=>b.at.localeCompare(a.at));

  // Bring each email and each still-anonymous visit into one list. A visit is linked to an
  // email only when the service saved an explicit visit link, lead or order measurement.
  // Multiple emails on one visit stay separate rather than claiming they are one person.
  const receiptById=new Map(receipts.map(r=>[r.id,r]));
  const emailsByVisit=new Map();
  const associate=(id,email)=>{if(!id||!email)return;if(!emailsByVisit.has(id))emailsByVisit.set(id,new Set());emailsByVisit.get(id).add(email.toLowerCase());};
  for(const l of linkRows)associate(l.visit_id,l.kind==='contact'?l.ref:l.kind==='preview'?receiptById.get(l.ref)?.email:null);
  for(const l of leads)associate(l.visit_id,l.email);
  for(const o of orders)associate(o.visitId,o.email);
  const peopleByEmail=new Map();
  const person=email=>{const key=email.toLowerCase();if(!peopleByEmail.has(key))peopleByEmail.set(key,{email:key,firstAt:null,lastAt:null,visits:0,furthestIndex:0,steps:new Set(),activity:new Set(),previews:0,previewMade:0,books:0,title:null,names:null,source:null,sourceAt:null,creative:null,country:null,where:null,offerConsent:false,launchConsent:false});return peopleByEmail.get(key);};
  const touch=(p,at)=>{if(!at)return;if(!p.firstAt||at<p.firstAt)p.firstAt=at;if(!p.lastAt||at>p.lastAt)p.lastAt=at;};
  const stage=(p,key)=>{const n=index.get(key);if(n===undefined)return;p.furthestIndex=Math.max(p.furthestIndex,n);for(let i=0;i<=n;i++)p.steps.add(FUNNEL[i][0]);};
  const anonymous=[];
  for(const v of scope){
    const emailSet=emailsByVisit.get(v.id);
    if(emailSet?.size===1){const p=person([...emailSet][0]);p.visits++;touch(p,v.firstAt);touch(p,v.lastAt);stage(p,FUNNEL[v.far][0]);
      for(const key of v.events.keys())if(index.has(key))p.steps.add(key);
      if(!p.sourceAt||v.lastAt>=p.sourceAt){p.source=v.source;p.sourceAt=v.lastAt;p.creative=v.creative;p.country=v.country;p.where=place(v.id);}
    }else anonymous.push({kind:'visit',email:null,firstAt:v.firstAt,lastAt:v.lastAt,visits:1,furthestIndex:v.far,steps:FUNNEL.filter(([s])=>reached(v,s)).map(([s])=>s),activity:[],source:v.source,creative:v.creative,country:v.country,where:place(v.id),ambiguous:Boolean(emailSet?.size>1)});
  }
  for(const c of scopedContacts){const p=person(c.email);touch(p,c.created_at);touch(p,c.updated_at);p.activity.add('Preview email');p.source||=c.source;p.creative||=c.creative;p.country||=c.country;}
  for(const l of scopedLeads){const p=person(l.email);touch(p,l.created_at);p.activity.add('Storybook interest list');p.launchConsent=!l.unsubscribed_at;p.source||=l.source;p.creative||=l.creative;p.country||=l.country;}
  for(const o of scopedOrders){const p=person(o.email);touch(p,o.createdAt);touch(p,o.updatedAt);p.books++;p.title=o.title||p.title;p.names=o.names||p.names;p.activity.add(o.paymentStatus==='paid'?'Paid book':'Saved book');stage(p,o.paymentStatus==='paid'?'paid':'book_saved');p.source||=o.source;p.creative||=o.creative;p.country||=o.country;}
  for(const q of quotes)if(!filtered||peopleByEmail.has(q.email.toLowerCase())){const p=person(q.email);touch(p,q.last_shown_at);p.activity.add('Saw price');p.offerConsent=Boolean(q.offer_consent_at);stage(p,'price_view');}
  for(const r of receipts)if((!filtered||peopleByEmail.has(r.email?.toLowerCase()))&&r.email){const p=person(r.email);touch(p,r.created_at);p.previews++;if(r.status==='succeeded')p.previewMade++;p.activity.add('Preview request');stage(p,r.status==='succeeded'?'preview_success':'preview_start');}
  for(const s of signups)if(!filtered||peopleByEmail.has(s.email.toLowerCase())){const p=person(s.email);touch(p,s.created_at);p.activity.add('Colouring list');}
  for(const r of receipts)if(!r.email&&!visitByRef.has('preview:'+r.id)&&!filtered)anonymous.push({kind:'preview',email:null,firstAt:r.created_at,lastAt:r.created_at,visits:0,furthestIndex:index.get(r.status==='succeeded'?'preview_success':'preview_start'),steps:[],activity:['Preview request'],previews:1,previewMade:r.status==='succeeded'?1:0,source:null,creative:null,country:null,where:null});
  const people=[...peopleByEmail.values()].map(({sourceAt,...p})=>({...p,kind:'email',steps:[...p.steps],activity:[...p.activity],furthest:p.steps.size?FUNNEL[p.furthestIndex][1]:'No measured visit'})).concat(anonymous.map(p=>({...p,furthest:FUNNEL[p.furthestIndex][1]}))).sort((a,b)=>(b.lastAt||'').localeCompare(a.lastAt||''));

  const everyone=countReport(countRows.filter(r=>matches(r)),from,to);
  return {
    range:{from,to},filter,everyone,zone:ZONE,generatedAt:new Date().toISOString(),
    // What location detail the host attaches to requests, checked on the owner's own request.
    hostLocation:req?{locationObject:Boolean(req.cf),town:Boolean(req.cf?.city),townHeader:Boolean(req.headers.get('cf-ipcity')),region:Boolean(req.cf?.region||req.cf?.regionCode),regionHeader:Boolean(req.headers.get('cf-region')||req.headers.get('cf-region-code'))}:null,
    options:{sources:[...new Set(options.map(o=>o.source))].sort(),creatives:[...new Set(options.map(o=>o.creative))].filter(c=>c!=='all').sort()},
    headline,economics,funnel,errorVisits,
    traffic:{byDay:[...byDay.values()],byHour:[...byHour].map(([hour,visits])=>({hour,visits})),source:sorted(source),campaign:sorted(campaign),creative:sorted(creative),country:sorted(country),device:sorted(device)},
    ads:[...ads.values()].sort((a,b)=>b.visits-a.visits||a.creative.localeCompare(b.creative)),
    people,peopleTotal:people.length,knownEmailTotal:peopleByEmail.size,anonymousTotal:anonymous.length,
    journeys,journeyTotal:scope.length,
    previews:receipts.slice(0,LIST_LIMIT).map(r=>{const c=r.email&&contactByEmail.get(r.email),o=r.email&&ordersByEmail.get(r.email);return {at:r.created_at,status:r.status,email:r.email||null,where:place(visitByRef.get('preview:'+r.id)),creative:c?.creative||null,country:c?.country||null,triesByEmail:r.email?previewsByEmail.get(r.email):null,savedBook:o?o.title||'Saved':null};}),
    previewTotal:receipts.length,
    orders:scopedOrders.slice(0,LIST_LIMIT).map(({visitId,...o})=>o),
    contacts:scopedContacts.slice(0,LIST_LIMIT).map(c=>({where:place(visitByRef.get('contact:'+c.email)),email:c.email,source:c.source,creative:c.creative,country:c.country,at:c.created_at,previews:previewsByEmail.get(c.email)||0,savedBook:ordersByEmail.get(c.email)?.title||null})),
    quotes:quotes.slice(0,LIST_LIMIT).map(x=>({email:x.email,size:x.size,pricePence:x.price_pence,firstAt:x.first_shown_at,lastAt:x.last_shown_at,offerConsent:!!x.offer_consent_at,offerEmail:x.email_status||null,bought:!!x.redeemed_order_id||orders.some(o=>o.email===x.email&&o.paymentStatus==='paid')})),
    launchSignups:scopedLeads.slice(0,LIST_LIMIT).map(l=>({email:l.email,product:l.product,pricePence:l.price_pence,source:l.source,creative:l.creative,country:l.country,at:l.created_at,unsubscribed:!!l.unsubscribed_at,linkedVisit:!!l.visit_id})),
    colouringSignups:signups.slice(0,LIST_LIMIT).map(s=>({email:s.email,interest:s.interest,page:s.page,at:s.created_at})),
    errors:errors.slice(0,LIST_LIMIT),
    spend:spendRows,
    notes:[
      'Every visit is measured without cookies from 5 November 2026. Before that, journeys exist only for the few visitors who accepted the cookie banner, so earlier days look emptier than they were.',
      'A visit is one random reference carried in the page link. Opening the site again from a fresh link counts as a new visit.',
      'Page totals are a second, simpler count with no visitor reference at all; a reload can add one there. They start from 3 November 2026.',
      'The IP is shortened before saving (it points to a network area, not one device) and town comes from Cloudflare. Previews, emails and books link to the visit. This detail is deleted after 90 days.',
      'All eleven maker pages are measured from this release. Earlier visits cannot show pages that were not measured then.',
      'An email joins visits only when the visit reference was saved with that email. Anonymous visits and unlinked preview requests cannot be identified as a person, and the same person may have several visits.',
      'Preview totals without an ad filter count every drawing request on the site, including retries and people who declined measurement.',
      'Profit uses the unit costs you enter: payment fee, printing, finished drawings and one preview drawing per attempt. Delivery, replacements, refunds and your time are not included. Check the fee against the Ziina settlement statement.',
    ],
  };
}

export async function analyticsApi(req,env){
  const url=new URL(req.url),path=url.pathname;
  if(path!=='/api/owner-analytics'&&path!=='/api/owner-analytics/spend'&&path!=='/api/owner-analytics/costs')return null;
  if(!env.DB)return reply({error:'Analytics storage is unavailable.'},503);
  if(!await ownerSession(req,env))return reply({error:'Sign in with an email link sent to the owner.'},401);
  try{
    if(path==='/api/owner-analytics'){
      if(req.method!=='GET')return reply({error:'Method not allowed.'},405);
      return reply({...await buildReport(env,url,req),advertisingTracking:{googleTagConfigured:!!adConfig(env).tagId,leadConfigured:!!adConfig(env).lead,purchaseConfigured:!!adConfig(env).purchase,serverFeedPrepared:!!env.GOOGLE_ADS_FEED_PASSWORD,metaPixelConfigured:/^[0-9]{5,30}$/.test(env.META_PIXEL_ID||''),metaPurchaseConfigured:!!metaConfig(env),note:'Configuration only. Google acceptance and attributed results must be checked in Google Ads. Missing attribution is unknown, never proof of zero leads.'}});
    }
    if(req.method!=='POST')return reply({error:'Method not allowed.'},405);
    if(!sameOrigin(req))return reply({error:'Reload the page and try again.'},403);
    let input;try{const raw=await req.text();if(raw.length>2048)throw Error('Too large');input=JSON.parse(raw);}catch{return reply({error:'Check the form and try again.'},400);}
    if(path==='/api/owner-analytics/costs'){
      const entries=Object.entries(input||{}).filter(([k])=>k in COST_DEFAULTS).map(([k,v])=>[k,Math.round(Number(v)*100)]);
      if(!entries.length||entries.some(([,v])=>!Number.isFinite(v)||v<0||v>1000000))return reply({error:'Enter each cost as a number of pounds, and the fee as a percentage.'},400);
      await env.DB.prepare(COSTS_TABLE).run();
      for(const [k,v] of entries)await env.DB.prepare('INSERT INTO owner_cost_model (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').bind(k,v,new Date().toISOString()).run();
      return reply({ok:true,saved:Object.fromEntries(entries)});
    }
    const day=input?.day,creative=input?.creative==='all'?'all':code(input?.creative),pence=Math.round(Number(input?.pounds)*100);
    if(!isDay(day)||!creative||!Number.isFinite(pence)||pence<0||pence>10000000)return reply({error:'Enter a date, an ad and an amount in pounds.'},400);
    await env.DB.prepare(SPEND_TABLE).run();
    if(pence===0)await env.DB.prepare('DELETE FROM owner_ad_spend WHERE day=?1 AND creative=?2').bind(day,creative).run();
    else await env.DB.prepare('INSERT INTO owner_ad_spend (day, creative, pence, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(day, creative) DO UPDATE SET pence=excluded.pence, updated_at=excluded.updated_at').bind(day,creative,pence,new Date().toISOString()).run();
    return reply({ok:true,day,creative,pence});
  }catch(error){console.error('Owner analytics failed',error?.name||'Error');return reply({error:'Analytics could not be loaded just now.'},500);}
}
