import {PRODUCTS} from './catalog.js';

// Customer order emails: a branded HTML version matching the follow-up emails, plus a plain-text twin.
const LOGO='https://cravenandquill.com/assets/craven-quill-gold-logo.png';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const possessive=n=>n?n+(/s$/i.test(n)?'’':'’s'):'their';
const sans='Arial,Helvetica,sans-serif',serif="Georgia,'Times New Roman',serif";

function facts(o){
  const d=o.data||{},name=String(d.names||'').trim(),title=String(d.story?.title||'').trim();
  const r=d.recipient||{},postcode=r.address?.postalOrZipCode||'';
  return {name,title,poss:possessive(name),them:name||'them',label:PRODUCTS[o.size].label,paid:'£'+(o.amount/100).toFixed(2),
    to:[r.name,postcode].filter(Boolean).join(', '),ref:String(o.id).slice(0,8).toUpperCase()};
}

function copy(o,kind){
  const f=facts(o);
  if(kind==='receipt')return {
    subject:`Payment received, we’re making ${f.poss} book`,
    preheader:`Payment received. Your proof arrives within 7 days.`,
    kicker:'Order confirmed',heading:`We’re making ${f.poss} book now.`,
    intro:[`Thank you. Your payment is in and our team has started on ${f.title?`<i>${esc(f.title)}</i>`:'their story'}. We can’t wait for ${esc(f.them)} to see it.`],
    introText:[`Thank you. Your payment is in and our team has started on ${f.title||'their story'}. We can’t wait for ${f.them} to see it.`],
    steps:[['Now',`We draw ${f.them} into every page.`],['Within 7 days','We email you the finished proof to check.'],['Then 7–12 working days',`Printed and posted${f.to?' to '+f.to:''}.`]],
    note:'Nothing prints until you’ve approved the proof.',button:'See your order'};
  // Owner wording, 19 Nov 2026: short and warm. Greet by the delivery name's first name, one button, change by reply, else we post it.
  if(kind==='proof'){const first=String((o.data||{}).recipient?.name||'').trim().split(/\s+/)[0]||'',hi=first?`Hi ${first},`:'Hello,',book=f.name?f.poss+' book':'Your book';
    const change='If you’d like anything changed, just reply to this email and our team will pick it up. Otherwise, we’ll get it printed and posted out to you.';
    return {simple:true,subject:`${book} is ready`,preheader:'Take a look and approve it, or reply with any changes.',kicker:'',heading:'',
    intro:[esc(hi),`${esc(book)} is ready. Tap the button below to take a look, and approve it if you’re happy.`],
    introText:[hi,`${book} is ready. Use the link below to take a look, and approve it if you’re happy.`],
    after:[esc(change),'Thank you,<br>The Craven &amp; Quill team'],afterText:[change,'Thank you,\nThe Craven & Quill team'],
    steps:[],note:'',button:`See ${f.name?f.poss:'your'} book`};}
  if(kind==='shipped')return {
    subject:`${f.name?f.poss:'Your'} book has gone to the printer`,
    preheader:'Tracking will appear on your order page.',
    kicker:'At the printer',heading:`${f.name?f.poss[0].toUpperCase()+f.poss.slice(1):'Your'} book is being printed.`,
    intro:['Your approved book has been sent to the printer. This is not a dispatch confirmation yet. Tracking will appear on your order page when it’s on its way.'],
    introText:['Your approved book has been sent to the printer. This is not a dispatch confirmation yet. Tracking will appear on your order page when it’s on its way.'],
    steps:[['Done','Proof approved.'],['Now','Printing and binding.'],['Next',`Posted${f.to?' to '+f.to:''}, with tracking on your order page.`]],
    note:'',button:'See your order'};
  if(kind==='dispatched'){const t=(o.data?.shipments||[]).find(x=>x.trackingNumber)||{};return {
    subject:`${f.name?f.poss[0].toUpperCase()+f.poss.slice(1):'Your'} book is on its way`,
    preheader:t.trackingNumber?`Tracking number ${t.trackingNumber}.`:'Your book has been posted.',
    kicker:'Posted',heading:`${f.name?f.poss[0].toUpperCase()+f.poss.slice(1):'Your'} book is on its way.`,
    intro:[`It’s printed, bound and in the post${f.to?' to '+esc(f.to):''}. We hope ${esc(f.them)} loves it.`],
    introText:[`It’s printed, bound and in the post${f.to?' to '+f.to:''}. We hope ${f.them} loves it.`],
    steps:[['Done','Proof approved and printed.'],['Now',`On its way${t.carrier?' with '+(t.carrier.name||t.carrier):''}.`],['Next','Usually with you in a few working days.']],
    stepNow:1,tracking:t,note:t.trackingNumber?`Tracking number: ${t.trackingNumber}`:'',button:t.trackingUrl?'Track your book':'See your order',buttonUrl:t.trackingUrl||null};}
  throw Error('Unknown email type');
}

function html(o,c,url){
  const f=facts(o);
  const p=(t,extra='')=>`<p style="margin:0 0 16px;color:#3c352f;font:16px/1.65 ${sans};${extra}">${t}</p>`;
  const cur=c.stepNow||0;const steps=c.steps.map(([when,what],i)=>`<tr><td width="22" valign="top" style="padding:${i?'14px':'0'} 0 0;"><div style="width:10px;height:10px;margin-top:5px;border-radius:50%;${i<cur?'background:#c9bda6;border:2px solid #c9bda6;':i>cur?'border:2px solid #c9bda6;background:#fffdfa;':'background:#ad843f;border:2px solid #ad843f;'}"></div></td><td style="padding:${i?'14px':'0'} 0 0;"><p style="margin:0;color:${i===cur?'#846329':'#7a6e60'};font:700 12px/1.4 ${sans};">${esc(when)}</p><p style="margin:2px 0 0;color:#2b2621;font:15px/1.5 ${sans};">${esc(what)}</p></td></tr>`).join('');
  const row=(k,v)=>`<tr><td style="padding:7px 0;color:#7a6e60;font:14px/1.45 ${sans};width:38%;" valign="top">${k}</td><td style="padding:7px 0;color:#2b2621;font:14px/1.45 ${sans};" valign="top">${v}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)} | Craven &amp; Quill</title><style>@media only screen and (max-width:600px){.shell{width:100%!important}.content{padding:32px 24px 34px!important}.footer{padding:24px 24px 32px!important}.heading{font-size:31px!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:#efeae0;color:#211d1a;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:#efeae0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(c.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#efeae0;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="shell" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;max-width:560px;background:#fffdfa;">
<tr><td align="center" style="padding:30px 24px 22px;border-bottom:1px solid #e9dec7;"><a href="https://cravenandquill.com"><img src="${LOGO}" width="150" alt="Craven &amp; Quill" style="display:block;width:150px;height:auto;border:0;color:#211d1a;font:21px ${serif};"></a></td></tr>
<tr><td class="content" style="padding:40px 48px 44px;">
${c.kicker?`<p style="margin:0 0 14px;color:#846329;font:700 13px/1.5 ${sans};">${esc(c.kicker)}</p>`:''}
${c.heading?`<h1 class="heading" style="margin:0 0 20px;color:#211d1a;font:normal 36px/1.12 ${serif};letter-spacing:-.5px;">${esc(c.heading)}</h1>`:''}
${c.intro.map(t=>p(t)).join('')}
${c.steps.length?`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:10px 0 28px;">${steps}</table>`:'<div style="height:8px;"></div>'}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 30px;"><tr><td bgcolor="#25201b" style="border-radius:3px;"><a class="button" href="${esc(c.buttonUrl||url)}" style="display:inline-block;padding:16px 26px;color:#ffffff;text-decoration:none;font:700 15px/1.2 ${sans};">${esc(c.button)}</a></td></tr></table>
${c.simple?(c.after||[]).map(t=>p(t)).join(''):`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f5f0e6;"><tr><td style="padding:16px 20px;border-left:3px solid #ad843f;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
${f.title?row('Book',`<i style="font-family:${serif};">${esc(f.title)}</i>`):''}${row('Format',esc(f.label))}${row('Paid',esc(f.paid)+', including UK postage')}${f.to?row('Posting to',esc(f.to)):''}${row('Order ref',esc(f.ref))}
</table></td></tr></table>
${c.note?p(esc(c.note),'margin:24px 0 0;color:#655a50;font-size:14px;'):''}
<p style="margin:${c.note?'8px':'24px'} 0 0;color:#655a50;font:14px/1.6 ${sans};">Questions? Just reply to this email.</p>`}
</td></tr>
<tr><td class="footer" style="padding:24px 48px 34px;border-top:1px solid #e9dec7;background:#faf7f0;">
<p style="margin:0 0 8px;color:#655a50;font:13px/1.55 ${sans};">Craven &amp; Quill. Personalised books, made for one reader at a time.</p>
<p style="margin:0;color:#8a7f73;font:12px/1.55 ${sans};">${esc(c.footer||'The button opens your private order page. Please don’t forward this email.')}</p>
</td></tr></table></td></tr></table></body></html>`;
}

// Sent when a shopper asks to have their free preview emailed, before any order exists.
// Same short shape as the 'book is ready' email: no pictures, one button back to their preview.
export function savedPreviewEmail(names,url){
  const name=String(names||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,60),book=name?possessive(name)+' book':'your book',Book=name?book:'Your book';
  const lines=[`Here is ${book}, saved for 7 days.`,'Tap the button to see the cover, the first painted pages and the whole story.'];
  const after='You see the whole finished book before we print it. When you’re ready, you can order the A4 or A5 hardback from that page.';
  const c={simple:true,subject:`${Book} is saved`,preheader:'Your free preview, saved for 7 days.',kicker:'',heading:'',
    intro:['Hello,',...lines].map(esc),after:[esc(after),'Thank you,<br>The Craven &amp; Quill team'],steps:[],note:'',button:`See ${name?possessive(name):'your'} book`,
    footer:'The button opens your private preview. Anyone with the link can see the story and character, so please don’t forward this email.'};
  const text=['Hello,',...lines,`${c.button}: ${url}`,after,'Thank you,\nThe Craven & Quill team',c.footer].join('\n\n');
  return {subject:'Craven & Quill: '+c.subject,text,html:html({size:'a4',amount:0,id:'',data:{names:name}},c,url)};
}

// Owner wording, 26 Nov 2026: the whole-book preview, written as a personal note that SHOWS every spread.
// Pictures come from signed public links (o.data.emailExtra.pages), since email apps can't send the private key.
const TITLES=/^(mr|mrs|ms|miss|dr)\.?$/i,GOLD='#ad843f';
const poundsOff=p=>'£'+(p%100?(p/100).toFixed(2):String(p/100));
export function previewEmail(o,url,today=new Date()){
  const d=o.data||{},x=d.emailExtra||{},f=facts(o),first=String(d.recipient?.name||'').trim().split(/\s+/)[0]||'';
  const hi=x.greeting||(first&&!TITLES.test(first)?`Hi ${first},`:'Hello,'),who=f.name?f.poss:'your',Who=f.name?f.poss:'Your';
  const g=d.discount?.ownerGift?d.discount:null,off=g?(g.percent?g.percent+'% off':poundsOff(g.amountPence)+' off'):'';
  const lines=[`I’ve put together ${who} whole book so you can see exactly how it would look. Have a flick through below.`,'If anything needs changing, or you’ve got any questions at all, just reply to this email and I’ll sort it.'];
  const offer=g?`As a thank you, here’s ${off} ${who} book. It’s already taken off, so there’s no code to remember.`:'';
  const button=g?(g.percent?`Order ${who} book with ${off}`:`Order ${who} book, ${off}`):`Order ${who} book`;
  const small=`Printed as a hardback in the UK and posted to your door.${today<Date.parse('2026-12-15T00:00:00Z')?' Order by 14 December for Christmas.':''}`;
  const subject=`${Who} book is ready to see`,pages=Array.isArray(x.pages)?x.pages:[],n=pages.length;
  const pic=(i,alt,w)=>`<a href="${esc(url)}" style="text-decoration:none;"><img src="${esc(pages[i])}" width="${w}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;margin:0 auto;color:#7a6e60;font:13px ${sans};"></a>`;
  const rows=[];if(n){rows.push(`<tr><td colspan="2" align="center" style="padding:0 0 14px;">${pic(0,f.title?f.title+', front cover':'Front cover',340)}</td></tr>`);
    for(let i=2;i<n-2;i+=2){const page=i/2;rows.push(`<tr><td width="50%" valign="top" style="padding:0 1px 12px 0;">${pic(i,`Page ${page}, picture`,290)}</td><td width="50%" valign="top" style="padding:0 0 12px 1px;">${pic(i+1,`Page ${page}, words`,290)}</td></tr>`);}
    rows.push(`<tr><td colspan="2" align="center" style="padding:2px 0 0;">${pic(n-1,'Back cover',340)}</td></tr>`);}
  const p=(t,extra='')=>`<p style="margin:0 0 16px;color:#3c352f;font:16px/1.65 ${sans};${extra}">${t}</p>`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)} | Craven &amp; Quill</title></head>
<body style="margin:0;padding:0;background:#efeae0;color:#211d1a;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:#efeae0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Every page of ${esc(who)} book, ready to see.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#efeae0;"><tr><td align="center" style="padding:20px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;max-width:600px;background:#fffdfa;">
<tr><td align="center" style="padding:26px 20px 20px;border-bottom:1px solid #e9dec7;"><a href="https://cravenandquill.com"><img src="${LOGO}" width="140" alt="Craven &amp; Quill" style="display:block;width:140px;height:auto;border:0;color:#211d1a;font:21px ${serif};"></a></td></tr>
<tr><td style="padding:30px 28px 8px;">${[hi,...(x.note?[x.note]:[]),...lines].map(t=>p(esc(t))).join('')}</td></tr>
${n?`<tr><td style="padding:8px 10px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${rows.join('')}</table></td></tr>`:''}
<tr><td style="padding:8px 28px 34px;">${offer?p(esc(offer),`color:#211d1a;font-size:17px;`):''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:6px 0 12px;"><tr><td bgcolor="${GOLD}" align="center" style="border-radius:6px;background:${GOLD};"><a href="${esc(url)}" style="display:block;padding:20px 24px;color:#ffffff;text-decoration:none;font:700 19px/1.25 ${sans};">${esc(button)}</a></td></tr></table>
${p(esc(small),'margin:0 0 28px;color:#655a50;font-size:14px;text-align:center;')}
${p('Thank you,<br>The Craven &amp; Quill team')}</td></tr>
<tr><td style="padding:22px 28px 30px;border-top:1px solid #e9dec7;background:#faf7f0;"><p style="margin:0 0 8px;color:#655a50;font:13px/1.55 ${sans};">Craven &amp; Quill. Personalised books, made for one reader at a time.</p><p style="margin:0;color:#8a7f73;font:12px/1.55 ${sans};">The pictures and button open your private book page. Please don’t forward this email.</p></td></tr>
</table></td></tr></table></body></html>`;
  const text=[hi,...(x.note?[x.note]:[]),...lines,`See every page: ${url}`,offer,`${button}: ${url}`,small,'Thank you,\nThe Craven & Quill team'].filter(Boolean).join('\n\n');
  return {subject:'Craven & Quill: '+subject,text,html,key:`${o.id}:preview:${d.preview?.hash}`};
}

export function orderEmail(o,kind,url){
  if(kind==='preview')return previewEmail(o,url);
  const c=copy(o,kind),f=facts(o);
  const text=c.simple?[...c.introText,`${c.button}: ${url}`,...c.afterText].join('\n\n'):[c.heading,...c.introText,c.steps.map(([w,t])=>`${w}: ${t}`).join('\n'),
    [f.title?`Book: ${f.title}`:'',`Format: ${f.label}`,`Paid: ${f.paid} including UK standard delivery`,f.to?`Posting to: ${f.to}`:'',`Order ref: ${f.ref}`].filter(Boolean).join('\n'),
    `${c.button}: ${c.buttonUrl||url}`,c.buttonUrl?`Your order: ${url}`:'',c.note,'This link is private to you. Please don’t forward it.\nQuestions? Just reply to this email.\n\nCraven & Quill'].filter(Boolean).join('\n\n');
  return {subject:'Craven & Quill: '+c.subject,text,html:html(o,c,url),key:`${o.id}:${kind}:${kind==='proof'?o.data.proof?.hash:'1'}`};
}

export async function sendOrderEmail(env,o,kind,url,test=null){if(!env.RESEND_API_KEY||!env.ORDER_EMAIL_FROM)return {sent:false,message:'Order email is not connected. Use your private order link.'};const message=orderEmail(o,kind,url);try{const r=await (env.fetch||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':test?message.key+'-test-'+Date.now():message.key},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,reply_to:env.ORDER_EMAIL_REPLY_TO||'cravenluke@gmail.com',to:[test?test.to:o.email],subject:(test?'[Test] ':'')+message.subject,html:message.html,text:message.text}),signal:AbortSignal.timeout(15000)});const d=await r.json();return {sent:!!(r.ok&&d.id),providerId:r.ok?d.id:null,kind,proofHash:kind==='proof'?o.data.proof?.hash:null,message:r.ok&&d.id?'Email accepted by provider; inbox delivery not yet confirmed.':'Email was not accepted. Retry from the order desk.'};}catch{return {sent:false,kind,message:'Email could not be confirmed. Retry from the order desk.'};}}
