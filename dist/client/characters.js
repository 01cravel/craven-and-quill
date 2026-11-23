// Owner-only list of free previews: photo, character and first painted pages side by side.
(()=>{
  const list=document.getElementById('list'),message=document.getElementById('message'),days=document.getElementById('days');
  const SLOTS=[['photo1','Their photo'],['character','Character'],['page2','Page 2'],['page3','Page 3'],['page4','Page 4']];
  const when=iso=>new Date(iso).toLocaleString('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  async function load(range){
    message.hidden=false;message.textContent='Loading…';list.replaceChildren();
    const r=await fetch(`/api/owner-previews?days=${range}`,{credentials:'include'});
    if(r.status===401){message.innerHTML='Sign in first: <a href="/owner-login.html">open the owner sign-in</a>.';days.hidden=true;return;}
    const data=await r.json().catch(()=>({}));
    if(!r.ok){message.textContent=data.error||'Could not load the characters.';return;}
    days.hidden=false;
    if(!data.previews.length){message.textContent='No characters made in this period.';return;}
    message.textContent=`${data.previews.length} character${data.previews.length===1?'':'s'} made. Newest first.`;
    for(const p of data.previews){
      const row=el('article','cq-row');
      row.append(el('h2',null,p.email||'No email given'),el('p',null,when(p.at)));
      const strip=el('div','cq-strip');
      for(const [part,label] of SLOTS){
        const fig=el('figure',part==='photo1'?'photo':'');
        if(p.parts.includes(part)){
          const src=`/api/owner-preview-image?id=${p.id}&part=${part}`;
          const a=el('a');a.href=src;a.target='_blank';a.rel='noopener';
          const img=el('img');img.loading='lazy';img.alt=`${label} for ${p.email||'this preview'}`;img.src=src;a.append(img);fig.append(a);
        }else fig.append(el('div','cq-missing',part.startsWith('page')?'Not drawn or not kept':'Not kept'));
        fig.append(el('figcaption',null,label));strip.append(fig);
      }
      row.append(strip);list.append(row);
    }
  }
  days.addEventListener('click',e=>{const b=e.target.closest('button[data-days]');if(!b)return;days.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));load(b.dataset.days);});
  load(7);
})();
