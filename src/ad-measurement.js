// Only consented, server-confirmed business events can become advertising conversions.
export const AD_CONSENT_VERSION='ads-2026-11-06';
const click=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,500}$/.test(v)?v:null;
export function adConsent(m){
 if(m?.advertisingConsent!==true||m?.advertisingConsentVersion!==AD_CONSENT_VERSION)return null;
 return {version:AD_CONSENT_VERSION,at:new Date().toISOString(),gclid:click(m.gclid),gbraid:click(m.gbraid),wbraid:click(m.wbraid),fbclid:click(m.fbclid)};
}
export function internalTraffic(email,m={},env={}){
 const e=String(email||'').toLowerCase();
 return e==='cravenluke@gmail.com'||e===String(env.ORDERS_ADMIN_EMAIL||'').toLowerCase()||e.endsWith('@breeztechnologies.com')||/@(?:example\.(?:com|test)|mailinator\.com)$/.test(e)||/^qa(?:[_.-]|$)/.test(m.campaign||'')||m.campaign==='tracking_test'||m.source==='qa';
}
export function adConfig(env){
 const tag=/^AW-\d{5,20}$/.test(env.GOOGLE_ADS_TAG_ID||'')?env.GOOGLE_ADS_TAG_ID:null;
 const label=v=>tag&&/^[A-Za-z0-9_-]{5,100}$/.test(v||'')?tag+'/'+v:null;
 return {tagId:tag,purchase:label(env.GOOGLE_ADS_PURCHASE_LABEL),lead:label(env.GOOGLE_ADS_LEAD_LABEL)};
}
export function purchaseConversion(o,env){
 const d=o.data||JSON.parse(o.state||'{}'),m=d.measurement||{},ads=m.ads;
 if(o.payment_status!=='paid'||o.payment_mode!=='live'||d.discount?.ownerTest||internalTraffic(o.email,m,env)||ads?.version!==AD_CONSENT_VERSION||ads.revokedAt||!d.paidAt)return null;
 if(!Number.isSafeInteger(o.amount)||o.amount<=0)return null;
 return {eventId:o.id,at:d.paidAt,value:d.refund?.status==='completed'?0:o.amount/100,currency:'GBP',gclid:click(ads.gclid),gbraid:click(ads.gbraid),wbraid:click(ads.wbraid)};
}
// Meta purchase report, sent from the server so it survives closed tabs and blocked scripts. It needs the
// same explicit advertising consent as the Google feed, and it only carries what the banner promised:
// the ad click reference, the order total and the country. Never an email, name, photo or story.
export function metaConfig(env){return /^[0-9]{5,30}$/.test(env.META_PIXEL_ID||'')&&typeof env.META_CAPI_TOKEN==='string'&&env.META_CAPI_TOKEN.length>=20?{pixelId:env.META_PIXEL_ID,token:env.META_CAPI_TOKEN}:null;}
export function metaPurchase(o,env){
 const c=purchaseConversion(o,env);if(!c)return null;
 const d=o.data||JSON.parse(o.state||'{}'),fbclid=click(d.measurement?.ads?.fbclid);if(!fbclid)return null;
 const at=Math.floor(Date.parse(c.at)/1000),clickAt=Math.floor(Date.parse(d.measurement.ads.at||c.at)/1000)*1000;
 return {event_name:'Purchase',event_time:at,event_id:o.id,action_source:'website',event_source_url:'https://cravenandquill.com/order.html',
  user_data:{fbc:`fb.1.${clickAt}.${fbclid}`,country:['0b407281768f0e833afef47ed464b6571d01ca4d53c12ce5c51d1462f4ad6677']},
  custom_data:{currency:'GBP',value:c.value,order_id:o.id,content_type:'product',content_ids:[o.size||'book'],num_items:1}};
}
export async function sendMetaPurchase(env,o){
 const config=metaConfig(env);if(!config)return {status:'skipped',reason:'not_configured'};
 const event=metaPurchase(o,env);if(!event)return {status:'skipped',reason:'no_consented_meta_click'};
 const r=await (env.fetch||fetch)(`https://graph.facebook.com/v21.0/${config.pixelId}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:[event],access_token:config.token}),signal:AbortSignal.timeout(15000)});
 let body=null;try{body=await r.json();}catch{}
 if(!r.ok||!body?.events_received)return {status:'failed',reason:'http_'+r.status};
 return {status:'sent',received:body.events_received};
}
export async function leadConversion(env,email,input){
 const ads=adConsent(input);if(!ads||internalTraffic(email,input,env)||!env.ORDER_LINK_SECRET)return null;
 // HMAC is an opaque, stable receipt, never a plain or reversibly encoded email.
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ORDER_LINK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const id=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('preview-lead:'+email))),b=>b.toString(16).padStart(2,'0')).join('');
 await env.DB.prepare('INSERT INTO ad_leads (id,visit_id,created_at,consent_version,gclid,gbraid,wbraid) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO NOTHING').bind(id,input.visitId||null,ads.at,ads.version,ads.gclid,ads.gbraid,ads.wbraid).run();
 const row=await env.DB.prepare('SELECT revoked_at FROM ad_leads WHERE id=?1').bind(id).first();
 return row?.revoked_at?null:{eventId:id,value:0,currency:'GBP'};
}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
async function secureEqual(a,b){const hash=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
export async function adFeed(request,env){
 const path=new URL(request.url).pathname;
 if(!['/api/ads/purchases.csv','/api/ads/leads.csv'].includes(path))return null;
 if(!env.GOOGLE_ADS_FEED_PASSWORD||env.GOOGLE_ADS_FEED_PASSWORD.length<32)return new Response('Not found',{status:404,headers});
 const expected='Basic '+btoa('google-ads:'+env.GOOGLE_ADS_FEED_PASSWORD);
 if(!await secureEqual(request.headers.get('Authorization')||'',expected))return new Response('Unauthorized',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Advertising reports"'}});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers});
 const cutoff=new Date(Date.now()-90*86400000).toISOString();let conversions;
 if(path.endsWith('purchases.csv')){
  const rows=(await env.DB.prepare("SELECT id,email,amount,payment_status,payment_mode,state FROM customer_orders WHERE payment_status='paid' AND payment_mode='live' AND json_extract(state,'$.paidAt')>=?1").bind(cutoff).all()).results||[];
  conversions=rows.map(o=>purchaseConversion(o,env)).filter(Boolean);
 }else{
  conversions=((await env.DB.prepare('SELECT id,created_at,gclid,gbraid,wbraid FROM ad_leads WHERE created_at>=?1 AND revoked_at IS NULL AND consent_version=?2').bind(cutoff,AD_CONSENT_VERSION).all()).results||[]).map(x=>({eventId:x.id,at:x.created_at,value:0,currency:'GBP',gclid:x.gclid,gbraid:x.gbraid,wbraid:x.wbraid}));
 }
 const columns=['transaction_id','conversion_date_time','value','currency','gclid','gbraid','wbraid','ad_user_data','ad_personalization','record_type'];
 const rows=conversions.filter(x=>x.gclid||x.gbraid||x.wbraid).map(x=>[x.eventId,x.at,x.value.toFixed(2),'GBP',x.gclid||'',x.gbraid||'',x.wbraid||'','GRANTED','DENIED','conversion']);
 // Google cannot infer a schema from an empty CSV. This is metadata, never an event:
 // no ad identifier, no consent, zero value and an ancient date. Data Manager MUST
 // filter record_type = conversion before importing. Never invent an ad click.
 const schema=['cq_feed_schema_v1','1970-01-01T00:00:00Z','0.00','GBP','','','','DENIED','DENIED','schema'];
 const cell=x=>'"'+String(x).replaceAll('"','""')+'"';
 // Fetching a report is not an acknowledgement that Google accepted its rows.
 console.info('Advertising feed served',path,rows.length);
 return new Response([columns.join(','),schema.map(cell).join(','),...rows.map(row=>row.map(cell).join(','))].join('\n')+'\n',{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}});
}
