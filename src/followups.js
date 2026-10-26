import {template1 as firstHtml,template2 as firstText,template3 as secondHtml,template4 as secondText} from './followup-templates.generated.js';
import {PRODUCTS} from './catalog.js';

export const FOLLOWUP_CONSENT = 'Email me up to two follow-up emails about my book if I do not buy. The second may include an offer. I can unsubscribe at any time.';
const DAY = 86400000;
const TABLE = `CREATE TABLE IF NOT EXISTS followup_sequences (
  email TEXT PRIMARY KEY, episode_id TEXT NOT NULL, consent_text TEXT NOT NULL, consent_at TEXT,
  first_status TEXT, first_sent_at TEXT, first_provider_id TEXT,
  second_status TEXT, second_sent_at TEXT, second_provider_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
)`;
const db=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
const now=()=>new Date().toISOString();

export async function ensureFollowupTable(env){await env.DB.prepare(TABLE).run();}

export async function recordFollowupConsent(env,email,choice){
  if(choice==='unchanged')return;
  await ensureFollowupTable(env);
  if(choice==='no'){
    await db(env,'UPDATE followup_sequences SET consent_at=NULL,updated_at=?1 WHERE email=?2',now(),email).run();
    return;
  }
  const stamp=now();
  await db(env,`INSERT INTO followup_sequences (email,episode_id,consent_text,consent_at,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?4,?4)
    ON CONFLICT(email) DO UPDATE SET consent_text=excluded.consent_text,consent_at=excluded.consent_at,updated_at=excluded.updated_at`,
    email,crypto.randomUUID(),FOLLOWUP_CONSENT,stamp).run();
}

export async function unsubscribeFollowup(env,token){
  await ensureFollowupTable(env);
  const quote=await db(env,'SELECT email FROM customer_quotes WHERE unsubscribe_token=?1',token).first();
  if(!quote)return false;
  const stamp=now();
  await db(env,'UPDATE customer_quotes SET offer_consent_at=NULL,offer_unsubscribed_at=?1 WHERE email=?2',stamp,quote.email).run();
  await db(env,'UPDATE followup_sequences SET consent_at=NULL,updated_at=?1 WHERE email=?2',stamp,quote.email).run();
  return true;
}

const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(template,bindings,html=false){
  let result=template;
  for(const [key,value] of Object.entries(bindings))result=result.replaceAll(`{{${key}}}`,html?escapeHtml(value):String(value));
  if(html)result=result.replaceAll('src="craven-quill-gold-logo.png"','src="https://cravenandquill.com/assets/craven-quill-gold-logo.png"');
  return result;
}
function message(step,quote,code,expiry){
  const unsub=`https://cravenandquill.com/offer-unsubscribe.html?token=${encodeURIComponent(quote.unsubscribe_token)}`;
  const bindings={continue_url:`https://cravenandquill.com/create.html${code?`?offer=${encodeURIComponent(code)}`:''}`,unsubscribe_url:unsub};
  if(step===2){
    const date=new Date(expiry);
    bindings.discount_code=code;
    bindings.expiry_date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'}).format(date);
    bindings.expiry_time=new Intl.DateTimeFormat('en-GB',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Europe/London'}).format(date);
  }
  const source=step===1?{html:firstHtml,text:firstText,subject:'Their story is still yours to make'}:{html:secondHtml,text:secondText,subject:'A little extra for their story: 10% off'};
  return {subject:source.subject,html:render(source.html,bindings,true),text:render(source.text.split('\n\n').slice(1).join('\n\n'),bindings)};
}
async function canSend(env,email){
  const row=await db(env,`SELECT q.email,q.size,q.unsubscribe_token,q.offer_consent_at,q.offer_unsubscribed_at,q.email_status,f.episode_id,f.consent_at,f.first_status,f.first_sent_at,f.second_status
    FROM customer_quotes q JOIN followup_sequences f ON f.email=q.email WHERE q.email=?1`,email).first();
  if(!row?.consent_at||!row.offer_consent_at||row.offer_unsubscribed_at)return null;
  const order=await db(env,`SELECT id FROM customer_orders WHERE email=?1 AND (payment_status='paid' OR status IN ('awaiting_payment','checkout_pending')) LIMIT 1`,email).first();
  return order?null:row;
}
async function send(env,step,quote){
  const field=step===1?'first':'second';
  const claimed=await db(env,`UPDATE followup_sequences SET ${field}_status='sending',updated_at=?1 WHERE email=?2 AND consent_at IS NOT NULL AND ${field}_status IS NULL RETURNING episode_id`,now(),quote.email).first();
  if(!claimed)return 'skipped';
  const fresh=await canSend(env,quote.email);
  if(!fresh||(step===1&&fresh.email_status)){await db(env,`UPDATE followup_sequences SET ${field}_status='suppressed',updated_at=?1 WHERE email=?2 AND ${field}_status='sending'`,now(),quote.email).run();return 'suppressed';}
  let code=null,expiry=null;
  if(step===2){
    if(fresh.email_status){await db(env,"UPDATE followup_sequences SET second_status='suppressed',updated_at=?1 WHERE email=?2",now(),quote.email).run();return 'suppressed';}
    code='CQ'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();
    expiry=new Date(Date.now()+7*DAY).toISOString();
    const discount=Math.round(PRODUCTS[fresh.size].pricePence*0.1);
    const reserved=await db(env,`UPDATE customer_quotes SET discount_code=?1,discount_pence=?2,code_expires_at=?3,email_status='sending'
      WHERE email=?4 AND email_status IS NULL AND offer_consent_at IS NOT NULL AND offer_unsubscribed_at IS NULL RETURNING email`,code,discount,expiry,quote.email).first();
    if(!reserved){await db(env,"UPDATE followup_sequences SET second_status='suppressed',updated_at=?1 WHERE email=?2",now(),quote.email).run();return 'suppressed';}
  }
  const mail=message(step,fresh,code,expiry);
  const oneClick=`https://cravenandquill.com/api/orders/offer-one-click?token=${encodeURIComponent(fresh.unsubscribe_token)}`;
  let accepted=false,providerId=null;
  try{
    const response=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`cq-followup-${field}-${claimed.episode_id}`},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,reply_to:env.ORDER_EMAIL_REPLY_TO||'cravenluke@gmail.com',to:[quote.email],subject:mail.subject,html:mail.html,text:mail.text,headers:{'List-Unsubscribe':`<${oneClick}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();accepted=!!(response.ok&&data.id);providerId=accepted?data.id:null;
  }catch{/* An uncertain send is held for owner reconciliation, never retried automatically. */}
  const status=accepted?'accepted':'unknown',stamp=now();
  await db(env,`UPDATE followup_sequences SET ${field}_status=?1,${field}_sent_at=?2,${field}_provider_id=?3,updated_at=?4 WHERE email=?5 AND ${field}_status='sending'`,status,accepted?stamp:null,providerId,stamp,quote.email).run();
  if(step===2)await db(env,'UPDATE customer_quotes SET email_status=?1,email_sent_at=?2,email_provider_id=?3 WHERE email=?4 AND email_status=\'sending\'',status,accepted?stamp:null,providerId,quote.email).run();
  return status;
}

export async function followupStatus(env){
  await ensureFollowupTable(env);
  const row=await env.DB.prepare(`SELECT COUNT(*) AS enrolled,SUM(CASE WHEN first_status='accepted' THEN 1 ELSE 0 END) AS first_sent,
    SUM(CASE WHEN second_status='accepted' THEN 1 ELSE 0 END) AS second_sent,
    SUM(CASE WHEN first_status IN ('sending','unknown') OR second_status IN ('sending','unknown') THEN 1 ELSE 0 END) AS needs_review
    FROM followup_sequences`).first();
  return {enabled:env.FOLLOWUP_EMAILS_ENABLED==='true',enrolled:row.enrolled||0,firstSent:row.first_sent||0,secondSent:row.second_sent||0,needsReview:row.needs_review||0};
}

export async function runFollowups(env){
  if(env.FOLLOWUP_EMAILS_ENABLED!=='true')return {paused:true};
  if(!env.DB||!env.RESEND_API_KEY||!env.ORDER_EMAIL_FROM)return {error:'Email or storage is not configured.'};
  await ensureFollowupTable(env);
  const cutoffFirst=new Date(Date.now()-DAY).toISOString(),cutoffSecond=new Date(Date.now()-3*DAY).toISOString();
  const first=(await db(env,`SELECT f.email FROM followup_sequences f JOIN customer_quotes q ON q.email=f.email
    WHERE f.consent_at IS NOT NULL AND f.first_status IS NULL AND q.offer_consent_at IS NOT NULL AND q.offer_unsubscribed_at IS NULL
    AND q.email_status IS NULL AND q.last_shown_at<=?1 AND NOT EXISTS
    (SELECT 1 FROM customer_orders o WHERE o.email=f.email AND (o.payment_status='paid' OR o.status IN ('awaiting_payment','checkout_pending')))
    ORDER BY q.last_shown_at LIMIT 20`,cutoffFirst).all()).results||[];
  const results={first:{accepted:0,unknown:0,suppressed:0},second:{accepted:0,unknown:0,suppressed:0}};
  for(const row of first){const outcome=await send(env,1,row);if(outcome in results.first)results.first[outcome]++;}
  const second=(await db(env,`SELECT f.email FROM followup_sequences f JOIN customer_quotes q ON q.email=f.email
    WHERE f.consent_at IS NOT NULL AND f.first_status='accepted' AND f.first_sent_at<=?1 AND f.second_status IS NULL
    AND q.offer_consent_at IS NOT NULL AND q.offer_unsubscribed_at IS NULL AND q.email_status IS NULL
    AND NOT EXISTS (SELECT 1 FROM customer_orders o WHERE o.email=f.email AND (o.payment_status='paid' OR o.status IN ('awaiting_payment','checkout_pending')))
    ORDER BY f.first_sent_at LIMIT 20`,cutoffSecond).all()).results||[];
  for(const row of second){const outcome=await send(env,2,row);if(outcome in results.second)results.second[outcome]++;}
  return results;
}
