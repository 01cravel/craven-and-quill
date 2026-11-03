// Owner analytics view. All visitor-supplied text is written with textContent, never as HTML.
const $=s=>document.querySelector(s),S={data:null,tab:'visits',search:''};
const ZONE='Europe/London';
const pounds=p=>p===null||p===undefined?'—':'£'+(p/100).toLocaleString('en-GB',{minimumFractionDigits:p%100?2:0,maximumFractionDigits:2});
const num=n=>n===null||n===undefined?'—':Number(n).toLocaleString('en-GB');
const when=s=>s?new Date(s).toLocaleString('en-GB',{timeZone:ZONE,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const ukDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE}).format(t);
const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const shortDay=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
const adName=c=>!c||c==='none'?'Not from an ad':c;
function E(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e;}
function msg(text,bad=false){$('#message').textContent=text;$('#message').classList.toggle('error',bad);}

// Tooltip shared by every chart mark. Marks carry their text in data-tip.
const tip=$('#tip');
document.addEventListener('pointermove',e=>{const t=e.target.closest?.('[data-tip]');if(!t){tip.hidden=true;return;}tip.textContent=t.dataset.tip;tip.hidden=false;const x=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8),y=e.clientY-tip.offsetHeight-12;tip.style.left=x+'px';tip.style.top=(y<4?e.clientY+18:y)+'px';});
document.addEventListener('focusin',e=>{const t=e.target.closest?.('[data-tip]');if(!t)return;const r=t.getBoundingClientRect();tip.textContent=t.dataset.tip;tip.hidden=false;tip.style.left=Math.min(r.left,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.max(4,r.top-tip.offsetHeight-8)+'px';});
document.addEventListener('focusout',()=>{tip.hidden=true;});

function params(){const p=new URLSearchParams({from:$('#from').value,to:$('#to').value});if($('#creative').value)p.set('creative',$('#creative').value);if($('#source').value)p.set('source',$('#source').value);return p;}
function setPreset(days){const to=ukDay(new Date());$('#to').value=to;$('#from').value=addDays(to,-(days-1));}
function markPreset(){const to=ukDay(new Date());for(const b of document.querySelectorAll('.presets button'))b.setAttribute('aria-pressed',String($('#to').value===to&&$('#from').value===addDays(to,-(Number(b.dataset.days)-1))));}

async function load(){
  markPreset();history.replaceState(null,'','?'+params());
  msg('Loading…');
  let r;try{r=await fetch('/api/owner-analytics?'+params(),{credentials:'same-origin'});}catch{msg('Could not reach the site. Check your connection and refresh.',true);return;}
  if(r.status===401){msg('Sign in with the owner email link to see analytics.',true);$('#signin').hidden=false;$('#filters').hidden=true;$('#report').hidden=true;return;}
  let d;try{d=await r.json();}catch{msg('The site sent back something unreadable. Refresh to try again.',true);return;}
  if(!r.ok){msg(d.error||'Analytics could not be loaded.',true);return;}
  S.data=d;$('#filters').hidden=false;$('#report').hidden=false;$('#signin').hidden=true;
  fillOptions(d);render(d);
  msg(`Showing ${shortDay(d.range.from)} to ${shortDay(d.range.to)}${d.filter.creative?', ad '+d.filter.creative:''}${d.filter.source?', source '+d.filter.source:''}. Updated ${when(d.generatedAt)}.`);
}
function fillOptions(d){
  for(const [id,list,first] of [['#creative',d.options.creatives,'All ads and visits'],['#source',d.options.sources,'All sources'],['#spend-creative',d.options.creatives.filter(c=>c!=='none'),'Whole campaign']]){
    const sel=$(id),keep=sel.value;sel.replaceChildren(E('option',first));sel.options[0].value=id==='#spend-creative'?'all':'';
    for(const v of list){const o=E('option',id==='#creative'?adName(v):v);o.value=v;sel.append(o);}
    if([...sel.options].some(o=>o.value===keep))sel.value=keep;
  }
}

function render(d){everyone(d);headline(d);funnel(d);ads(d);days(d);hours(d);breakdowns(d);tabs(d);spend(d);$('#notes').replaceChildren(...d.notes.map(n=>E('li',n)));}

function headline(d){
  const h=d.headline,f=d.filter.creative||d.filter.source;
  const items=[
    ['Visits',num(h.visits),'measured visitors'],
    ['Previews made',num(h.previewsMade),`${num(h.previewsTried)} tried, ${num(h.previewsFailed)} failed`],
    ['Emails left',num(h.previewEmails),h.launchSignups?`${num(h.launchSignups)} joined launch list`:'for a preview'],
    ['Books saved',num(h.booksSaved),h.quotes===null?'paid or not':`${num(h.quotes)} saw a price`],
    ['Sales',num(h.sales),h.testOrders?`${h.testOrders} test orders left out`:'paid, live'],
    ['Revenue',pounds(h.revenuePence),'from sales above',true],
    ['Ad spend',pounds(h.spendPence),h.spendPence?'entered by you':'none entered yet',true],
    ['Cost per visit',pounds(h.costPerVisitPence),'spend ÷ visits',true],
    ['Cost per sale',pounds(h.costPerSalePence),h.sales?'spend ÷ sales':'no sales yet',true],
  ];
  $('#headline').replaceChildren(...items.map(([label,value,note,money])=>{const box=E('div',undefined,money?'money':'');const dd=E('dd',value);dd.append(E('small',note));box.append(E('dt',label),dd);return box;}));
  if(f)$('#headline').firstChild.querySelector('small').textContent='from this ad or source';
}

function funnel(d){
  const top=d.funnel[0].visits||0,list=$('#funnel');list.replaceChildren();
  d.funnel.forEach((step,i)=>{
    const li=E('li',undefined,step.step==='paid'?'final':''),prev=i?d.funnel[i-1].visits:step.visits,lost=Math.max(0,prev-step.visits);
    const width=top?Math.max(step.visits/top*100,step.visits?1.5:0):0;
    const track=E('div',undefined,'track'),fill=E('div',undefined,'fill'+(width<14?' narrow':''));fill.style.width=width+'%';fill.style.setProperty('--w',width+'%');fill.append(E('span',num(step.visits)));
    track.append(fill);track.tabIndex=0;track.dataset.tip=`${step.label}: ${num(step.visits)} visits (${pct(step.visits,top)} of everyone)`;
    const l=E('div',undefined,'lost');if(i&&lost){l.textContent='−'+num(lost);l.append(E('small',pct(lost,prev)+' stopped'));}else if(i)l.append(E('small','none lost'));
    li.append(E('span',step.label,'name'),track,l);list.append(li);
  });
  const e=d.errorVisits;$('#funnel-errors').textContent=`${num(e.preview_error)} visits hit a preview error and ${num(e.checkout_error)} hit a payment page error. The Errors tab has times.`;
}

function ads(d){
  const body=$('#ads');body.replaceChildren();
  if(!d.ads.length){const tr=E('tr');const td=E('td','No measured visits in this range.','empty-row');td.colSpan=9;tr.append(td);body.append(tr);return;}
  for(const a of d.ads){
    const tr=E('tr',undefined,a.creative===d.filter.creative?'selected':'');
    const cells=[adName(a.creative),num(a.visits),num(a.previews),num(a.prices),num(a.checkouts),num(a.sales),a.spendPence?pounds(a.spendPence):'—',a.spendPence&&a.visits?pounds(Math.round(a.spendPence/a.visits)):'—',a.spendPence&&a.sales?pounds(Math.round(a.spendPence/a.sales)):'—'];
    cells.forEach((c,i)=>tr.append(E('td',c,i?'num':'')));body.append(tr);
  }
}

const SHORT={arrive:'Arrived',maker_start:'Opened maker',step_1:'Name',step_2:'Photo',preview_start:'Asked for preview',preview_success:'Got character',price_view:'Saw prices',checkout_start:'Pressed pay'};
function everyone(d){
  const e=d.everyone,head=$('#everyone-head'),body=$('#everyone');body.replaceChildren();head.replaceChildren();$('#everyone-note').textContent='';
  if(!e)return;
  head.append(E('th','Ad'),...e.steps.map(s=>{const th=E('th',SHORT[s.step]||s.label,'num');th.title=s.label;return th;}));
  const row=(name,counts,cls='')=>{
    const tr=E('tr',undefined,cls);tr.append(E('td',name));
    for(const s of e.steps){const n=counts[s.step]||0,td=E('td',num(n),'num');if(s.step!=='arrive'&&counts.arrive)td.append(E('small',pct(n,counts.arrive)));tr.append(td);}
    body.append(tr);
  };
  if(!e.ads.length){const tr=E('tr'),td=E('td','No visits counted in this range yet. Counting started on 3 November 2026.','empty-row');td.colSpan=e.steps.length+1;tr.append(td);body.append(tr);return;}
  for(const a of e.ads)row(adName(a.creative),a.counts,a.creative===d.filter.creative?'selected':'');
  if(e.ads.length>1)row('All',Object.fromEntries(e.steps.map(s=>[s.step,s.count])),'total');
  const arrived=e.steps[0].count,devices=e.devices.map(x=>`${x.key==='mobile'?'phones':x.key==='desktop'?'computers':x.key} ${pct(x.count,arrived)}`).join(', ');
  const recent=e.byDay.filter(x=>x.arrived).slice(-7).map(x=>`${shortDay(x.day)} ${num(x.arrived)}`).join(', ');
  $('#everyone-note').textContent=[devices&&`Arrived on ${devices}.`,recent&&`Arrivals by day: ${recent}.`].filter(Boolean).join(' ');
}

function columns(root,items,{label,value,part,tip,axis}){
  root.replaceChildren();const max=Math.max(1,...items.map(value));
  root.setAttribute('aria-label',items.map(x=>tip(x)).join('; '));
  root.append(E('span','max '+num(max),'chart-max'));
  for(const x of items){
    const col=E('div',undefined,'col');col.tabIndex=0;col.dataset.tip=tip(x);
    const total=value(x),inner=part?part(x):0;
    if(total){const rest=E('i');rest.style.height=((total-inner)/max*100)+'%';const strong=E('i',undefined,'part');strong.style.height=(inner/max*100)+'%';if(total-inner>0)col.append(rest);if(inner)col.append(strong);if(!inner)rest.style.borderRadius='4px 4px 0 0';}
    col.setAttribute('aria-label',label(x));root.append(col);
  }
  const ax=E('div',undefined,'axis');for(const t of axis)ax.append(E('span',t));root.after(ax);root.parentElement.querySelectorAll('.axis').forEach((a,i,all)=>{if(i<all.length-1)a.remove();});
}
function days(d){
  const list=d.traffic.byDay,mid=list[Math.floor(list.length/2)];
  columns($('#by-day'),list,{label:x=>shortDay(x.day),value:x=>x.visits,part:x=>x.previews,tip:x=>`${shortDay(x.day)}: ${x.visits} visits, ${x.previews} got a preview, ${x.prices} saw a price`,axis:list.length>2?[shortDay(list[0].day),shortDay(mid.day),shortDay(list.at(-1).day)]:list.map(x=>shortDay(x.day))});
}
function hours(d){
  const h=n=>String(n).padStart(2,'0')+':00';
  columns($('#by-hour'),d.traffic.byHour,{label:x=>h(x.hour),value:x=>x.visits,tip:x=>`${h(x.hour)} to ${h((x.hour+1)%24)}: ${x.visits} visits`,axis:['00:00','06:00','12:00','18:00','23:00']});
}
function bars(root,items,name=x=>x){
  root.replaceChildren();if(!items.length){root.append(E('li','Nothing yet','empty'));return;}
  const total=items.reduce((n,x)=>n+x.count,0),max=items[0].count;
  for(const x of items.slice(0,8)){const li=E('li');const b=E('b',num(x.count));b.append(E('small',pct(x.count,total)));li.append(E('span',name(x.key)),b);const bar=E('i');bar.style.width=(x.count/max*100)+'%';li.append(bar);root.append(li);}
  if(items.length>8)root.append(E('li',`and ${items.length-8} more`,'empty'));
}
function breakdowns(d){
  const t=d.traffic,device={mobile:'Phone',desktop:'Computer',unknown:'Not recorded'};
  bars($('#by-source'),t.source);bars($('#by-campaign'),t.campaign);bars($('#by-country'),t.country,c=>{try{return c==='unknown'?'Unknown':new Intl.DisplayNames(['en-GB'],{type:'region'}).of(c);}catch{return c;}});bars($('#by-device'),t.device,k=>device[k]||k);
}

// Detail lists.
const TABS=[['visits','Visits',d=>d.journeyTotal],['previews','Previews',d=>d.previewTotal],['books','Books',d=>d.orders.length],['people','Emails and lists',d=>d.contacts.length+d.quotes.length+d.launchSignups.length+d.colouringSignups.length],['errors','Errors',d=>d.errors.length]];
function tabs(d){
  const nav=$('#list-tabs');nav.replaceChildren();
  for(const [key,label,count] of TABS){const b=E('button',label,S.tab===key?'active':'');b.type='button';b.append(E('span',num(count(d))));b.onclick=()=>{S.tab=key;S.search='';tabs(d);};nav.append(b);}
  const root=$('#list');root.replaceChildren();({visits,previews,books,people,errors})[S.tab](root,d);
}
function table(root,head,rows,empty){
  const wrap=E('div',undefined,'table-wrap'),t=E('table','', 'compact'),th=E('thead'),tr=E('tr'),tb=E('tbody');
  for(const h of head)tr.append(E('th',h));th.append(tr);t.append(th,tb);wrap.append(t);root.append(wrap);
  if(!rows.length){const r=E('tr'),c=E('td',empty,'empty-row');c.colSpan=head.length;r.append(c);tb.append(r);}
  for(const cells of rows){const r=E('tr');for(const c of cells){const td=E('td');if(c instanceof Node)td.append(c);else if(Array.isArray(c))td.append(...c);else td.textContent=c??'—';r.append(td);}tb.append(r);}
  return tb;
}
function tools(root,placeholder,note,redraw){
  const bar=E('div',undefined,'list-tools'),input=E('input');input.type='search';input.placeholder=placeholder;input.value=S.search;input.setAttribute('aria-label',placeholder);
  input.oninput=()=>{S.search=input.value;redraw();};bar.append(input,E('p',note));root.append(bar);return input;
}
const matches=(...values)=>{const q=S.search.trim().toLowerCase();return !q||values.some(v=>String(v??'').toLowerCase().includes(q));};
function tag(text,kind=''){return E('span',text,'tag '+kind);}
// Town and shortened IP, only saved for visitors who allowed measurement.
function where(w,country){if(!w)return country||'—';const box=E('span',[w.town,w.region].filter(Boolean).join(', ')||country||'—','where');if(w.ip)box.append(E('small',w.ip));return box;}
const whereText=w=>w?[w.town,w.region,w.ip].filter(Boolean).join(' '):'';
function madeCell(m){
  if(!m)return '—';const box=E('span',undefined,'made-cell'),ok=m.previews.filter(p=>p.status==='succeeded').length,bad=m.previews.filter(p=>p.status==='failed').length;
  if(m.previews.length)box.append(E('span',`${m.previews.length} preview${m.previews.length>1?'s':''}${bad?`, ${bad} failed`:''}${ok&&bad?`, ${ok} made`:''}`));
  if(m.email)box.append(E('small',m.email));
  if(m.book){const b=E('span',`${m.book.title||'Untitled book'}${m.book.names?' ('+m.book.names+')':''}`,'book');b.append(tag(m.book.paid?(m.book.test?'Test payment':'Paid'):'Saved, not paid',m.book.paid&&!m.book.test?'good':''));box.append(b);}
  return box.childNodes.length?box:'—';
}
function steps(j,d){const box=E('span',undefined,'steps');box.dataset.tip=`Reached: ${j.furthest}`;box.tabIndex=0;d.funnel.forEach((f,i)=>box.append(E('i',undefined,j.steps.includes(f.step)?(f.step==='paid'?'on paid':'on'):'')));return box;}
function visits(root,d){
  const body=E('div');
  const draw=()=>{body.replaceChildren();const list=d.journeys.filter(j=>matches(j.creative,j.source,j.country,j.furthest,j.campaign,j.device,j.signup?.email,whereText(j.where),j.made?.email,j.made?.book?.title,j.made?.book?.names));
    table(body,['Arrived','Pages reached','Got as far as','What they made','Ad','Device','Where','Notes'],list.map(j=>[when(j.firstAt),steps(j,d),j.furthest,madeCell(j.made),[E('span',adName(j.creative)),E('small',j.source)],j.device==='mobile'?'Phone':j.device==='desktop'?'Computer':'—',where(j.where,j.country),[...j.errors.map(e=>tag(e,'bad')),...(j.steps.includes('paid')?[tag('Paid','good')]:[]),...(j.extras.includes('story_edited')?[tag('Edited story')]:[]),...(j.signup?[tag('Launch list: '+j.signup.email,'warn')]:[])]]),'No visits match.');};
  tools(root,'Filter by ad, town, email, book…',`Newest ${num(d.journeys.length)} of ${num(d.journeyTotal)} visits. Each square is one page in the funnel above.`,draw);root.append(body);draw();
}
function previews(root,d){
  const body=E('div'),status={succeeded:['Made','good'],failed:['Failed','bad'],started:['Unfinished','warn']};
  const draw=()=>{body.replaceChildren();const list=d.previews.filter(p=>matches(p.email,p.status,p.creative,p.savedBook,whereText(p.where)));
    table(body,['When','Result','Email','Tries by this email','Ad','Where','Saved book'],list.map(p=>[when(p.at),tag(...(status[p.status]||[p.status])),p.email||'Not given',p.triesByEmail??'—',p.creative?adName(p.creative):'—',where(p.where,p.country),p.savedBook||'—']),'No previews in this range.');};
  tools(root,'Filter by email or ad…',`Every drawing request, newest first. Names and story choices are only kept once a book is saved. Where shows only for visitors who allowed measurement.`,draw);root.append(body);draw();
}
function books(root,d){
  const body=E('div');
  const draw=()=>{body.replaceChildren();const list=d.orders.filter(o=>matches(o.names,o.title,o.email,o.status,o.creative));
    if(!list.length){body.append(E('p','No books saved in this range.','empty-row'));return;}
    const grid=E('div',undefined,'made');
    for(const o of list){const a=E('article');
      if(o.characters[0]){const img=E('img');img.alt='Character for '+o.names;img.loading='lazy';img.src='/api/orders/'+encodeURIComponent(o.id)+'/file?file='+encodeURIComponent(o.characters[0]);img.onerror=()=>img.replaceWith(E('div','No picture','noimg'));a.append(img);}else a.append(E('div','No picture','noimg'));
      const text=E('div');const link=E('a',o.title||'Untitled book');link.href='/orders?order='+encodeURIComponent(o.id);const h=E('h3');h.append(link);
      text.append(h,E('p',`${o.names||'No name'}${o.age?', ages '+o.age:''}`),E('p',o.synopsis,'syn'),E('p',`${o.email}`),E('p',`${when(o.createdAt)}, ${o.size.toUpperCase()} ${pounds(o.amountPence)}, ${o.creative?adName(o.creative):'ad unknown'}`));
      const tags=E('p');tags.append(tag(o.paymentStatus==='paid'?(o.ownerTest?'Test payment':'Paid'):'Not paid',o.paymentStatus==='paid'&&!o.ownerTest?'good':o.ownerTest?'warn':''),tag(o.status.replaceAll('_',' ')));text.append(tags);
      a.append(text);grid.append(a);}
    body.append(grid);};
  tools(root,'Filter by name, title or email…','Saved books with their character. Open one for the full story and proof.',draw);root.append(body);draw();
}
function people(root,d){
  const body=E('div');
  const draw=()=>{body.replaceChildren();
    body.append(E('h3','Left an email for a preview','list-title'));
    table(body,['When','Email','Previews','Ad','Where','Saved book'],d.contacts.filter(c=>matches(c.email,c.creative,c.country,whereText(c.where))).map(c=>[when(c.at),c.email,c.previews,adName(c.creative),where(c.where,c.country),c.savedBook||'—']),'None in this range.');
    body.append(E('h3','Saw a price','list-title'));
    table(body,['Last saw','Email','Book','Price','Offer emails allowed','Bought'],d.quotes.filter(q=>matches(q.email,q.size)).map(q=>[when(q.lastAt),q.email,q.size.toUpperCase(),pounds(q.pricePence),q.offerConsent?'Yes':'No',q.bought?tag('Bought','good'):'No']),'None in this range.');
    body.append(E('h3','Storybook launch list','list-title'));
    table(body,['When','Email','Format','Price','Ad','Status'],d.launchSignups.filter(l=>matches(l.email,l.creative,l.product)).map(l=>[when(l.at),l.email,l.product,pounds(l.pricePence),adName(l.creative),l.unsubscribed?tag('Unsubscribed','bad'):'Subscribed']),'None in this range.');
    body.append(E('h3','Colouring book list','list-title'));
    table(body,['When','Email','Interest','Page'],d.colouringSignups.filter(s=>matches(s.email,s.interest)).map(s=>[when(s.at),s.email,s.interest,s.page]),'None in this range.');};
  tools(root,'Filter by email or ad…','Everyone who gave an email, grouped by what they asked for.',draw);root.append(body);draw();
}
function errors(root,d){
  const body=E('div');
  const draw=()=>{body.replaceChildren();table(body,['When','What went wrong','Details'],d.errors.filter(e=>matches(e.kind,e.detail)).map(e=>[when(e.at),tag(e.kind,'bad'),e.detail]),'No errors in this range.');};
  tools(root,'Filter errors…','Preview and payment failures, newest first.',draw);root.append(body);draw();
}

function spend(d){
  const body=$('#spend-list');body.replaceChildren();
  if(!d.spend.length){const tr=E('tr'),td=E('td','No spend entered for these dates.','empty-row');td.colSpan=3;tr.append(td);body.append(tr);}
  for(const s of d.spend){const tr=E('tr');tr.append(E('td',shortDay(s.day)),E('td',s.creative==='all'?'Whole campaign':s.creative),E('td',pounds(s.pence),'num'));body.append(tr);}
}
$('#spend-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{const r=await fetch('/api/owner-analytics/spend',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:$('#spend-day').value,creative:$('#spend-creative').value,pounds:$('#spend-pounds').value})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Spend was not saved.');$('#spend-pounds').value='';await load();msg(d.pence?`Saved ${pounds(d.pence)} for ${shortDay(d.day)}.`:`Removed spend for ${shortDay(d.day)}.`);}
  catch(error){msg(error.message,true);}finally{button.disabled=false;}
});

document.querySelectorAll('.presets button').forEach(b=>b.addEventListener('click',()=>{setPreset(Number(b.dataset.days));void load();}));
$('#filters').addEventListener('submit',e=>{e.preventDefault();void load();});
for(const id of ['#creative','#source'])$(id).addEventListener('change',()=>void load());
const start=new URLSearchParams(location.search);
if(/^\d{4}-\d{2}-\d{2}$/.test(start.get('from')||'')&&/^\d{4}-\d{2}-\d{2}$/.test(start.get('to')||'')){$('#from').value=start.get('from');$('#to').value=start.get('to');}else setPreset(7);
$('#spend-day').value=ukDay(new Date());
for(const [id,key] of [['#creative','creative'],['#source','source']])if(start.get(key)){const o=E('option',start.get(key));o.value=start.get(key);$(id).append(o);$(id).value=start.get(key);}
void load();
