(()=>{
  const query=new URLSearchParams(location.search);
  const AD_VERSION='ads-2026-11-06',privatePage=/\/order(?:\.html)?$/.test(location.pathname);
  const click=value=>/^[a-zA-Z0-9_-]{1,500}$/.test(value||'')?value:null;
  const safe=value=>/^[a-zA-Z0-9_.-]{1,100}$/.test(value||'')?value:'';
  const pathName=path=>path.replace(/\.html$/,'').replace(/\/$/,'')||'/';
  const landingPages=new Map([
    ['/','home'],['/index','home'],['/create','maker'],['/ordering','ordering'],
    ['/personalised-birthday-book','birthday'],['/examples/the-map-beneath-the-moon','amara'],
    ['/personalised-childrens-books','kids'],
    ['/personalised-books-for-adults','adults'],
    ['/personalised-christmas-book','christmas'],
    ['/example-books','shelf'],
    ['/examples/the-last-christmas-lantern','lantern'],
    ['/examples/oliver-and-the-cake-that-wouldnt-wait','oliver'],
    ['/examples/the-cake-that-quit','luke'],
    ['/examples/noah-and-the-little-cloud','noah']
  ]);
  function publicPage(url){
    const path=pathName(url.pathname);
    if(path==='/test-book'){
      const sample=url.searchParams;
      if(sample.get('sample')==='1'&&!sample.has('embed')&&!sample.has('order')&&['amara','noah','oliver','luke'].includes(sample.get('book')))return 'sample';
      return null;
    }
    return landingPages.get(path)||null;
  }
  const page=publicPage(new URL(location.href));
  if(pathName(location.pathname)==='/test-book'&&!page)return;
  const infoPage=Boolean(page && !['home','maker'].includes(page));
  // Store only a known engine and a public page code. Search terms and referrer URLs never leave the page.
  const searchHosts=new Map([
    ['google.co.uk','google'],['google.com','google'],['google.ie','google'],['google.fr','google'],
    ['bing.com','bing'],['duckduckgo.com','duckduckgo'],['search.yahoo.com','yahoo'],['uk.search.yahoo.com','yahoo'],
    ['ecosia.org','ecosia'],['search.brave.com','brave'],['startpage.com','startpage']
  ]);
  let referrer=null;
  try{referrer=new URL(document.referrer);}catch{}
  const external=referrer&&referrer.origin!==location.origin;
  const engine=external&&searchHosts.get(referrer.hostname.replace(/^www\./,''));
  let attribution={source:safe(query.get('utm_source'))||'direct',medium:safe(query.get('utm_medium'))||'none',campaign:safe(query.get('utm_campaign'))||'unattributed',creative:safe(query.get('utm_content'))||'none'};
  // First-party visit measurement works for everyone and uses no cookies or device storage: the
  // visit's random reference travels in the page link (?v=) so a reload or the home-to-maker link
  // keeps one journey together. Advertising identifiers use storage unless measurement is turned off.
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let visitId=(query.get('v')||'').toLowerCase();if(!UUID.test(visitId))visitId=crypto.randomUUID();
  // Advertising measurement (Google tag, Meta pixel) is on for everyone unless the visitor turned it
  // off: ?measurement=no on any page (the privacy page links to it), remembered in local storage.
  let preference='ads';try{const asked=query.get('measurement');if(asked==='no'||asked==='ads'){preference=asked;localStorage.setItem('cq-measurement-v3',asked);}else if(localStorage.getItem('cq-measurement-v3')==='no'||localStorage.getItem('cq-measurement-v2')==='no')preference='no';}catch{}
  let adClick={gclid:click(query.get('gclid')),gbraid:click(query.get('gbraid')),wbraid:click(query.get('wbraid')),fbclid:click(query.get('fbclid'))};
  const hasNewClick=Boolean(adClick.gclid||adClick.gbraid||adClick.wbraid),hasAnyClick=hasNewClick||Boolean(adClick.fbclid);
  const googleCreative=['g_birthday','g_christmas','g_grandchild','g_adult'].includes(attribution.creative);
  // Some paid links carry campaign markers without a Google or Meta conversion identifier.
  const paidEngine=hasNewClick||googleCreative||click(query.get('dclid'))||/^\d+$/.test(query.get('gad_source')||'')?'google':click(query.get('msclkid'))?'bing':null;
  const tagged=['utm_source','utm_medium','utm_campaign','utm_content'].some(key=>safe(query.get(key)));
  const validEntries=new Set([...landingPages.values(),'sample']);
  const previousSearch=history.state?.cqSearch;
  let search=null;
  if(page&&!tagged&&!hasAnyClick&&!paidEngine){
    if(engine)search={engine,entry:page};
    else if(!external&&query.get('v')===visitId){
      const saved=previousSearch?.visitId===visitId?previousSearch:null;
      const engine=query.get('cq_search')||saved?.engine,entry=query.get('cq_entry')||saved?.entry;
      if([...searchHosts.values()].includes(engine)&&validEntries.has(entry))search={engine,entry};
    }
  }
  if(search){
    attribution={source:'organic_search',medium:'organic',campaign:search.engine,creative:'seo_'+search.entry};
  }else if(attribution.source==='direct'&&paidEngine){
    attribution={...attribution,source:paidEngine,medium:'cpc',campaign:googleCreative?'cq_gifts':paidEngine+'_untagged'};
  }else if(attribution.source==='direct'&&adClick.fbclid){
    attribution={...attribution,source:'facebook',medium:'referral'};
  }else if(page&&!tagged&&external){
    attribution={...attribution,source:'referral',medium:'referral'};
  }else if(!tagged&&!hasAnyClick&&preference==='ads'){
    try{
      const saved=JSON.parse(localStorage.getItem('cq-ad-click-v1')||'null');
      if(saved?.attribution&&saved.expires>Date.now()){adClick={fbclid:null,...saved.click};attribution=saved.attribution;}
    }catch{}
  }
  if(query.get('v')!==visitId||search){
    try{const url=new URL(location.href);url.searchParams.set('v',visitId);
      history.replaceState({...history.state,cqSearch:search?{...search,visitId}:null},'',url);
    }catch{}
  }
  function persistClick(){
    if(preference!=='ads')return;
    try{
      if(search||(page&&!tagged&&!hasAnyClick&&!paidEngine&&external))localStorage.removeItem('cq-ad-click-v1');
      else if(hasAnyClick||tagged||paidEngine)localStorage.setItem('cq-ad-click-v1',JSON.stringify({click:adClick,attribution,expires:Date.now()+30*86400000}));
    }catch{}
  }
  let pixelId=null,pixelStarted=false,configPromise=null;const sent=new Set(),counted=new Set(),leadSent=new Set();
  // Returning visitors: one random reference kept on this device for 30 days (not with measurement turned off),
  // so a parent who comes back from a reminder ad or email is counted as coming back, not as a stranger.
  let personId=null;if(preference==='ads'){try{const p=JSON.parse(localStorage.getItem('cq-person-v1')||'null');if(p&&UUID.test(p.id||'')&&p.expires>Date.now())personId=p.id;else personId=crypto.randomUUID();localStorage.setItem('cq-person-v1',JSON.stringify({id:personId,expires:Date.now()+30*86400000}));}catch{personId=null;}}
  function context(){return{...attribution,measurementConsent:true,visitId,...(personId?{personId}:{}),...(preference==='ads'?{advertisingConsent:true,advertisingConsentVersion:AD_VERSION,...adClick}:{})};}
  // Daily totals per step, with no visitor reference at all: a second, simpler count to check the journeys against.
  function count(event){
    if(counted.has(event)||event.startsWith('device_'))return;counted.add(event);
    fetch('/api/visit-count',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...attribution,event}),keepalive:true}).catch(()=>{});
  }
  function record(event,detail){
    count(event);
    if(sent.has(event))return;sent.add(event);
    fetch('/api/campaign-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context(),event,...(typeof detail==='string'&&detail?{detail:detail.slice(0,300)}:{})}),keepalive:true}).then(response=>{if(!response.ok)sent.delete(event);}).catch(()=>sent.delete(event));
  }
  async function startPixel(){
    if(preference!=='ads'||privatePage||infoPage)return false;
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
  // A free character was drawn. Sent once per visit as Meta's standard CompleteRegistration so ads can
  // aim at people who make a character, not just people who tap. No name, photo, story or email is sent.
  let characterSent=false;
  async function characterMade(){
    if(characterSent||preference!=='ads'||attribution.source==='qa'||/^qa(?:[_.-]|$)/.test(attribution.campaign))return;
    characterSent=true;
    if(!await startPixel()||preference!=='ads'){characterSent=false;return;}
    window.fbq('trackSingle',pixelId,'CompleteRegistration',{content_name:'free_character'},{eventID:'character-'+visitId});
  }
  let googleStarted=false,googleConfig=null;
  const googleSent=new Set();
  const cleanPage=()=>{const url=new URL(location.origin+(privatePage?'/order':location.pathname));for(const key of ['gclid','gbraid','wbraid'])if(click(adClick[key]))url.searchParams.set(key,adClick[key]);return url.href;};
  async function startGoogle(allowPrivate=false){
    if(preference!=='ads'||infoPage||(privatePage&&!allowPrivate)||!['cravenandquill.com','www.cravenandquill.com'].includes(location.hostname)||attribution.source==='qa'||/^qa(?:[_.-]|$)/.test(attribution.campaign)||attribution.campaign==='tracking_test')return false;
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
    if(!await startGoogle(kind==='purchase')||preference!=='ads')return;
    const sendTo=googleConfig[kind];if(!sendTo||!sendTo.startsWith(googleConfig.tagId+'/'))return;
    const id=kind+':'+receipt.eventId;if(googleSent.has(id))return;googleSent.add(id);
    // Google deduplicates repeats across reloads AND the server feed using this same ID.
    // Queued does not mean delivered. Never persist a misleading 'sent' acknowledgement.
    window.gtag('event','conversion',{send_to:sendTo,transaction_id:receipt.eventId,value:receipt.value,currency:'GBP',page_location:cleanPage(),page_referrer:''});
  }
  // Microsoft Clarity: replays of public pages so the owner can see where people get stuck.
  // Typed text is masked, and uploaded photos, emails and addresses are hidden (data-clarity-mask). Characters and story pages show, so the owner can check them.
  let clarityStarted=false;
  async function startClarity(){
    if(preference!=='ads'||privatePage||infoPage||clarityStarted||!['cravenandquill.com','www.cravenandquill.com'].includes(location.hostname)||attribution.source==='qa'||/^qa(?:[_.-]|$)/.test(attribution.campaign))return;
    if(!configPromise)configPromise=fetch('/api/ad-config').then(r=>r.ok?r.json():{}).catch(()=>({}));
    const id=(await configPromise).clarityId;
    if(preference!=='ads'||clarityStarted||!/^[a-z0-9]{6,20}$/i.test(id||''))return;
    clarityStarted=true;
    window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};
    const script=document.createElement('script');script.async=true;script.src='https://www.clarity.ms/tag/'+id;document.head.append(script);
    window.clarity('consent');
    // Same random visit reference as the owner dashboard, so a journey there can be found in Clarity.
    window.clarity('set','visit',visitId);window.clarity('set','source',attribution.source);window.clarity('set','ad',attribution.creative);
  }
  function revokePixel(){
    if(clarityStarted)window.clarity('consent',false);
    if(pixelStarted)window.fbq('consent','revoke');
    if(googleStarted)window.gtag('consent','update',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    const names=['_fbp','_fbc',...document.cookie.split(';').map(x=>x.trim().split('=')[0]).filter(x=>x.startsWith('_gcl_'))];
    try{localStorage.removeItem('cq-ad-click-v1');}catch{}
    adClick={gclid:null,gbraid:null,wbraid:null,fbclid:null};
    fetch('/api/ad-revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitId}),keepalive:true}).catch(()=>{});
    for(const name of names)for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax'+(domain?'; Domain='+domain:'');
  }
  // Keep crawlable links clean until the visitor follows them. Only our public shopping pages
  // receive the visit and attribution codes. Never copy arbitrary query parameters or fragments.
  document.querySelectorAll('a[href]').forEach(link=>{
    const href=link.getAttribute('href');
    if(!href||href.startsWith('#'))return;
    const target=new URL(href,location.href);
    if(target.origin!==location.origin||!publicPage(target))return;
    const validStoryChoice=pathName(target.pathname)==='/create' && ['kids','adults','birthday','christmas','noah','amara','oliver','luke'].includes(target.searchParams.get('like')) && target.searchParams.getAll('like').length===1;
    if([...target.searchParams.keys()].some(key=>!['sample','book'].includes(key)&&!(key==='like'&&validStoryChoice))||target.hash.includes('='))return;
    const keys={source:'utm_source',medium:'utm_medium',campaign:'utm_campaign',creative:'utm_content'};
    const carry=()=>{
      const url=new URL(target);
      url.searchParams.set('v',visitId);
      if(search){
        url.searchParams.set('cq_search',search.engine);url.searchParams.set('cq_entry',search.entry);
      }else if(attribution.source!=='direct'||tagged){
        for(const [field,key] of Object.entries(keys))if(safe(attribution[field]))url.searchParams.set(key,attribution[field]);
      }
      if(preference==='ads')for(const key of ['fbclid','gclid','gbraid','wbraid'])if(click(adClick[key]))url.searchParams.set(key,adClick[key]);
      link.href=url.pathname+url.search+url.hash;
    };
    for(const event of ['pointerdown','contextmenu','click'])link.addEventListener(event,carry);
  });
  function choose(choice){if(!['no','ads'].includes(choice))return;preference=choice;try{localStorage.setItem('cq-measurement-v3',choice);}catch{}if(choice!=='ads'){revokePixel();personId=null;try{localStorage.removeItem('cq-person-v1');}catch{}}else{persistClick();void startPixel();void startGoogle();void startClarity();}}
  window.cqMeasurement={record,context,savedLead,characterMade,choose,previewLead:receipt=>googleConversion('lead',receipt),purchase:receipt=>googleConversion('purchase',receipt)};
  if(!privatePage&&referrer?.origin!==location.origin)count('arrive');
  if(!privatePage){record(location.pathname.includes('create')?'maker_start':'landing_view');record(matchMedia('(max-width:779px)').matches?'device_mobile':'device_desktop');}
  if(preference==='ads'){persistClick();void startPixel();void startGoogle();void startClarity();}
})();
