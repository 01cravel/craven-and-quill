export const CONSENT_VERSION='storybook-validation-2026-09-29';
export const CONSENT_TEXT='Email me when Craven & Quill storybooks are ready to order. I can unsubscribe at any time.';
const PRODUCTS={digital:1900,hardback:3500,bundle:4999};
const EVENTS=new Set(['landing_view','maker_start','preview_start','preview_success','preview_error','price_view']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const code=(value,fallback='')=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(value)?value:fallback;
const attribution=input=>[code(input.source,'direct'),code(input.medium,'none'),code(input.campaign,'organic'),code(input.creative,'none')];
const country=request=>code(request.headers.get('CF-IPCountry'),'unknown');
function authorized(request,env){const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');return Boolean(env.SIGNUPS_EXPORT_TOKEN&&token===env.SIGNUPS_EXPORT_TOKEN);}
async function body(request){if(Number(request.headers.get('Content-Length')||0)>4096)throw new Error('Too much data.');const raw=await request.text();if(raw.length>4096)throw new Error('Too much data.');return JSON.parse(raw);}

// A durable daily ceiling bounds drawing-service usage across Worker instances.
export async function beginPreview(env){
  if(!env.DB)throw new Error('Previews are temporarily unavailable. Please try again later.');
  const day=new Date().toISOString().slice(0,10);
  const configured=Number(env.PREVIEW_DAILY_LIMIT||50);const limit=Number.isInteger(configured)&&configured>0?Math.min(configured,500):50;
  const claim=await env.DB.prepare('INSERT INTO preview_daily_usage (day, attempts) VALUES (?1, 1) ON CONFLICT(day) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ?2 RETURNING attempts').bind(day,limit).first();
  if(!claim)throw new Error('Today’s free previews have been used. Please come back tomorrow.');
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO preview_receipts (id, status, created_at) VALUES (?1, ?2, ?3)').bind(id,'started',new Date().toISOString()).run();
  return id;
}
export async function finishPreview(env,id,status){await env.DB.prepare('UPDATE preview_receipts SET status = ?1 WHERE id = ?2').bind(status,id).run();}

export async function campaignApi(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/ad-config')return request.method==='GET'?reply({pixelId:/^[0-9]{5,30}$/.test(env.META_PIXEL_ID||'')?env.META_PIXEL_ID:null}):reply({error:'Method not allowed.'},405);
  if(!['/api/preview-email','/api/preview-emails.csv','/api/launch-signup','/api/campaign-event','/api/campaign-report','/api/launch-signups.csv','/api/unsubscribe'].includes(path))return null;
  const report=path==='/api/campaign-report'||path==='/api/launch-signups.csv'||path==='/api/preview-emails.csv';
  if(request.method!==(report?'GET':'POST'))return reply({error:'Method not allowed.'},405);
  if(report&&!authorized(request,env))return reply({error:'Not found.'},404);
  const origin=request.headers.get('Origin');if(!report&&origin!==new URL(request.url).origin)return reply({error:'Please reload the page and try again.'},403);
  if(!env.DB)return reply({error:'We could not save that just now. Please try again.'},503);
  try{
    if(path==='/api/campaign-report'){
      const params=new URL(request.url).searchParams;
      const since=params.get('since')||new Date(Date.now()-7*86400000).toISOString();
      const until=params.get('until')||new Date(Date.now()+1).toISOString();
      const campaign=code(params.get('campaign'),'cq_uk_validation_2026');
      if(!Number.isFinite(Date.parse(since))||!Number.isFinite(Date.parse(until))||Date.parse(until)<=Date.parse(since))return reply({error:'Choose a valid date range.'},400);
      const data=await env.DB.batch([
        env.DB.prepare('SELECT source, medium, campaign, creative, country, COUNT(*) AS signups, SUM(CASE WHEN unsubscribed_at IS NULL THEN 1 ELSE 0 END) AS active_signups, SUM(CASE WHEN purchase_intent=1 AND unsubscribed_at IS NULL THEN 1 ELSE 0 END) AS qualified_signups FROM launch_leads WHERE created_at >= ?1 AND created_at < ?2 AND campaign=?3 GROUP BY source, medium, campaign, creative, country').bind(since,until,campaign),
        env.DB.prepare('SELECT source, medium, campaign, creative, country, event, COUNT(DISTINCT visit_id) AS visits FROM campaign_events WHERE created_at >= ?1 AND created_at < ?2 AND campaign=?3 GROUP BY source, medium, campaign, creative, country, event').bind(since,until,campaign),
        env.DB.prepare('SELECT status, COUNT(*) AS attempts FROM preview_receipts WHERE created_at >= ?1 AND created_at < ?2 GROUP BY status').bind(since,until),
        env.DB.prepare("SELECT product, price_pence, COUNT(*) AS signups FROM launch_leads WHERE created_at >= ?1 AND created_at < ?2 AND campaign=?3 AND source='meta' AND medium='paid_social' AND country='GB' AND purchase_intent=1 AND unsubscribed_at IS NULL GROUP BY product,price_pence").bind(since,until,campaign),
        env.DB.prepare("SELECT COUNT(DISTINCT e.visit_id) AS visitors, COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM launch_leads l WHERE l.visit_id=e.visit_id AND l.created_at >= ?1 AND l.created_at < ?2 AND l.source='meta' AND l.medium='paid_social' AND l.campaign=?3 AND l.country='GB' AND l.purchase_intent=1 AND l.unsubscribed_at IS NULL) THEN e.visit_id END) AS converted_visitors FROM campaign_events e WHERE e.created_at >= ?1 AND e.created_at < ?2 AND e.source='meta' AND e.medium='paid_social' AND e.campaign=?3 AND e.country='GB' AND e.event='landing_view'").bind(since,until,campaign),
        env.DB.prepare('SELECT source, medium, campaign, creative, country, COUNT(*) AS contacts FROM preview_contacts WHERE created_at >= ?1 AND created_at < ?2 AND campaign=?3 GROUP BY source, medium, campaign, creative, country').bind(since,until,campaign),
      ]);
      return reply({since,until,campaign,previewContacts:data[5].results||[],leads:data[0].results||[],events:data[1].results||[],previews:data[2].results||[],products:data[3].results||[],measuredConversion:data[4].results?.[0]||{visitors:0,converted_visitors:0},note:'Preview contacts are saved when a preview is requested, not marketing subscribers or buying intent. Qualified signups are unique active emails with a successful preview and explicit interest at the chosen price. Emails are not verified; these are not orders. Visit conversion covers only people allowing measurement. Drawing requests are site-wide, including organic traffic and retries. QA uses a separate campaign code and is excluded from this campaign.'});
    }
    if(path==='/api/preview-emails.csv'){
      const rows=(await env.DB.prepare('SELECT email, source, medium, campaign, creative, country, created_at, updated_at FROM preview_contacts ORDER BY created_at').all()).results||[];
      const columns=['email','source','medium','campaign','creative','country','created_at','updated_at','marketing_permission'];
      const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
      const csv=[columns.join(','),...rows.map(row=>columns.map(key=>cell(key==='marketing_permission'?'not_granted':row[key])).join(','))].join('\n')+'\n';
      return new Response(csv,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="preview-contacts-not-marketing.csv"','Cache-Control':'private, no-store'}});
    }
    if(path==='/api/launch-signups.csv'){
      const rows=(await env.DB.prepare('SELECT email, product, price_pence, purchase_intent, source, medium, campaign, creative, country, consent_version, consent_text, consent_at, created_at, unsubscribe_token FROM launch_leads WHERE unsubscribed_at IS NULL ORDER BY created_at').all()).results||[];
      const columns=['email','product','price_pence','purchase_intent','source','medium','campaign','creative','country','consent_version','consent_text','consent_at','created_at','unsubscribe_url'];
      const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
      const csv=[columns.join(','),...rows.map(row=>columns.map(key=>cell(key==='unsubscribe_url'?`https://cravenandquill.com/unsubscribe?token=${row.unsubscribe_token}`:row[key])).join(','))].join('\n')+'\n';
      return new Response(csv,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="storybook-launch-signups.csv"','Cache-Control':'private, no-store'}});
    }
    let input;try{input=await body(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid form');}catch{return reply({error:'Please check the form and try again.'},400);}
    if(path==='/api/campaign-event'){
      if(input.measurementConsent!==true||!UUID.test(input.visitId)||!EVENTS.has(input.event))return reply({error:'Invalid measurement.'},400);
      const result=await env.DB.prepare('INSERT INTO campaign_events (id, visit_id, event, source, medium, campaign, creative, country, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(id) DO NOTHING').bind(`${input.visitId}:${input.event}`,input.visitId,input.event,...attribution(input),country(request),new Date().toISOString()).run();
      if(result.success===false)throw new Error('Event write failed');
      return reply({ok:true});
    }
    if(path==='/api/unsubscribe'){
      if(!UUID.test(input.token))return reply({error:'This unsubscribe link is invalid.'},400);
      await env.DB.prepare('UPDATE launch_leads SET unsubscribed_at = ?1 WHERE unsubscribe_token = ?2 AND unsubscribed_at IS NULL').bind(new Date().toISOString(),input.token).run();
      return reply({ok:true});
    }
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    if(input.website)return reply({error:'Please try again.'},400);
    if(email.length>254||!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email))return reply({error:'Enter a valid email address.'},400);
    if(path==='/api/preview-email'){
      const now=new Date().toISOString();
      const result=await env.DB.prepare('INSERT INTO preview_contacts (email, source, medium, campaign, creative, country, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(email) DO UPDATE SET updated_at=excluded.updated_at').bind(email,...attribution(input.measurementConsent===true?input:{}),country(request),now).run();
      if(result.success===false)throw new Error('Preview email write failed');
      return reply({ok:true});
    }
    if(input.consent!==true||input.consentVersion!==CONSENT_VERSION)return reply({error:'Please tick the email permission box to join the launch list.'},400);
    if(input.purchaseIntent!==true)return reply({error:'Confirm your interest at the displayed price to join this list.'},400);
    if(!Object.hasOwn(PRODUCTS,input.product))return reply({error:'Choose a book format.'},400);
    if(!UUID.test(input.previewId))return reply({error:'Create a free preview before joining this list.'},400);
    const receipt=await env.DB.prepare('SELECT status, created_at FROM preview_receipts WHERE id = ?1').bind(input.previewId).first();
    if(!receipt||receipt.status!=='succeeded'||Date.now()-Date.parse(receipt.created_at)>86400000)return reply({error:'Your preview has expired. Create another free preview to join.'},400);
    const now=new Date().toISOString();const token=crypto.randomUUID();
    const conversionId=crypto.randomUUID();
    const result=await env.DB.prepare('INSERT INTO launch_leads (email, product, price_pence, consent_version, consent_text, consent_at, source, medium, campaign, creative, visit_id, preview_id, country, unsubscribe_token, created_at, purchase_intent, conversion_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 1, ?16) ON CONFLICT(email) DO UPDATE SET product=excluded.product, price_pence=excluded.price_pence, consent_version=excluded.consent_version, consent_text=excluded.consent_text, consent_at=excluded.consent_at, purchase_intent=1, unsubscribed_at=NULL WHERE launch_leads.unsubscribed_at IS NOT NULL').bind(email,input.product,PRODUCTS[input.product],CONSENT_VERSION,CONSENT_TEXT,now,...attribution(input),input.measurementConsent===true&&UUID.test(input.visitId)?input.visitId:null,input.previewId,country(request),token,now,conversionId).run();
    if(result.success===false)throw new Error('Lead write failed');
    // Same response for duplicate emails avoids exposing who is already subscribed.
    const saved=await env.DB.prepare('SELECT conversion_id FROM launch_leads WHERE email=?1').bind(email).first();
    return reply({ok:true,eventId:saved?.conversion_id||null});
  }catch(error){console.error('Campaign operation failed',path,error?.name||'Error');return reply({error:'We could not save that just now. Please try again.'},503);}
}
