import {ownerSession} from './owner-auth.js';

// Owner-only analytics. Reads what the site already stores; it adds no new visitor collection.
// Journey events exist only for visitors who allowed site measurement. They hold no IP address,
// names, emails or story text, so a visit is linked to a person only where the privacy notice allows
// (launch-list signups). Paid orders count towards the funnel and ad totals without naming the visit.
const OWNER_EMAIL='cravenluke@gmail.com';
const ZONE='Europe/London';
const SPEND_TABLE='CREATE TABLE IF NOT EXISTS owner_ad_spend (day TEXT NOT NULL, creative TEXT NOT NULL, pence INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (day, creative))';
const SIGNUPS_TABLE='CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY, interest TEXT NOT NULL, page TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)';
const LIST_LIMIT=300;
// Builder pages in the order a visitor meets them. Pages 3 and 8 to 11 are not measured by the builder.
export const FUNNEL=[
  ['visit','Arrived on the site'],['maker_start','Opened the book maker'],['step_1','Name page'],['step_2','Photo page'],
  ['preview_start','Asked for a free preview'],['preview_success','Got their character'],['step_5','Saw the preview book'],
  ['step_4','Read their story'],['price_view','Saw the prices'],['step_7','Reached review and pay'],['checkout_start','Pressed pay'],['paid','Paid']
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

export async function buildReport(env,url){
  const {from,to,since,until}=range(url);
  const filter={source:code(url.searchParams.get('source')),creative:code(url.searchParams.get('creative'))};
  const filtered=Boolean(filter.source||filter.creative);
  const matches=a=>Boolean(a)&&(!filter.source||a.source===filter.source)&&(!filter.creative||a.creative===filter.creative);
  await env.DB.prepare(SPEND_TABLE).run();await env.DB.prepare(SIGNUPS_TABLE).run();
  const q=(sql,...v)=>env.DB.prepare(sql).bind(...v);
  const [events,receipts,contacts,leads,quotes,orderRows,spendRows,usage,signups,options]=await Promise.all([
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
  ]);

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

  const scope=[...visits.values()].filter(v=>!filtered||matches(v));
  const reached=(v,step)=>step==='visit'||v.events.has(step);
  const funnel=FUNNEL.map(([step,label])=>({step,label,visits:scope.filter(v=>reached(v,step)).length}));
  const errorVisits=Object.fromEntries(Object.keys(ERRORS).map(k=>[k,scope.filter(v=>v.events.has(k)).length]));

  const byDay=new Map(),byHour=new Map(),source=new Map(),creative=new Map(),campaign=new Map(),country=new Map(),device=new Map();
  for(let day=from;day<=to;day=addDays(day,1))byDay.set(day,{day,visits:0,previews:0,prices:0});
  for(let h=0;h<24;h++)byHour.set(h,0);
  const furthest=v=>{let last=FUNNEL[0];for(const step of FUNNEL)if(reached(v,step[0]))last=step;return last;};
  for(const v of scope){
    const day=byDay.get(ukDay(v.firstAt));if(day){day.visits++;if(v.events.has('preview_success'))day.previews++;if(v.events.has('price_view'))day.prices++;}
    tally(byHour,ukHour(v.firstAt));tally(source,v.source);tally(campaign,v.campaign);tally(country,v.country);tally(device,v.device);
  }
  // Per-ad table always shows every ad so they can be compared, even while one is filtered.
  const ads=new Map();
  const ad=key=>{if(!ads.has(key))ads.set(key,{creative:key,visits:0,previews:0,prices:0,checkouts:0,sales:0,revenuePence:0,spendPence:0});return ads.get(key);};
  for(const v of visits.values()){if(filter.source&&v.source!==filter.source)continue;const a=ad(v.creative);a.visits++;if(v.events.has('preview_success'))a.previews++;if(v.events.has('price_view'))a.prices++;if(v.events.has('checkout_start'))a.checkouts++;}
  const liveSales=orders.filter(o=>o.paymentStatus==='paid'&&!o.ownerTest);
  for(const o of liveSales)if(o.creative&&(!filter.source||o.source===filter.source)){const a=ad(o.creative);a.sales++;a.revenuePence+=o.amountPence;}
  for(const s of spendRows)if(s.creative!=='all')ad(s.creative).spendPence+=s.pence;
  for(const v of scope)tally(creative,v.creative);

  const scopedOrders=filtered?orders.filter(o=>matches(o)):orders;
  const sales=scopedOrders.filter(o=>o.paymentStatus==='paid'&&!o.ownerTest);
  const spendPence=spendRows.filter(s=>filter.creative?s.creative===filter.creative:!filter.source||filter.source==='meta').reduce((n,s)=>n+s.pence,0);
  const revenuePence=sales.reduce((n,o)=>n+o.amountPence,0);
  const previewCounts=filtered?{tried:funnel[4].visits,made:funnel[5].visits,failed:errorVisits.preview_error}:{tried:receipts.length,made:receipts.filter(r=>r.status==='succeeded').length,failed:receipts.filter(r=>r.status==='failed').length};
  const scopedContacts=filtered?contacts.filter(matches):contacts,scopedLeads=filtered?leads.filter(matches):leads;
  const headline={visits:scope.length,previewsTried:previewCounts.tried,previewsMade:previewCounts.made,previewsFailed:previewCounts.failed,
    previewEmails:scopedContacts.length,quotes:filtered?null:quotes.length,launchSignups:scopedLeads.length,booksSaved:scopedOrders.filter(o=>!o.ownerTest).length,
    sales:sales.length,revenuePence,spendPence,costPerSalePence:sales.length&&spendPence?Math.round(spendPence/sales.length):null,
    costPerVisitPence:scope.length&&spendPence?Math.round(spendPence/scope.length):null,testOrders:scopedOrders.filter(o=>o.ownerTest).length};

  const leadByVisit=new Map(leads.filter(l=>l.visit_id).map(l=>[l.visit_id,l]));
  const journeys=scope.sort((a,b)=>b.firstAt.localeCompare(a.firstAt)).slice(0,LIST_LIMIT).map(v=>{const last=furthest(v),lead=leadByVisit.get(v.id);return {
    firstAt:v.firstAt,lastAt:v.lastAt,source:v.source,medium:v.medium,campaign:v.campaign,creative:v.creative,country:v.country,device:v.device,
    furthest:last[1],furthestIndex:FUNNEL.indexOf(last),steps:FUNNEL.filter(([s])=>reached(v,s)).map(([s])=>s),
    errors:Object.keys(ERRORS).filter(k=>v.events.has(k)).map(k=>ERRORS[k]),extras:['story_generated','story_edited'].filter(k=>v.events.has(k)),
    signup:lead?{email:lead.email,product:lead.product}:null};});

  const previewsByEmail=new Map();for(const r of receipts)if(r.email)tally(previewsByEmail,r.email);
  const contactByEmail=new Map(contacts.map(c=>[c.email,c]));
  const ordersByEmail=new Map();for(const o of orders)if(!ordersByEmail.has(o.email))ordersByEmail.set(o.email,o);
  const limit=Number(env.PREVIEW_DAILY_LIMIT||50);
  const errors=[
    ...events.filter(e=>ERRORS[e.event]&&(!filtered||matches(e))).map(e=>({at:e.created_at,kind:ERRORS[e.event],detail:[e.creative!=='none'?'Ad '+e.creative:'Not from an ad',e.country].join(', ')})),
    ...(filtered?[]:receipts.filter(r=>r.status==='failed'||(r.status==='started'&&Date.parse(r.created_at)<Date.now()-600000)).map(r=>({at:r.created_at,kind:r.status==='failed'?'Drawing service refused or failed':'Preview never finished',detail:r.email||'No email given'}))),
    ...(filtered?[]:usage.filter(u=>u.attempts>=limit).map(u=>({at:ukMidnight(u.day),kind:'Daily free preview limit reached',detail:`${u.attempts} of ${limit} previews used on ${u.day}`}))),
  ].sort((a,b)=>b.at.localeCompare(a.at));

  return {
    range:{from,to},filter,zone:ZONE,generatedAt:new Date().toISOString(),
    options:{sources:[...new Set(options.map(o=>o.source))].sort(),creatives:[...new Set(options.map(o=>o.creative))].filter(c=>c!=='all').sort()},
    headline,funnel,errorVisits,
    traffic:{byDay:[...byDay.values()],byHour:[...byHour].map(([hour,visits])=>({hour,visits})),source:sorted(source),campaign:sorted(campaign),creative:sorted(creative),country:sorted(country),device:sorted(device)},
    ads:[...ads.values()].sort((a,b)=>b.visits-a.visits||a.creative.localeCompare(b.creative)),
    journeys,journeyTotal:scope.length,
    previews:receipts.slice(0,LIST_LIMIT).map(r=>{const c=r.email&&contactByEmail.get(r.email),o=r.email&&ordersByEmail.get(r.email);return {at:r.created_at,status:r.status,email:r.email||null,creative:c?.creative||null,country:c?.country||null,triesByEmail:r.email?previewsByEmail.get(r.email):null,savedBook:o?o.title||'Saved':null};}),
    previewTotal:receipts.length,
    orders:scopedOrders.slice(0,LIST_LIMIT).map(({visitId,...o})=>o),
    contacts:scopedContacts.slice(0,LIST_LIMIT).map(c=>({email:c.email,source:c.source,creative:c.creative,country:c.country,at:c.created_at,previews:previewsByEmail.get(c.email)||0,savedBook:ordersByEmail.get(c.email)?.title||null})),
    quotes:quotes.slice(0,LIST_LIMIT).map(x=>({email:x.email,size:x.size,pricePence:x.price_pence,firstAt:x.first_shown_at,lastAt:x.last_shown_at,offerConsent:!!x.offer_consent_at,offerEmail:x.email_status||null,bought:!!x.redeemed_order_id||orders.some(o=>o.email===x.email&&o.paymentStatus==='paid')})),
    launchSignups:scopedLeads.slice(0,LIST_LIMIT).map(l=>({email:l.email,product:l.product,pricePence:l.price_pence,source:l.source,creative:l.creative,country:l.country,at:l.created_at,unsubscribed:!!l.unsubscribed_at,linkedVisit:!!l.visit_id})),
    colouringSignups:signups.slice(0,LIST_LIMIT).map(s=>({email:s.email,interest:s.interest,page:s.page,at:s.created_at})),
    errors:errors.slice(0,LIST_LIMIT),
    spend:spendRows,
    notes:[
      'Journeys, funnel and traffic count only visitors who pressed Accept all or Site only. Rejected visitors are invisible here.',
      'Steps a visitor reached before choosing on the cookie banner are timed at the moment they chose.',
      'No IP addresses, names, emails or story text are stored with journeys. Country comes from Cloudflare.',
      'Builder pages for reading level, description, story feel, email and delivery address are not measured.',
      'Preview totals without an ad filter count every drawing request on the site, including retries and people who declined measurement.',
    ],
  };
}

export async function analyticsApi(req,env){
  const url=new URL(req.url),path=url.pathname;
  if(path!=='/api/owner-analytics'&&path!=='/api/owner-analytics/spend')return null;
  if(!env.DB)return reply({error:'Analytics storage is unavailable.'},503);
  if(!await ownerSession(req,env))return reply({error:'Sign in with an email link sent to the owner.'},401);
  try{
    if(path==='/api/owner-analytics'){
      if(req.method!=='GET')return reply({error:'Method not allowed.'},405);
      return reply(await buildReport(env,url));
    }
    if(req.method!=='POST')return reply({error:'Method not allowed.'},405);
    if(!sameOrigin(req))return reply({error:'Reload the page and try again.'},403);
    let input;try{const raw=await req.text();if(raw.length>2048)throw Error('Too large');input=JSON.parse(raw);}catch{return reply({error:'Check the spend form and try again.'},400);}
    const day=input?.day,creative=input?.creative==='all'?'all':code(input?.creative),pence=Math.round(Number(input?.pounds)*100);
    if(!isDay(day)||!creative||!Number.isFinite(pence)||pence<0||pence>10000000)return reply({error:'Enter a date, an ad and an amount in pounds.'},400);
    await env.DB.prepare(SPEND_TABLE).run();
    if(pence===0)await env.DB.prepare('DELETE FROM owner_ad_spend WHERE day=?1 AND creative=?2').bind(day,creative).run();
    else await env.DB.prepare('INSERT INTO owner_ad_spend (day, creative, pence, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(day, creative) DO UPDATE SET pence=excluded.pence, updated_at=excluded.updated_at').bind(day,creative,pence,new Date().toISOString()).run();
    return reply({ok:true,day,creative,pence});
  }catch(error){console.error('Owner analytics failed',error?.name||'Error');return reply({error:'Analytics could not be loaded just now.'},500);}
}
