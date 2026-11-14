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
  if(choice!=='yes'&&choice!=='no')return;
  await ensureFollowupTable(env);
  const stamp=now();
  const preference=choice==='no'
    ? db(env,'UPDATE followup_sequences SET consent_at=NULL,updated_at=?1 WHERE email=?2',stamp,email)
    : db(env,`INSERT INTO followup_sequences (email,episode_id,consent_text,consent_at,created_at,updated_at)
        VALUES (?1,?2,?3,?4,?4,?4)
        ON CONFLICT(email) DO UPDATE SET consent_text=excluded.consent_text,consent_at=excluded.consent_at,updated_at=excluded.updated_at`,
        email,crypto.randomUUID(),FOLLOWUP_CONSENT,stamp);
  await env.DB.batch([preference,db(env,`UPDATE customer_quotes SET offer_consent_at=?1,
    offer_unsubscribed_at=CASE WHEN ?1 IS NOT NULL THEN NULL ELSE offer_unsubscribed_at END WHERE email=?2`,choice==='yes'?stamp:null,email)]);
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
const LOGO='https://cravenandquill.com/assets/craven-quill-gold-logo.png',SANS='Arial,Helvetica,sans-serif',SERIF="Georgia,'Times New Roman',serif";
const poss=n=>n+(/s$/i.test(n)?'’':'’s');
function message(step,quote,code,expiry,details={}){
  const unsub=`https://cravenandquill.com/offer-unsubscribe.html?token=${encodeURIComponent(quote.unsubscribe_token)}`;
  const url=`https://cravenandquill.com/create.html${code?`?offer=${encodeURIComponent(code)}`:''}`;
  const name=String(details.names||'').trim().slice(0,60),title=String(details.title||'').trim().slice(0,120);
  const N=name||'their',Np=name?poss(name):'their',who=name||'them';
  let when='';
  if(step===2){const d=new Date(expiry);when=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/London'}).format(d);}
  const book=title?`<i style="font-family:${SERIF};">${escapeHtml(title)}</i>`:'their story';
  const c=step===1?{
    subject:name?`${Np} book is waiting`:'Their book is waiting',
    pre:'We kept everything safe. It’s one step from being real.',
    kicker:'Saved for you',heading:name?`${Np} book is waiting.`:'Their book is waiting.',
    paras:[`We drew ${escapeHtml(who)}, wrote ${book}, and saved every page just as you left it.`,
      `Picture the moment ${escapeHtml(who)} opens a real hardback and sees ${name?escapeHtml(name)+'’s':'their'} own face looking back from the page, the hero of the whole story. That’s the kind of gift a child keeps long after the toys are gone.`,
      `It’s one step from being real. We print it, post it to your door, and send you the finished proof to check first.`],
    button:name?`Finish ${Np} book`:'Finish their book',
    note:'Hardbacks from £24.99 with UK delivery. Order by 1 December for Christmas.'
  }:{
    subject:name?`10% off ${Np} book, just for you`:'10% off their book, just for you',
    pre:`Your own code, until ${when}.`,
    kicker:'A little nudge',heading:name?`Don’t let ${Np} story end here.`:'Don’t let their story end here.',
    paras:[`${name?escapeHtml(name)+'’s':'Their'} character is still drawn and ${book} is still saved, waiting for its last page.`,
      `Childhood moves fast. A book where ${escapeHtml(who)} is the hero is something they’ll pull off the shelf for years, and one day show their own children.`,
      `So here’s 10% off to help you finish it.`],
    code,button:'Finish it with 10% off',
    note:`The code is just for you and works once, until ${when}.`
  };
  const p=t=>`<p style="margin:0 0 16px;color:#3c352f;font:16px/1.65 ${SANS};">${t}</p>`;
  const codeBox=c.code?`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:6px 0 24px;background:#f5f0e6;"><tr><td align="center" style="padding:18px 20px;border:1.5px dashed #ad843f;"><p style="margin:0 0 4px;color:#846329;font:700 12px/1.4 ${SANS};">Your code</p><p style="margin:0;color:#211d1a;font:700 26px/1.2 ${SERIF};letter-spacing:2px;">${escapeHtml(c.code)}</p></td></tr></table>`:'';
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(c.subject)} | Craven &amp; Quill</title><style>@media only screen and (max-width:600px){.shell{width:100%!important}.content{padding:32px 24px 34px!important}.footer{padding:24px 24px 32px!important}.heading{font-size:31px!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:#efeae0;color:#211d1a;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:#efeae0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(c.pre)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#efeae0;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="shell" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;max-width:560px;background:#fffdfa;">
<tr><td align="center" style="padding:30px 24px 22px;border-bottom:1px solid #e9dec7;"><img src="${LOGO}" width="150" alt="Craven &amp; Quill" style="display:block;width:150px;height:auto;border:0;color:#211d1a;font:21px ${SERIF};"></td></tr>
<tr><td class="content" style="padding:40px 48px 44px;">
<p style="margin:0 0 14px;color:#846329;font:700 13px/1.5 ${SANS};">${escapeHtml(c.kicker)}</p>
<h1 class="heading" style="margin:0 0 20px;color:#211d1a;font:normal 36px/1.12 ${SERIF};letter-spacing:-.5px;">${escapeHtml(c.heading)}</h1>
${c.paras.map(p).join('')}${codeBox}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 22px;"><tr><td bgcolor="#25201b" style="border-radius:3px;"><a class="button" href="${escapeHtml(url)}" style="display:inline-block;padding:16px 26px;color:#ffffff;text-decoration:none;font:700 15px/1.2 ${SANS};">${escapeHtml(c.button)}</a></td></tr></table>
<p style="margin:0 0 6px;color:#655a50;font:14px/1.6 ${SANS};">${escapeHtml(c.note)}</p>
<p style="margin:0;color:#655a50;font:14px/1.6 ${SANS};">Questions? Just reply to this email.</p>
</td></tr>
<tr><td class="footer" style="padding:24px 48px 34px;border-top:1px solid #e9dec7;background:#faf7f0;">
<p style="margin:0 0 8px;color:#655a50;font:13px/1.55 ${SANS};">Craven &amp; Quill. Personalised books, made for one reader at a time.</p>
<p style="margin:0;color:#8a7f73;font:12px/1.55 ${SANS};">You made a free preview with us, so we’re letting you know it’s saved. <a href="${escapeHtml(unsub)}" style="color:#8a7f73;text-decoration:underline;">Stop these emails</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
  const strip=t=>t.replace(/<[^>]+>/g,'');
  const text=[c.heading,...c.paras.map(strip),c.code?`Your code: ${c.code}`:'',`${c.button}: ${url}`,c.note,'Questions? Just reply to this email.',`Stop these emails: ${unsub}`,'Craven & Quill'].filter(Boolean).join('\n\n');
  return {subject:c.subject,html,text};
}
// Child's name and book title, so every reminder is about their book.
const DETAILS='CREATE TABLE IF NOT EXISTS followup_details (email TEXT PRIMARY KEY, names TEXT, title TEXT, updated_at TEXT NOT NULL)';
export async function saveFollowupDetails(env,email,names,title){
  const n=String(names||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,60),t=String(title||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,120);
  if(!n&&!t)return;
  await env.DB.prepare(DETAILS).run();
  await db(env,'INSERT INTO followup_details (email,names,title,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(email) DO UPDATE SET names=COALESCE(NULLIF(excluded.names,\'\'),followup_details.names),title=COALESCE(NULLIF(excluded.title,\'\'),followup_details.title),updated_at=excluded.updated_at',email,n,t,now()).run();
}
async function detailsFor(env,email){
  await env.DB.prepare(DETAILS).run();
  const d=await db(env,'SELECT names,title FROM followup_details WHERE email=?1',email).first();
  if(d?.names)return d;
  const o=await db(env,'SELECT state FROM customer_orders WHERE email=?1 ORDER BY created_at DESC LIMIT 1',email).first().catch(()=>null);
  try{const s=JSON.parse(o?.state||'{}');return {names:d?.names||s.names||'',title:d?.title||s.story?.title||''};}catch{return d||{};}
}
async function canSend(env,email){
  const row=await db(env,`SELECT q.email,q.size,q.unsubscribe_token,q.offer_consent_at,q.offer_unsubscribed_at,q.email_status,f.episode_id,f.consent_at,f.first_status,f.first_sent_at,f.second_status
    FROM customer_quotes q JOIN followup_sequences f ON f.email=q.email WHERE q.email=?1 AND q.confirmed_view_at IS NOT NULL AND f.consent_text=?2`,email,FOLLOWUP_CONSENT).first();
  if(!row?.consent_at||!row.offer_consent_at||row.offer_unsubscribed_at)return null;
  const order=await db(env,`SELECT id FROM customer_orders WHERE email=?1 AND payment_status='paid' LIMIT 1`,email).first();
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
  const mail=message(step,fresh,code,expiry,await detailsFor(env,quote.email));
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
  const row=await env.DB.prepare(`SELECT COUNT(CASE WHEN consent_at IS NOT NULL AND consent_text=?1 THEN 1 END) AS enrolled,SUM(CASE WHEN first_status='accepted' THEN 1 ELSE 0 END) AS first_sent,
    SUM(CASE WHEN second_status='accepted' THEN 1 ELSE 0 END) AS second_sent,
    SUM(CASE WHEN first_status IN ('sending','unknown') OR second_status IN ('sending','unknown') THEN 1 ELSE 0 END) AS needs_review
    FROM followup_sequences`).bind(FOLLOWUP_CONSENT).first();
  return {enabled:env.FOLLOWUP_EMAILS_ENABLED==='true',enrolled:row.enrolled||0,firstSent:row.first_sent||0,secondSent:row.second_sent||0,needsReview:row.needs_review||0};
}

export async function runFollowups(env){
  if(env.FOLLOWUP_EMAILS_ENABLED!=='true')return {paused:true};
  if(!env.DB||!env.RESEND_API_KEY||!env.ORDER_EMAIL_FROM)return {error:'Email or storage is not configured.'};
  await ensureFollowupTable(env);
  const cutoffFirst=new Date(Date.now()-DAY).toISOString(),cutoffSecond=new Date(Date.now()-6*DAY).toISOString();
  const first=(await db(env,`SELECT f.email FROM followup_sequences f JOIN customer_quotes q ON q.email=f.email
    WHERE q.confirmed_view_at IS NOT NULL AND f.consent_text=?2 AND f.consent_at IS NOT NULL AND f.first_status IS NULL AND q.offer_consent_at IS NOT NULL AND q.offer_unsubscribed_at IS NULL
    AND q.email_status IS NULL AND q.last_shown_at<=?1 AND NOT EXISTS
    (SELECT 1 FROM customer_orders o WHERE o.email=f.email AND o.payment_status='paid')
    ORDER BY q.last_shown_at LIMIT 20`,cutoffFirst,FOLLOWUP_CONSENT).all()).results||[];
  const results={first:{accepted:0,unknown:0,suppressed:0},second:{accepted:0,unknown:0,suppressed:0}};
  for(const row of first){const outcome=await send(env,1,row);if(outcome in results.first)results.first[outcome]++;}
  const second=(await db(env,`SELECT f.email FROM followup_sequences f JOIN customer_quotes q ON q.email=f.email
    WHERE q.confirmed_view_at IS NOT NULL AND f.consent_text=?2 AND f.consent_at IS NOT NULL AND f.first_status='accepted' AND f.first_sent_at<=?1 AND f.second_status IS NULL
    AND q.offer_consent_at IS NOT NULL AND q.offer_unsubscribed_at IS NULL AND q.email_status IS NULL
    AND NOT EXISTS (SELECT 1 FROM customer_orders o WHERE o.email=f.email AND o.payment_status='paid')
    ORDER BY f.first_sent_at LIMIT 20`,cutoffSecond,FOLLOWUP_CONSENT).all()).results||[];
  for(const row of second){const outcome=await send(env,2,row);if(outcome in results.second)results.second[outcome]++;}
  return results;
}

export {message as followupMessage};
