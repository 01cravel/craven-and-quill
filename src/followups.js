import {PRODUCTS,sha} from './catalog.js';

export const FOLLOWUP_CONSENT = 'Email me up to two follow-up emails about my book if I do not buy. The second may include an offer. I can unsubscribe at any time.';
// OWNER-APPROVED (Luke, 14 Nov 2026): one-off reminders to the preview contacts from before the notice existed.
// Do not remove without asking Luke. Each email has an unsubscribe link; opt-outs and buyers are skipped.
export const PAST_CONTACTS='Gave email for a free preview before 14 Nov 2026. One-off reminders approved by the owner on 14 Nov 2026. Unsubscribe link in every email.';
export const PREVIEW_NOTICE='If you leave your book unfinished, we’ll email you up to twice about it, including a 10% offer. You can unsubscribe at any time.';
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
  const recipient=await db(env,`SELECT email FROM customer_quotes WHERE unsubscribe_token=?1 UNION SELECT email FROM followup_sequences WHERE episode_id=?1`,token).first();
  if(!recipient)return false;
  const stamp=now();
  await env.DB.batch([
    db(env,'UPDATE customer_quotes SET offer_consent_at=NULL,offer_unsubscribed_at=?1 WHERE email=?2',stamp,recipient.email),
    db(env,'UPDATE followup_sequences SET consent_at=NULL,updated_at=?1 WHERE email=?2',stamp,recipient.email)
  ]);
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
  const url=`https://cravenandquill.com/create.html?${code?`offer=${encodeURIComponent(code)}&`:''}utm_source=email&utm_medium=email&utm_campaign=reminder&utm_content=reminder_${step}`;
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
    note:'Hardbacks from £24.99 with UK delivery. Order by 14 December for Christmas.'
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
  if(step===1&&quote.consent_text===PAST_CONTACTS){
    c.pre='Turn their preview into a personalised hardback.';
    c.kicker='Your personalised book';
    c.paras[0]='You tried a Craven & Quill preview. If you’d like to make the hardback, open the book maker to continue on your original device or start a fresh story.';
  }
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
${details.image?`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:4px 0 24px;"><tr><td align="center" style="padding:14px;background:#f5f0e6;"><img src="${escapeHtml(details.image)}" width="260" alt="${escapeHtml(name?name+'’s character':'Your character')}" style="display:block;width:260px;max-width:100%;height:auto;border:0;border-radius:4px;"><p style="margin:10px 0 0;color:#846329;font:italic 14px/1.4 ${SERIF};">${escapeHtml(name?`${name}, as we drew them`:'Your character, as we drew them')}</p></td></tr></table>`:''}${c.paras.map(p).join('')}${codeBox}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 22px;"><tr><td bgcolor="#25201b" style="border-radius:3px;"><a class="button" href="${escapeHtml(url)}" style="display:inline-block;padding:16px 26px;color:#ffffff;text-decoration:none;font:700 15px/1.2 ${SANS};">${escapeHtml(c.button)}</a></td></tr></table>
<p style="margin:0 0 6px;color:#655a50;font:14px/1.6 ${SANS};">${escapeHtml(c.note)}</p>
<p style="margin:0;color:#655a50;font:14px/1.6 ${SANS};">Questions? Just reply to this email.</p>
</td></tr>
<tr><td class="footer" style="padding:24px 48px 34px;border-top:1px solid #e9dec7;background:#faf7f0;">
<p style="margin:0 0 8px;color:#655a50;font:13px/1.55 ${SANS};">Craven &amp; Quill. Personalised books, made for one reader at a time.</p>
<p style="margin:0;color:#8a7f73;font:12px/1.55 ${SANS};">You requested a free book preview from Craven &amp; Quill. </p><p style="margin:12px 0 0;"><a href="${escapeHtml(unsub)}" style="display:inline-block;padding:10px 16px;border:1px solid #8a7f73;border-radius:4px;color:#443c35;text-decoration:none;font:14px Arial,sans-serif;">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const strip=t=>t.replace(/<[^>]+>/g,'');
  const text=[c.heading,...c.paras.map(strip),c.code?`Your code: ${c.code}`:'',`${c.button}: ${url}`,c.note,'Questions? Just reply to this email.',`Stop these emails: ${unsub}`,'Craven & Quill'].filter(Boolean).join('\n\n');
  return {subject:c.subject,html,text};
}
// Child's name and book title, so every reminder is about their book.
const DETAILS='CREATE TABLE IF NOT EXISTS followup_details (email TEXT PRIMARY KEY, names TEXT, title TEXT, updated_at TEXT NOT NULL)';
export const ensureDetailsTable=env=>env.DB.prepare(DETAILS).run();
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
// This choice comes from the versioned notice on the submitted preview-and-price form.
export async function recordPreviewChoice(env,email,previewId,declined,notice=PREVIEW_NOTICE){
  await ensureFollowupTable(env);
  const receipt=await db(env,"SELECT id FROM preview_receipts WHERE id=?1 AND status='succeeded' AND email=?2",previewId,email).first();
  if(!receipt)return false;
  const stamp=now();
  await db(env,`INSERT INTO followup_sequences (email,episode_id,consent_text,consent_at,created_at,updated_at)
    SELECT ?1,?2,?3,?4,?5,?5 WHERE NOT EXISTS (SELECT 1 FROM customer_quotes WHERE email=?1 AND offer_unsubscribed_at IS NOT NULL)
    ON CONFLICT(email) DO UPDATE SET consent_at=NULL,updated_at=excluded.updated_at WHERE excluded.consent_at IS NULL`,
    email,crypto.randomUUID(),notice,declined?null:stamp,stamp).run();
  if(declined)await db(env,'UPDATE customer_quotes SET offer_consent_at=NULL,offer_unsubscribed_at=?2 WHERE email=?1',email,stamp).run();
  const f=await db(env,'SELECT consent_at FROM followup_sequences WHERE email=?1',email).first();
  return !!f?.consent_at;
}
// One-off enrolment of preview contacts from before 14 Nov 2026 (see PAST_CONTACTS). Skips anyone already
// in a sequence, unsubscribed, paid, or the owner/test addresses.
export async function enrolPastContacts(env){
  await ensureFollowupTable(env);
  const inserted=await db(env,`INSERT INTO followup_sequences
    (email,episode_id,consent_text,consent_at,created_at,updated_at)
    SELECT c.email,(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-8'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),?1,?2,?2,?2 FROM preview_contacts c
    WHERE c.created_at<'2026-11-14T00:00:00.000Z' AND c.email NOT IN ('cravenluke@gmail.com','lukecraven788@gmail.com')
    AND c.email NOT LIKE '%@example.%' AND c.email NOT LIKE '%.test'
    AND c.email NOT LIKE '%@breeztechnologies.com' AND c.email NOT LIKE '%@mailinator.com' AND c.email NOT LIKE '%@gamil.com'
    AND NOT EXISTS (SELECT 1 FROM followup_sequences f WHERE f.email=c.email)
    AND NOT EXISTS (SELECT 1 FROM launch_leads l WHERE l.email=c.email AND l.unsubscribed_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM customer_quotes q WHERE q.email=c.email AND (q.offer_unsubscribed_at IS NOT NULL OR q.email_status IS NOT NULL))
    AND NOT EXISTS (SELECT 1 FROM customer_orders o WHERE o.email=c.email AND o.payment_status='paid')
    ON CONFLICT(email) DO NOTHING RETURNING email`,PAST_CONTACTS,now()).all();
  return {added:inserted.results.length};
}
async function hasCharacter(env,email){
  try{
    if(await env.BOOK_ASSETS.head('followup/'+await sha(email)))return true;
    const o=await db(env,'SELECT state FROM customer_orders WHERE email=?1 ORDER BY created_at DESC LIMIT 1',email).first();
    return !!JSON.parse(o?.state||'{}').characters?.[0];
  }catch{return false;}
}
const eligible=`f.consent_at IS NOT NULL AND q.offer_unsubscribed_at IS NULL AND q.email_status IS NULL
  AND ((f.consent_text=?2 AND q.confirmed_view_at IS NOT NULL AND q.offer_consent_at IS NOT NULL) OR f.consent_text IN (?3,?4))
  AND NOT EXISTS (SELECT 1 FROM customer_orders o WHERE o.email=f.email AND o.payment_status='paid')`;
const recipients='FROM followup_sequences f LEFT JOIN customer_quotes q ON q.email=f.email';
async function canSend(env,email){
  return db(env,`SELECT f.email,f.episode_id AS unsubscribe_token,q.size,f.consent_text
    ${recipients} WHERE f.email=?1 AND ${eligible}`,email,FOLLOWUP_CONSENT,PREVIEW_NOTICE,PAST_CONTACTS).first();
}
async function send(env,step,quote){
  const field=step===1?'first':'second';
  const claimed=await db(env,`UPDATE followup_sequences SET ${field}_status='sending',updated_at=?1 WHERE email=?2 AND consent_at IS NOT NULL AND ${field}_status IS NULL RETURNING episode_id`,now(),quote.email).first();
  if(!claimed)return 'skipped';
  const fresh=await canSend(env,quote.email);
  if(!fresh){await db(env,`UPDATE followup_sequences SET ${field}_status='suppressed',updated_at=?1 WHERE email=?2 AND ${field}_status='sending'`,now(),quote.email).run();return 'suppressed';}
  let code=null,expiry=null;
  if(step===2){
    code='CQ'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();
    expiry=new Date(Date.now()+7*DAY).toISOString();
    const reserved=fresh.consent_text!==FOLLOWUP_CONSENT
      ? await db(env,`INSERT INTO reminder_offers(email,discount_code,code_expires_at,email_status) VALUES (?1,?2,?3,'sending')
          ON CONFLICT(email) DO NOTHING RETURNING email`,quote.email,code,expiry).first()
      : await db(env,`UPDATE customer_quotes SET discount_code=?1,discount_pence=?2,code_expires_at=?3,email_status='sending'
          WHERE email=?4 AND email_status IS NULL AND offer_consent_at IS NOT NULL AND offer_unsubscribed_at IS NULL RETURNING email`,
          code,Math.round(PRODUCTS[fresh.size].pricePence*0.1),expiry,quote.email).first();
    if(!reserved){await db(env,"UPDATE followup_sequences SET second_status='suppressed',updated_at=?1 WHERE email=?2",now(),quote.email).run();return 'suppressed';}
  }
  const details=await detailsFor(env,quote.email);
  if(env.BOOK_ASSETS&&await hasCharacter(env,quote.email))details.image=`https://cravenandquill.com/api/orders/followup-character?t=${encodeURIComponent(fresh.unsubscribe_token)}`;
  const mail=message(step,fresh,code,expiry,details);
  const oneClick=`https://cravenandquill.com/api/orders/offer-one-click?token=${encodeURIComponent(fresh.unsubscribe_token)}`;
  let accepted=false,providerId=null;
  try{
    const response=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`cq-followup-${field}-${claimed.episode_id}`},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,reply_to:env.ORDER_EMAIL_REPLY_TO||'cravenluke@gmail.com',to:[quote.email],subject:mail.subject,html:mail.html,text:mail.text,headers:{'List-Unsubscribe':`<${oneClick}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();accepted=!!(response.ok&&data.id);providerId=accepted?data.id:null;
  }catch{/* An uncertain send is held for owner reconciliation, never retried automatically. */}
  const status=accepted?'accepted':'unknown',stamp=now();
  await db(env,`UPDATE followup_sequences SET ${field}_status=?1,${field}_sent_at=?2,${field}_provider_id=?3,updated_at=?4 WHERE email=?5 AND ${field}_status='sending'`,status,accepted?stamp:null,providerId,stamp,quote.email).run();
  if(step===2&&fresh.consent_text!==FOLLOWUP_CONSENT)await db(env,'UPDATE reminder_offers SET email_status=?1 WHERE email=?2',status,quote.email).run();
  else if(step===2)await db(env,'UPDATE customer_quotes SET email_status=?1,email_sent_at=?2,email_provider_id=?3 WHERE email=?4 AND email_status=\'sending\'',status,accepted?stamp:null,providerId,quote.email).run();
  return status;
}

export async function followupStatus(env){
  await ensureFollowupTable(env);
  const row=await env.DB.prepare(`SELECT COUNT(CASE WHEN consent_at IS NOT NULL AND consent_text IN (?1,?2,?3) THEN 1 END) AS enrolled,SUM(CASE WHEN first_status='accepted' THEN 1 ELSE 0 END) AS first_sent,
    SUM(CASE WHEN second_status='accepted' THEN 1 ELSE 0 END) AS second_sent,
    SUM(CASE WHEN first_status IN ('sending','unknown') OR second_status IN ('sending','unknown') THEN 1 ELSE 0 END) AS needs_review
    FROM followup_sequences`).bind(FOLLOWUP_CONSENT,PREVIEW_NOTICE,PAST_CONTACTS).first();
  let chase={enrolled:0,sent:[0,0,0,0,0]};
  try{
    await ensureChaseTables(env);
    chase.enrolled=(await db(env,'SELECT COUNT(*) n FROM followup_sequences WHERE consent_text=?1 AND consent_at IS NOT NULL',CHASE_NOTICE).first())?.n||0;
    for(const r of (await env.DB.prepare("SELECT step,COUNT(*) n FROM chase_steps WHERE status='accepted' GROUP BY step").all()).results||[])chase.sent[r.step-1]=r.n;
  }catch{}
  return {enabled:env.FOLLOWUP_EMAILS_ENABLED==='true',enrolled:(row.enrolled||0)+chase.enrolled,firstSent:row.first_sent||0,secondSent:row.second_sent||0,needsReview:row.needs_review||0,chase,season:await seasonStatus(env)};
}

export async function runFollowups(env){
  if(env.FOLLOWUP_EMAILS_ENABLED!=='true')return {paused:true};
  if(!env.DB||!env.RESEND_API_KEY||!env.ORDER_EMAIL_FROM)return {error:'Email or storage is not configured.'};
  await ensureFollowupTable(env);
  await enrolPastContacts(env);
  const cutoffFirst=new Date(Date.now()-DAY).toISOString(),cutoffSecond=new Date(Date.now()-3*DAY).toISOString();
  const first=(await db(env,`SELECT f.email ${recipients} WHERE ${eligible} AND f.first_status IS NULL
    AND (f.consent_text=?4 OR (COALESCE(q.confirmed_view_at,f.consent_at)<=?1 AND (f.consent_text=?2 OR f.consent_at<=?1))) ORDER BY f.created_at LIMIT 5`,
    cutoffFirst,FOLLOWUP_CONSENT,PREVIEW_NOTICE,PAST_CONTACTS).all()).results||[];
  const results={first:{accepted:0,unknown:0,suppressed:0},second:{accepted:0,unknown:0,suppressed:0}};
  for(const row of first){
    const outcome=await send(env,1,row);
    if(outcome in results.first)results.first[outcome]++;
    if(first.length>1)await new Promise(resolve=>setTimeout(resolve,600));
  }
  const second=(await db(env,`SELECT f.email ${recipients} WHERE ${eligible} AND f.first_status='accepted'
    AND (f.first_sent_at<=?1 OR (f.consent_text=?4 AND f.first_sent_at<'2026-11-14T13:00:00.000Z')) AND f.second_status IS NULL ORDER BY f.first_sent_at LIMIT 30`,cutoffSecond,FOLLOWUP_CONSENT,PREVIEW_NOTICE,PAST_CONTACTS).all()).results||[];
  for(const row of second){
    const outcome=await send(env,2,row);
    if(outcome in results.second)results.second[outcome]++;
    if(second.length>1)await new Promise(resolve=>setTimeout(resolve,600));
  }
  try{results.chase=await runChase(env);}catch{console.error('Chase emails failed');results.chase={error:true};}
  try{results.season=await runSeason(env);}catch{console.error('Seasonal emails failed');results.season={error:true};}
  return results;
}

export {message as followupMessage};

// ---------------------------------------------------------------------------------------------------
// Five-email chase (OWNER-APPROVED copy and timing, Luke, 21 Nov 2026). Short, one thought each, with the
// button high enough to show without scrolling. The 10% code first appears in email 3 and is repeated in
// 4 and 5. Email 5 (rewritten 28 Nov, Luke): the code really ends the next day. Saved books are never deleted,
// so never say the book will be gone.
export const CHASE_NOTICE='If you leave your book unfinished, we’ll email you a few reminders about it over the next week, including a 10% offer. You can unsubscribe at any time.';
// Hours after the email was given before each chase email is due.
export const CHASE_HOURS=[3,24,72,120,144];
const GOLD='#8f6a2a';
export function chaseMessage(step,{names='',title='',image='',link,unsub,code='',expires=null,today=new Date(),content=null,footer=''}){
  const name=String(names).trim().slice(0,60),t=String(title).trim().slice(0,120);
  const N=name||'your child',Np=name?poss(name):'their',Cap=name?poss(name):'Their';
  const when=expires?new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/London'}).format(new Date(expires)):'';
  const xmas=today<new Date('2026-12-14T23:59:00Z');
  const e=escapeHtml;
  // Plain words, one feeling per email, written the way a person would say it.
  const c=content||[null,{
    subject:name?`We drew ${name}. Come and look`:'We drew them. Come and look',
    heading:name?`We drew ${name}. Come and look.`:'We drew them. Come and look.',
    lead:`The story is written and the first picture is done. See how ${e(N)} turned out.`,
    button:name?`See ${Np} book`:'See their book',
    after:'It costs nothing to look. You see every page before we print.'
  },{
    subject:name?`Picture ${name} opening this`:'Picture them opening this',
    heading:name?`Picture ${name} opening this.`:'Picture them opening this.',
    lead:name?`A parcel with ${e(name)}’s name on it. Inside, a real book, and the child on every page is ${e(name)}. You won’t forget that face.`:'A parcel with their name on it. Inside, a real book, and the child on every page is them. You won’t forget that face.',
    button:name?`Make ${Np} book`:'Make their book',
    after:'You check every page first. We only print when you’re happy.'
  },{
    subject:'“Again! The one about me.”',
    heading:'“Again! The one about me.”',
    lead:`That’s what you’ll hear at bedtime. A story where ${e(N)} is the hero gets read until the pages go soft. Here’s 10% off to make it real.`,
    button:name?`Get 10% off ${Np} book`:'Get 10% off their book',
    after:`Your code works once, until ${when}.`
  },{
    subject:xmas?`The present ${name||'they'} will still have at 30`:`${Cap} book is still here`,
    heading:xmas?'The one present that won’t end up in a drawer.':'Made for one child in the whole world.',
    lead:xmas?`Order by 14 December and ${Np} book is under the tree on Christmas morning. Made for one child in the whole world.`:`${Cap} book is still here, drawn and written. It only needs you to say yes.`,
    button:name?`Order ${Np} book`:'Order their book',
    after:`Your 10% code still works, until ${when}.`
  },{
    subject:'Your 10% off ends tomorrow',
    heading:'Your 10% off ends tomorrow.',
    lead:`${Cap} book is saved and ready: the drawing, the story, all of it. Your code takes 10% off until ${when}.`,
    button:name?`Order ${Np} book`:'Order their book',
    after:xmas?'Order by 14 December to have it for Christmas. You see every page before we print.':'You see every page before we print.'
  }][step];
  const showCode=step>=3&&code;
  const prices=`Hardbacks £${(PRODUCTS.a5.regularPricePence/100).toFixed(2)} (A5) and £${(PRODUCTS.a4.regularPricePence/100).toFixed(2)} (A4), plus £3.99 UK postage.`;
  const codeLine=showCode?`<p style="margin:0 0 26px;color:#1f1b16;font:17px/1.5 ${SERIF};">Your code: <b style="font-weight:700;letter-spacing:1px;border-bottom:2px solid ${GOLD};padding-bottom:1px;">${e(code)}</b></p>`:'';
  // The one big thing in the email: their own character, shown like a page from the book.
  const picture=image?`<img src="${e(image)}" width="560" alt="${e(name?name+'’s character':'Your character')}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:6px;"><p style="margin:10px 0 26px;color:#6b6157;font:italic 15px/1.5 ${SERIF};">${e(name?`${name}, drawn from your photo`:'Drawn from your photo')}${t?`, for <span style="color:#1f1b16;">${e(t)}</span>`:''}</p>`:'';
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(c.subject)} | Craven &amp; Quill</title><style>@media only screen and (max-width:600px){.content{padding:20px 20px 28px!important}.heading{font-size:30px!important}}</style></head>
<body style="margin:0;padding:0;background:#ffffff;color:#1f1b16;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${e(c.after)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#ffffff;"><tr><td class="content" style="padding:28px 28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;max-width:560px;"><tr><td>
<img src="${LOGO}" width="46" alt="Craven &amp; Quill" style="display:block;width:46px;height:auto;border:0;margin:0 0 22px;color:#1f1b16;font:15px ${SERIF};">
<h1 class="heading" style="margin:0 0 14px;color:#1f1b16;font:normal 36px/1.12 ${SERIF};letter-spacing:-.5px;">${e(c.heading)}</h1>
<p style="margin:0 0 22px;color:#1f1b16;font:19px/1.5 ${SERIF};">${c.lead}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 ${showCode?'16':'28'}px;"><tr><td bgcolor="${GOLD}" align="center" style="border-radius:6px;"><a class="button" href="${e(link)}" style="display:block;padding:18px 24px;color:#ffffff;text-decoration:none;font:700 18px/1.2 ${SANS};">${e(c.button)}</a></td></tr></table>
${codeLine}${picture}<p style="margin:0 0 18px;color:#1f1b16;font:17px/1.55 ${SERIF};">${e(c.after)}</p>
<p style="margin:0 0 26px;color:#1f1b16;font:17px/1.55 ${SERIF};">Any questions, just reply. We read every one.<br>The Craven &amp; Quill team</p>
<p style="margin:0 0 6px;padding:16px 0 0;border-top:1px solid #e6dfd0;color:#6b6157;font:13px/1.6 ${SANS};">${e(prices)}</p>
<p style="margin:0;color:#6b6157;font:13px/1.6 ${SANS};">${e(footer||`You made a free book preview with us. This is email ${step} of 5.`)} <a href="${e(unsub)}" style="color:#6b6157;">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const strip=x=>x.replace(/<[^>]+>/g,'');
  const text=[c.heading,strip(c.lead),`${c.button}: ${link}`,showCode?`Your code: ${code}`:'',c.after,'Any questions, just reply. We read every one.\nThe Craven & Quill team',prices,`Stop these emails: ${unsub}`].filter(Boolean).join('\n\n');
  return {subject:c.subject,html,text};
}

// ----- Chase sending -----
const CHASE_TABLES=[
  'CREATE TABLE IF NOT EXISTS chase_steps (email TEXT NOT NULL, step INTEGER NOT NULL, status TEXT NOT NULL, sent_at TEXT, provider_id TEXT, PRIMARY KEY (email, step))',
  // Where the shopper's saved book lives, so every chase email opens their own book on any device. Stored sealed.
  'CREATE TABLE IF NOT EXISTS chase_links (email TEXT PRIMARY KEY, sealed TEXT NOT NULL, expires_at TEXT NOT NULL, updated_at TEXT NOT NULL)'
];
async function ensureChaseTables(env){for(const sql of CHASE_TABLES)await env.DB.prepare(sql).run();}
async function sealKey(env){return crypto.subtle.importKey('raw',new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('chase-link:'+env.ORDER_LINK_SECRET))),'AES-GCM',false,['encrypt','decrypt']);}
const b64=bytes=>btoa(String.fromCharCode(...bytes)),unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
// Called when a shopper's book is saved (the link-back email). Never throws: a failed save only means the
// chase emails fall back to the plain book-maker link.
export async function saveChaseLink(env,email,draftId,token,expires){
  try{
    if(!env.ORDER_LINK_SECRET||!env.DB)return false;
    await ensureChaseTables(env);
    const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await sealKey(env),new TextEncoder().encode(draftId+':'+token)));
    await db(env,'INSERT INTO chase_links (email,sealed,expires_at,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(email) DO UPDATE SET sealed=excluded.sealed,expires_at=excluded.expires_at,updated_at=excluded.updated_at',
      String(email).trim().toLowerCase(),b64(iv)+'.'+b64(cipher),new Date(expires).toISOString(),now()).run();
    return true;
  }catch{console.error('Chase link not saved');return false;}
}
// Opens a sealed saved-book link. Null if it is broken or the secret is missing.
async function unsealLink(env,sealed){
  try{
    if(!env.ORDER_LINK_SECRET)return null;
    const [iv,cipher]=String(sealed).split('.').map(unb64);
    const [draftId,token]=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},await sealKey(env),cipher)).split(':');
    return /^[a-f0-9-]{36}$/.test(draftId)&&/^[a-f0-9-]{64,80}$/.test(token||'')?{draftId,token}:null;
  }catch{return null;}
}
// The shopper's saved book (draft id and key), while it has not expired.
export async function openChaseLink(env,email){
  try{
    await ensureChaseTables(env);
    const row=await db(env,'SELECT sealed,expires_at FROM chase_links WHERE email=?1',String(email||'').trim().toLowerCase()).first();
    if(!row)return null;// 26 Nov 2026: saved books never expire
    const link=await unsealLink(env,row.sealed);return link&&{...link,email:String(email).trim().toLowerCase(),expiresAt:row.expires_at};
  }catch{return null;}
}
// Owner desk (26 Nov 2026): every unexpired saved book, newest first, with its draft id and key. Server use only.
export async function recentChaseLinks(env,limit=300){
  await ensureChaseTables(env);
  const rows=(await db(env,'SELECT email,sealed,expires_at FROM chase_links ORDER BY updated_at DESC LIMIT ?1',limit).all()).results||[];
  const out=[];for(const r of rows){const link=await unsealLink(env,r.sealed);if(link)out.push({email:r.email,expiresAt:r.expires_at,...link});}
  return out;
}
async function chaseLink(env,email,step,code){
  const query=`${code?`offer=${encodeURIComponent(code)}&`:''}utm_source=email&utm_medium=email&utm_campaign=chase&utm_content=chase_${step}`;
  const link=await openChaseLink(env,email);
  if(link)return `https://cravenandquill.com/create?${query}#draft=${link.draftId}&key=${link.token}`;
  return `https://cravenandquill.com/create.html?${query}`;
}
// Which chase email is due. Latest one whose time has come; earlier ones that were missed are skipped, never
// sent late in a bunch. At least 18 hours between any two, and nothing after the saved book has been deleted.
export function chaseDue(hours,sent){
  if(hours>167)return 0;
  let due=0;for(let i=0;i<CHASE_HOURS.length;i++)if(hours>=CHASE_HOURS[i])due=i+1;
  if(!due||sent.some(x=>x.step>=due))return 0;
  const last=Math.max(0,...sent.filter(x=>x.sent_at).map(x=>Date.parse(x.sent_at)));
  if(last&&Date.now()-last<18*3600000)return 0;
  return due;
}
async function runChase(env){
  await ensureChaseTables(env);
  const out={accepted:0,unknown:0};
  const rows=(await db(env,`SELECT f.email,f.episode_id,f.consent_at FROM followup_sequences f
    WHERE f.consent_text=?1 AND f.consent_at IS NOT NULL AND f.consent_at>?2
    AND NOT EXISTS (SELECT 1 FROM customer_quotes q WHERE q.email=f.email AND q.offer_unsubscribed_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM customer_orders o WHERE o.email=f.email AND o.payment_status='paid')
    ORDER BY f.consent_at LIMIT 40`,CHASE_NOTICE,new Date(Date.now()-8*DAY).toISOString()).all()).results||[];
  for(const row of rows){
    const sent=(await db(env,'SELECT step,sent_at FROM chase_steps WHERE email=?1',row.email).all()).results||[];
    const step=chaseDue((Date.now()-Date.parse(row.consent_at))/3600000,sent);
    // 26 Nov 2026: only the 3-hour "come and look" email goes automatically. Later chasing is the owner's personal whole-book email (set CHASE_MAX_STEP=5 to bring the old five back).
    if(!step||step>Number(env.CHASE_MAX_STEP||1))continue;
    const claimed=await db(env,"INSERT INTO chase_steps (email,step,status) VALUES (?1,?2,'sending') ON CONFLICT(email,step) DO NOTHING RETURNING step",row.email,step).first();
    if(!claimed)continue;
    const expires=new Date(Date.parse(row.consent_at)+7*DAY).toISOString();
    let code='';
    if(step>=3){
      // One personal 10% code per shopper, created with email 3 and repeated in 4 and 5. Ends when the saved book does.
      await db(env,`INSERT INTO reminder_offers(email,discount_code,code_expires_at,email_status) VALUES (?1,?2,?3,'sending') ON CONFLICT(email) DO NOTHING`,
        row.email,'CQ'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase(),expires).run();
      code=(await db(env,'SELECT discount_code FROM reminder_offers WHERE email=?1 AND redeemed_order_id IS NULL',row.email).first())?.discount_code||'';
    }
    const details=await detailsFor(env,row.email);
    const image=env.BOOK_ASSETS&&await hasCharacter(env,row.email)?`https://cravenandquill.com/api/orders/followup-character?t=${encodeURIComponent(row.episode_id)}`:'';
    const mail=chaseMessage(step,{names:details?.names,title:details?.title,image,code,expires,
      link:await chaseLink(env,row.email,step,code),unsub:`https://cravenandquill.com/offer-unsubscribe.html?token=${encodeURIComponent(row.episode_id)}`});
    const oneClick=`https://cravenandquill.com/api/orders/offer-one-click?token=${encodeURIComponent(row.episode_id)}`;
    let accepted=false,providerId=null;
    try{
      const response=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`cq-chase-${step}-${row.episode_id}`},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,reply_to:env.ORDER_EMAIL_REPLY_TO||'cravenluke@gmail.com',to:[row.email],subject:mail.subject,html:mail.html,text:mail.text,headers:{'List-Unsubscribe':`<${oneClick}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();accepted=!!(response.ok&&data.id);providerId=accepted?data.id:null;
    }catch{/* An uncertain send is never retried automatically. */}
    await db(env,'UPDATE chase_steps SET status=?1,sent_at=?2,provider_id=?3 WHERE email=?4 AND step=?5',accepted?'accepted':'unknown',now(),providerId,row.email,step).run();
    if(code&&accepted)await db(env,"UPDATE reminder_offers SET email_status='accepted' WHERE email=?1 AND email_status!='accepted'",row.email).run();
    out[accepted?'accepted':'unknown']++;
    await new Promise(resolve=>setTimeout(resolve,600));
  }
  return out;
}


// ----- Seasonal emails (Christmas 2026) -----
// Everyone we hold an email for gets these, apart from people who unsubscribed, test addresses, and shoppers
// who are in the middle of the five-email chase (they are already hearing from us that week).
export const SEASON_NOTICE='Gave an email to Craven & Quill for a preview or order. Seasonal emails approved by the owner on 22 Nov 2026. Unsubscribe link in every email.';
// Each email only goes inside its own window (UK morning onwards). A missed window is skipped, never sent late.
export const SEASONS=[
  {key:'xmas26-1',from:'2026-11-24T08:00:00Z',to:'2026-11-25T20:00:00Z'},
  {key:'xmas26-2',from:'2026-12-03T08:00:00Z',to:'2026-12-04T20:00:00Z'},
  {key:'xmas26-3',from:'2026-12-13T08:00:00Z',to:'2026-12-13T21:00:00Z'}
];
export function seasonMessage(key,{names='',title='',image='',link,unsub}){
  const name=String(names).trim().slice(0,60),e=escapeHtml,N=name||'your little one',Np=name?poss(name):'their';
  const content={
    'xmas26-1':{
      subject:name?`A Christmas book with ${name} in it`:'A Christmas book with your child in it',
      heading:name?`A Christmas book with ${name} in it.`:'A Christmas book with your child in it.',
      lead:`${image?`Remember the little character we drew of ${e(N)}? We can turn it into a real storybook`:'We can make a real storybook from one photo'}, with ${e(N)} in every picture. It makes a lovely present to open on Christmas morning. If you’d like one, order by 14 December.`,
      button:name?`See ${Np} book`:'See their book',
      after:'It’s free to look. You see every page before we print anything.'
    },
    'xmas26-2':{
      subject:name?`${name} opening this on Christmas morning`:'Opening this on Christmas morning',
      heading:name?`Imagine ${name} opening this.`:'Imagine them opening this.',
      lead:`A storybook, and the child in the pictures is ${e(N)}. Children love seeing themselves in a story. It’s the kind of present that still gets read at bedtime long after the toys are forgotten. There’s still time. Order by 14 December.`,
      button:name?`Make ${Np} book`:'Make their book',
      after:'It takes about five minutes. You see every page first.'
    },
    'xmas26-3':{
      subject:'The last day for Christmas is tomorrow',
      heading:'Just a quick reminder.',
      lead:`Tomorrow, 14 December, is the last day to order ${name?e(Np):'a'} book for Christmas. Each one is made specially, so it takes us a little while. If you’d still like one, now’s the time.`,
      button:name?`Order ${Np} book`:'Order their book',
      after:'You see every page before we print.'
    }
  }[key];
  return chaseMessage(0,{names,title,image,link,unsub,content,footer:'You’re getting this because you made a free book preview with us.'});
}
const SEASON_TABLE='CREATE TABLE IF NOT EXISTS season_sends (email TEXT NOT NULL, key TEXT NOT NULL, status TEXT NOT NULL, sent_at TEXT, provider_id TEXT, PRIMARY KEY (email, key))';
const NEW_ID="(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-8'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))";
export function seasonDue(at=Date.now()){return SEASONS.find(s=>at>=Date.parse(s.from)&&at<=Date.parse(s.to))||null;}
async function runSeason(env){
  const out={accepted:0,unknown:0},season=seasonDue(env.NOW?Date.parse(env.NOW):Date.now());
  if(!season)return out;
  await ensureChaseTables(env);await env.DB.prepare(SEASON_TABLE).run();
  // Give everyone we hold an email for a row here, so each has their own unsubscribe link.
  for(const source of ['preview_contacts','customer_orders','customer_quotes','launch_leads'])try{
    await db(env,`INSERT INTO followup_sequences (email,episode_id,consent_text,consent_at,created_at,updated_at)
      SELECT c.email,${NEW_ID},?1,?2,?2,?2 FROM (SELECT DISTINCT email FROM ${source} WHERE email LIKE '%_@_%') c
      WHERE NOT EXISTS (SELECT 1 FROM followup_sequences f WHERE f.email=c.email) ON CONFLICT(email) DO NOTHING`,SEASON_NOTICE,now()).run();
  }catch{/* A table that does not exist yet simply adds nobody. */}
  const rows=(await db(env,`SELECT f.email,f.episode_id FROM followup_sequences f
    WHERE f.consent_at IS NOT NULL AND NOT (f.consent_text=?2 AND f.consent_at>?3)
    AND f.email NOT IN ('lukecraven788@gmail.com','amna_al_aqeeli@hotmail.com')
    AND f.email NOT LIKE '%@example.%' AND f.email NOT LIKE '%.test'
    AND f.email NOT LIKE '%@breeztechnologies.com' AND f.email NOT LIKE '%@mailinator.com' AND f.email NOT LIKE '%@gamil.com'
    AND NOT EXISTS (SELECT 1 FROM customer_quotes q WHERE q.email=f.email AND q.offer_unsubscribed_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM season_sends s WHERE s.email=f.email AND s.key=?1)
    ORDER BY f.created_at LIMIT 25`,season.key,CHASE_NOTICE,new Date(Date.now()-7*DAY).toISOString()).all()).results||[];
  for(const row of rows){
    try{if(await db(env,'SELECT 1 x FROM launch_leads WHERE email=?1 AND unsubscribed_at IS NOT NULL',row.email).first())continue;}catch{}
    const claimed=await db(env,"INSERT INTO season_sends (email,key,status) VALUES (?1,?2,'sending') ON CONFLICT(email,key) DO NOTHING RETURNING key",row.email,season.key).first();
    if(!claimed)continue;
    const details=await detailsFor(env,row.email);
    const image=env.BOOK_ASSETS&&await hasCharacter(env,row.email)?`https://cravenandquill.com/api/orders/followup-character?t=${encodeURIComponent(row.episode_id)}`:'';
    const mail=seasonMessage(season.key,{names:details?.names,title:details?.title,image,
      link:`https://cravenandquill.com/create?utm_source=email&utm_medium=email&utm_campaign=season&utm_content=${season.key.replace('-','_')}`,
      unsub:`https://cravenandquill.com/offer-unsubscribe.html?token=${encodeURIComponent(row.episode_id)}`});
    const oneClick=`https://cravenandquill.com/api/orders/offer-one-click?token=${encodeURIComponent(row.episode_id)}`;
    let accepted=false,providerId=null;
    try{
      const response=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`cq-season-${season.key}-${row.episode_id}`},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,reply_to:env.ORDER_EMAIL_REPLY_TO||'cravenluke@gmail.com',to:[row.email],subject:mail.subject,html:mail.html,text:mail.text,headers:{'List-Unsubscribe':`<${oneClick}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();accepted=!!(response.ok&&data.id);providerId=accepted?data.id:null;
    }catch{/* An uncertain send is never retried automatically. */}
    await db(env,'UPDATE season_sends SET status=?1,sent_at=?2,provider_id=?3 WHERE email=?4 AND key=?5',accepted?'accepted':'unknown',now(),providerId,row.email,season.key).run();
    out[accepted?'accepted':'unknown']++;
    await new Promise(resolve=>setTimeout(resolve,600));
  }
  return out;
}
export async function seasonStatus(env){
  const sent={};
  try{for(const r of (await env.DB.prepare("SELECT key,COUNT(*) n FROM season_sends WHERE status='accepted' GROUP BY key").all()).results||[])sent[r.key]=r.n;}catch{}
  return {next:SEASONS.find(s=>Date.now()<=Date.parse(s.to))?.from||null,sent};
}
