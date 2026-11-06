(()=>{
  const query=new URLSearchParams(location.search);
  const AD_VERSION='ads-2026-11-06',privatePage=/\/order(?:\.html)?$/.test(location.pathname);
  const click=value=>/^[a-zA-Z0-9_-]{1,500}$/.test(value||'')?value:null;
  const safe=value=>/^[a-zA-Z0-9_.-]{1,100}$/.test(value||'')?value:'';
  let attribution={source:safe(query.get('utm_source'))||'direct',medium:safe(query.get('utm_medium'))||'none',campaign:safe(query.get('utm_campaign'))||'organic',creative:safe(query.get('utm_content'))||'none'};
  // First-party visit measurement works for everyone and uses no cookies or device storage: the
  // visit's random reference travels in the page link (?v=) so a reload or the home-to-maker link
  // keeps one journey together. Advertising identifiers use storage only after explicit consent.
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let visitId=(query.get('v')||'').toLowerCase();if(!UUID.test(visitId))visitId=crypto.randomUUID();
  if(query.get('v')!==visitId){try{const url=new URL(location.href);url.searchParams.set('v',visitId);history.replaceState(history.state,'',url);}catch{}}
  let preference='';try{preference=localStorage.getItem('cq-measurement-v3')||(localStorage.getItem('cq-measurement-v2')==='no'?'no':'');}catch{}
  let adClick={gclid:click(query.get('gclid')),gbraid:click(query.get('gbraid')),wbraid:click(query.get('wbraid'))};
  const hasNewClick=Object.values(adClick).some(Boolean);
  if(preference==='ads'){try{const saved=JSON.parse(localStorage.getItem('cq-ad-click-v1')||'null');if(!hasNewClick&&!query.has('utm_source')&&saved?.expires>Date.now()){adClick=saved.click;attribution=saved.attribution;}}catch{}}
  if((hasNewClick||['g_birthday','g_christmas','g_grandchild','g_adult'].includes(attribution.creative))&&attribution.source==='direct'){attribution={...attribution,source:'google',medium:'cpc',campaign:['g_birthday','g_christmas','g_grandchild','g_adult'].includes(attribution.creative)?'cq_gifts':'google_untagged'};}
  function persistClick(){if(preference!=='ads')return;try{if(hasNewClick||query.has('utm_source'))localStorage.setItem('cq-ad-click-v1',JSON.stringify({click:adClick,attribution,expires:Date.now()+30*86400000}));}catch{}}
  let pixelId=null,pixelStarted=false,configPromise=null;const sent=new Set(),counted=new Set(),leadSent=new Set();
  function context(){return{...attribution,measurementConsent:true,visitId,...(preference==='ads'?{advertisingConsent:true,advertisingConsentVersion:AD_VERSION,...adClick}:{})};}
  // Daily totals per step, with no visitor reference at all: a second, simpler count to check the journeys against.
  function count(event){
    if(counted.has(event)||event.startsWith('device_'))return;counted.add(event);
    fetch('/api/visit-count',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...attribution,event}),keepalive:true}).catch(()=>{});
  }
  function record(event){
    count(event);
    if(sent.has(event))return;sent.add(event);
    fetch('/api/campaign-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context(),event}),keepalive:true}).then(response=>{if(!response.ok)sent.delete(event);}).catch(()=>sent.delete(event));
  }
  async function startPixel(){
    if(preference!=='ads'||privatePage)return false;
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
    if(preference!=='ads'||!UUID.test(eventId||'')||leadSent.has(eventId))return;
    try{if(sessionStorage.getItem('cq-lead-'+eventId))return;}catch{}
    if(!await startPixel()||preference!=='ads')return;
    leadSent.add(eventId);try{sessionStorage.setItem('cq-lead-'+eventId,'1');}catch{}
    // A random receipt identifies the same save on retries. No email, name, image,
    // story, reading age or purchase value is supplied to Meta. This is not a sale.
    window.fbq('trackSingle',pixelId,'Lead',{}, {eventID:eventId});
  }
  let googleStarted=false,googleConfig=null;
  const googleSent=new Set();
  const cleanPage=()=>{const url=new URL(location.origin+(privatePage?'/order':location.pathname));for(const key of ['gclid','gbraid','wbraid'])if(click(adClick[key]))url.searchParams.set(key,adClick[key]);return url.href;};
  async function startGoogle(){
    if(preference!=='ads'||privatePage||!['cravenandquill.com','www.cravenandquill.com'].includes(location.hostname)||attribution.source==='qa'||/^qa(?:[_.-]|$)/.test(attribution.campaign)||attribution.campaign==='tracking_test')return false;
    if(!configPromise)configPromise=fetch('/api/ad-config').then(r=>r.ok?r.json():{}).catch(()=>({}));
    const config=await configPromise;
    if(preference!=='ads'||!/^AW-\d{5,20}$/.test(config.google?.tagId||''))return false;
    googleConfig=config.google;
    if(!googleStarted){
      window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
      window.gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      window.gtag('set','ads_data_redaction',true);
      // Never let private URLs, fragments, page titles, or automatic form data enter ad events.
      window.gtag('set',{page_location:cleanPage(),page_referrer:'',page_title:'Craven & Quill',allow_ad_personalization_signals:false,allow_enhanced_conversions:false});
      window.gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied',analytics_storage:'denied'});
      window.gtag('js',new Date());
      window.gtag('config',googleConfig.tagId,{send_page_view:false,allow_enhanced_conversions:false,allow_ad_personalization_signals:false});
      const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+googleConfig.tagId;
      script.onerror=()=>{googleStarted=false;configPromise=null;};document.head.append(script);googleStarted=true;
    }else window.gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied',analytics_storage:'denied'});
    return true;
  }
  async function googleConversion(kind,receipt){
    if(!receipt||!/^([a-f0-9-]{36}|[a-f0-9]{64})$/.test(receipt.eventId||'')||!Number.isFinite(receipt.value)||receipt.value<0)return;
    if(!await startGoogle()||preference!=='ads')return;
    const sendTo=googleConfig[kind];if(!sendTo||!sendTo.startsWith(googleConfig.tagId+'/'))return;
    const id=kind+':'+receipt.eventId;if(googleSent.has(id))return;googleSent.add(id);
    // Google deduplicates repeats across reloads AND the server feed using this same ID.
    // Queued does not mean delivered. Never persist a misleading 'sent' acknowledgement.
    window.gtag('event','conversion',{send_to:sendTo,transaction_id:receipt.eventId,value:receipt.value,currency:'GBP',page_location:cleanPage(),page_referrer:''});
  }
  function revokePixel(){
    if(pixelStarted)window.fbq('consent','revoke');
    if(googleStarted)window.gtag('consent','update',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    const names=['_fbp','_fbc',...document.cookie.split(';').map(x=>x.trim().split('=')[0]).filter(x=>x.startsWith('_gcl_'))];
    try{localStorage.removeItem('cq-ad-click-v1');}catch{}
    adClick={gclid:null,gbraid:null,wbraid:null};
    fetch('/api/ad-revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitId}),keepalive:true}).catch(()=>{});
    for(const name of names)for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax'+(domain?'; Domain='+domain:'');
  }
  document.querySelectorAll('a[href="create.html"],a[href="/create"]').forEach(link=>{
    const url=new URL(link.getAttribute('href'),location.href);
    for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']){const value=safe(query.get(key));if(value)url.searchParams.set(key,value);}
    url.searchParams.set('v',visitId);
    // Preserve Meta's ad-click identifier in the URL only. Meta may use it only
    // if the visitor subsequently permits advertising measurement.
    for(const key of ['fbclid','gclid','gbraid','wbraid']){const id=query.get(key);if(id&&/^[a-zA-Z0-9_.-]{1,500}$/.test(id))url.searchParams.set(key,id);}
    link.href=url.pathname+url.search;
  });
  const banner=document.createElement('section');banner.setAttribute('aria-label','Cookie choices');banner.className='cq-measurement';
  // In normal document flow, never covering the maker's Continue button.
  banner.hidden=!!preference;
  banner.innerHTML='<div><strong>Optional ad measurement</strong><p>May Google and Meta use cookies to measure which ads lead to previews and purchases? We share ad references and order totals, never your email, photos, names or story. Your choice does not affect your book. <a href="/privacy.html">Privacy details</a></p></div><div><button type="button" data-choice="ads">Allow ad measurement</button><button type="button" data-choice="no">No thanks</button></div>';
  document.body.prepend(banner);
  const style=document.createElement('style');style.textContent='.cq-measurement{position:relative;z-index:2;margin:12px auto;max-width:700px;box-sizing:border-box;width:calc(100% - 24px);max-height:75vh;overflow:auto;border:1px solid #dce2da;border-radius:20px;background:#fff;box-shadow:0 8px 40px #17332c25;color:#17332c;padding:18px;font:16px/1.4 Figtree,Arial,sans-serif}.cq-measurement[hidden]{display:none}.cq-measurement p{margin:4px 0 0}.cq-measurement a{color:inherit;text-decoration:underline}.cq-measurement>div:last-child{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cq-measurement button{border:1px solid #17332c;background:#fff;color:#17332c;padding:12px 14px;border-radius:999px;font:600 14px Figtree,Arial,sans-serif;cursor:pointer}';document.head.append(style);
  banner.addEventListener('click',event=>{const choice=event.target.dataset.choice;if(!['no','ads'].includes(choice))return;preference=choice;try{localStorage.setItem('cq-measurement-v3',choice);}catch{}banner.hidden=true;if(choice!=='ads')revokePixel();else{persistClick();void startPixel();void startGoogle();}});
  document.querySelectorAll('.measurement-settings').forEach(button=>button.addEventListener('click',()=>{banner.hidden=false;banner.scrollIntoView?.({behavior:'smooth',block:'start'});}));
  window.cqMeasurement={record,context,savedLead,previewLead:receipt=>googleConversion('lead',receipt)};
  let arrivedFrom='';try{arrivedFrom=document.referrer?new URL(document.referrer).origin:'';}catch{}
  if(!privatePage&&arrivedFrom!==location.origin)count('arrive');
  if(!privatePage){record(location.pathname.includes('create')?'maker_start':'landing_view');record(matchMedia('(max-width:779px)').matches?'device_mobile':'device_desktop');}
  if(preference==='ads'){persistClick();void startPixel();void startGoogle();}
})();
