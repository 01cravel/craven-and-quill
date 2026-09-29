(()=>{
  const query=new URLSearchParams(location.search);
  const safe=value=>/^[a-zA-Z0-9_.-]{1,100}$/.test(value||'')?value:'';
  const attribution={source:safe(query.get('utm_source'))||'direct',medium:safe(query.get('utm_medium'))||'none',campaign:safe(query.get('utm_campaign'))||'organic',creative:safe(query.get('utm_content'))||'none'};
  // Consent for earlier first-party-only measurement never authorises Meta.
  let preference='';try{preference=localStorage.getItem('cq-measurement-v2')||'';if(!preference&&localStorage.getItem('cq-measurement-v1')==='no')preference='no';}catch{}
  let visitId=null,pixelId=null,pixelStarted=false,configPromise=null;const sent=new Set(),pending=new Set(),leadSent=new Set();
  const siteAllowed=()=>preference==='site'||preference==='ads';
  const getVisit=()=>{if(!visitId){try{visitId=sessionStorage.getItem('cq-visit-v1');}catch{}if(!/^[0-9a-f-]{36}$/.test(visitId||''))visitId=crypto.randomUUID();try{sessionStorage.setItem('cq-visit-v1',visitId);}catch{}}return visitId;};
  function context(){return{...attribution,measurementConsent:siteAllowed(),visitId:siteAllowed()?getVisit():null};}
  function record(event){
    if(preference==='no')return;
    if(!siteAllowed()){pending.add(event);return;}
    if(sent.has(event))return;sent.add(event);
    fetch('/api/campaign-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context(),event}),keepalive:true}).then(response=>{if(!response.ok)sent.delete(event);}).catch(()=>sent.delete(event));
  }
  async function startPixel(){
    if(preference!=='ads')return false;
    if(!configPromise)configPromise=fetch('/api/ad-config').then(r=>r.ok?r.json():{}).catch(()=>({}));
    const config=await configPromise;
    if(preference!=='ads'||!/^\d{5,30}$/.test(config.pixelId||''))return false;
    pixelId=config.pixelId;
    if(!pixelStarted){
      // No automatic form capture, advanced matching or user-supplied parameters.
      const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments);};
      fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];window.fbq=fbq;window._fbq=fbq;
      fbq('consent','grant');fbq('set','autoConfig',false,pixelId);fbq('init',pixelId);
      const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(script);
      pixelStarted=true;fbq('trackSingle',pixelId,'PageView');
    }else window.fbq('consent','grant');
    return true;
  }
  async function savedLead(eventId){
    if(preference!=='ads'||!/^[0-9a-f-]{36}$/.test(eventId||'')||leadSent.has(eventId))return;
    try{if(sessionStorage.getItem('cq-lead-'+eventId))return;}catch{}
    if(!await startPixel()||preference!=='ads')return;
    leadSent.add(eventId);try{sessionStorage.setItem('cq-lead-'+eventId,'1');}catch{}
    // A random receipt identifies the same save on retries. No email, name, image,
    // story, reading age or purchase value is supplied to Meta. This is not a sale.
    window.fbq('trackSingle',pixelId,'Lead',{}, {eventID:eventId});
  }
  function revokePixel(){
    if(pixelStarted)window.fbq('consent','revoke');
    for(const name of ['_fbp','_fbc'])for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax'+(domain?'; Domain='+domain:'');
  }
  document.querySelectorAll('a[href="create.html"],a[href="/create"]').forEach(link=>{
    const url=new URL(link.getAttribute('href'),location.href);
    for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']){const value=safe(query.get(key));if(value)url.searchParams.set(key,value);}
    // Preserve Meta's ad-click identifier in the URL only. Meta may use it only
    // if the visitor subsequently permits advertising measurement.
    const click=query.get('fbclid');if(click&&/^[a-zA-Z0-9_.-]{1,500}$/.test(click))url.searchParams.set('fbclid',click);
    link.href=url.pathname+url.search;
  });
  const banner=document.createElement('section');banner.setAttribute('aria-label','Optional measurement');banner.className='cq-measurement';banner.hidden=Boolean(preference);
  banner.innerHTML='<div><strong>Your measurement choices</strong><p>Site measurement helps us improve the preview. Meta advertising measurement shares visits and completed signups with Meta, including browser and cookie identifiers. We do not send your photos, names, emails or story text in these events. Both are optional. <a href="privacy.html">Privacy details</a></p></div><div><button type="button" data-choice="no">No thanks</button><button type="button" data-choice="site">Site only</button><button type="button" data-choice="ads">Allow site &amp; Meta</button></div>';
  document.body.append(banner);
  const style=document.createElement('style');style.textContent='.cq-measurement{position:fixed;z-index:100;bottom:12px;left:12px;right:12px;margin:auto;max-width:700px;max-height:75vh;overflow:auto;border:1px solid #dce2da;border-radius:20px;background:#fff;box-shadow:0 8px 40px #17332c25;color:#17332c;padding:18px;font:16px/1.4 Figtree,Arial,sans-serif}.cq-measurement[hidden]{display:none}.cq-measurement p{margin:4px 0 0}.cq-measurement a{color:inherit;text-decoration:underline}.cq-measurement>div:last-child{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cq-measurement button{border:1px solid #17332c;background:#fff;color:#17332c;padding:12px 14px;border-radius:999px;font:600 14px Figtree,Arial,sans-serif;cursor:pointer}';document.head.append(style);
  banner.addEventListener('click',event=>{const choice=event.target.dataset.choice;if(!['no','site','ads'].includes(choice))return;preference=choice;try{localStorage.setItem('cq-measurement-v2',choice);if(choice==='no')sessionStorage.removeItem('cq-visit-v1');}catch{}banner.hidden=true;if(choice!=='ads')revokePixel();else void startPixel();if(siteAllowed())for(const event of pending)record(event);pending.clear();});
  document.querySelectorAll('.measurement-settings').forEach(button=>button.addEventListener('click',()=>{banner.hidden=false;}));
  window.cqMeasurement={record,context,savedLead};
  record(location.pathname.includes('create')?'maker_start':'landing_view');
  if(preference==='ads')void startPixel();
})();
