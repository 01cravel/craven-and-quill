(()=>{
  const query=new URLSearchParams(location.search);
  const safe=value=>/^[a-zA-Z0-9_.-]{1,100}$/.test(value||'')?value:'';
  const attribution={source:safe(query.get('utm_source'))||'direct',medium:safe(query.get('utm_medium'))||'none',campaign:safe(query.get('utm_campaign'))||'organic',creative:safe(query.get('utm_content'))||'none'};
  let preference='';try{preference=localStorage.getItem('cq-measurement-v1')||'';}catch{}
  let visitId=null;const sent=new Set();const pending=new Set();
  const getVisit=()=>{if(!visitId){try{visitId=sessionStorage.getItem('cq-visit-v1');}catch{}if(!/^[0-9a-f-]{36}$/.test(visitId||''))visitId=crypto.randomUUID();try{sessionStorage.setItem('cq-visit-v1',visitId);}catch{}}return visitId;};
  function context(){return{...attribution,measurementConsent:preference==='yes',visitId:preference==='yes'?getVisit():null};}
  function record(event){
    if(preference==='no')return;
    if(preference!=='yes'){pending.add(event);return;}
    if(sent.has(event))return;sent.add(event);
    fetch('/api/campaign-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context(),event}),keepalive:true}).then(response=>{if(!response.ok)sent.delete(event);}).catch(()=>sent.delete(event));
  }
  // Campaign codes travel in the URL; no email, child name, story or photo is measured.
  document.querySelectorAll('a[href="create.html"],a[href="/create"]').forEach(link=>{
    const url=new URL(link.getAttribute('href'),location.href);
    for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']){const value=safe(query.get(key));if(value)url.searchParams.set(key,value);}
    link.href=url.pathname+url.search;
  });
  const banner=document.createElement('section');banner.setAttribute('aria-label','Optional visit measurement');banner.className='cq-measurement';banner.hidden=Boolean(preference);
  banner.innerHTML='<div><strong>Help us improve the preview?</strong><p>Allow visit measurement. It includes no photos, names or story text. <a href="privacy.html">Privacy details</a></p></div><div><button type="button" data-choice="no">No thanks</button><button type="button" data-choice="yes">Allow measurement</button></div>';
  document.body.append(banner);
  const style=document.createElement('style');style.textContent='.cq-measurement{position:fixed;z-index:100;bottom:12px;left:12px;right:12px;margin:auto;max-width:700px;border:1px solid #dce2da;border-radius:20px;background:#fff;box-shadow:0 8px 40px #17332c25;color:#17332c;padding:18px;font:15px/1.4 Figtree,Arial,sans-serif;display:flex;gap:18px;align-items:center}.cq-measurement[hidden]{display:none}.cq-measurement p{margin:4px 0 0}.cq-measurement a{color:inherit;text-decoration:underline}.cq-measurement>div:last-child{display:flex;gap:8px;flex-shrink:0}.cq-measurement button{border:1px solid #17332c;background:#fff;color:#17332c;padding:10px 12px;border-radius:999px;font:600 13px Figtree,Arial,sans-serif;cursor:pointer}.cq-measurement button:last-child{background:#17332c;color:white}@media(max-width:600px){.cq-measurement{display:block}.cq-measurement>div:last-child{margin-top:12px}}';document.head.append(style);
  banner.addEventListener('click',event=>{const choice=event.target.dataset.choice;if(!choice)return;preference=choice;try{localStorage.setItem('cq-measurement-v1',choice);if(choice==='no')sessionStorage.removeItem('cq-visit-v1');}catch{}banner.hidden=true;if(choice==='yes'){for(const event of pending)record(event);}pending.clear();});
  document.querySelectorAll('.measurement-settings').forEach(button=>button.addEventListener('click',()=>{banner.hidden=false;}));
  window.cqMeasurement={record,context};
  record(location.pathname.includes('create')?'maker_start':'landing_view');
})();
