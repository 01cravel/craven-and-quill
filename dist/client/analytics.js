// Owner analytics view. All visitor-supplied text is written with textContent, never as HTML.
const $=s=>document.querySelector(s),S={data:null,tab:'people',search:'',personKind:'',page:0};
const ZONE='Europe/London';
const pounds=p=>p===null||p===undefined?'—':'£'+(p/100).toLocaleString('en-GB',{minimumFractionDigits:p%100?2:0,maximumFractionDigits:2});
const num=n=>n===null||n===undefined?'—':Number(n).toLocaleString('en-GB');
const when=s=>s?new Date(s).toLocaleString('en-GB',{timeZone:ZONE,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const ukDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE}).format(t);
const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const shortDay=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
const adName=c=>!c||c==='none'?'Not from an ad':c;
const countryName=c=>{try{return !c||c==='unknown'?'Unknown':new Intl.DisplayNames(['en-GB'],{type:'region'}).of(c);}catch{return c;}};
function E(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e;}
function msg(text,bad=false){$('#message').textContent=text;$('#message').classList.toggle('error',bad);}

// Tooltip shared by every chart mark. Marks carry their text in data-tip.
const tip=$('#tip');
document.addEventListener('pointermove',e=>{const t=e.target.closest?.('[data-tip]');if(!t){tip.hidden=true;return;}tip.textContent=t.dataset.tip;tip.hidden=false;const x=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8),y=e.clientY-tip.offsetHeight-12;tip.style.left=x+'px';tip.style.top=(y<4?e.clientY+18:y)+'px';});
document.addEventListener('focusin',e=>{const t=e.target.closest?.('[data-tip]');if(!t)return;const r=t.getBoundingClientRect();tip.textContent=t.dataset.tip;tip.hidden=false;tip.style.left=Math.min(r.left,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.max(4,r.top-tip.offsetHeight-8)+'px';});
document.addEventListener('focusout',()=>{tip.hidden=true;});

function params(){const p=new URLSearchParams({from:$('#from').value,to:$('#to').value});if($('#creative').value)p.set('creative',$('#creative').value);if($('#source').value)p.set('source',$('#source').value);if($('#audience-all').checked)p.set('audience','all');return p;}
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

function render(d){const t=d.advertisingTracking;$('#ad-tracking-status').textContent=t?`Google tag: ${t.googleTagConfigured?'configured':'missing'}. Preview-email reporting: ${t.leadConfigured?'configured':'missing'}. Purchase goal: ${t.purchaseConfigured?'configured':'missing'}. Protected server feeds: ${t.serverFeedPrepared?'prepared, Google connection requires verification':'not prepared'}. Meta pixel: ${t.metaPixelConfigured?'configured':'missing'}. Meta purchase reporting from the server: ${t.metaPurchaseConfigured?'configured':'missing, add the Conversions API token'}.`:'Tracking configuration unavailable.';try{scorecard(d);}catch(e){console.error('Scorecard failed',e);}everyone(d);headline(d);profit(d);funnel(d);ads(d);days(d);hours(d);breakdowns(d);tabs(d);spend(d);$('#notes').replaceChildren(...d.notes.map(n=>E('li',n)));}

function headline(d){
  const h=d.headline,f=d.filter.creative||d.filter.source;
  const items=[
    ['Visits',num(h.visits),'every visit, no cookies needed'],
    ['Previews made',num(h.previewsMade),`${num(h.previewsTried)} tried, ${num(h.previewsFailed)} failed`],
    ['Emails left',num(h.previewEmails),h.launchSignups?`${num(h.launchSignups)} joined the interest list`:'for a preview'],
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

const SHORT_FUNNEL={visit:'Arrived',maker_start:'Opened maker',step_2:'Photo page',photo_picked:'Added photo',photo_passed:'Photo OK',step_1:'Name',step_10:'Email page',preview_start:'Asked preview',preview_success:'Got character',step_5:'Saw character',step_8:'Reading level',step_9:'Story details',step_3:'Story tone',step_4:'Read story',step_6:'Book size',price_visible:'Saw prices',step_11:'Delivery',step_7:'Review & pay',book_saved:'Saved book',checkout_start:'Pressed pay',paid:'Paid'};
const PHASES=[['Arrive',['visit','maker_start']],['Photo',['step_2','photo_picked','photo_passed']],['Preview',['step_1','step_10','preview_start','preview_success','step_5']],['Story',['step_8','step_9','step_3','step_4']],['Buy',['step_6','price_visible','step_11','step_7','book_saved','checkout_start','paid']]];
const NS='http://www.w3.org/2000/svg';
function N(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function chips(d){
  const box=$('#funnel-chips');box.replaceChildren();
  const all=d.ads.reduce((n,a)=>n+a.visits,0);
  for(const [key,label,count] of [['','All visits',all],...d.ads.map(a=>[a.creative,adName(a.creative),a.visits])]){
    const b=E('button',label,'chip'+((key||'')===(d.filter.creative||'')?' on':''));b.type='button';b.append(E('small',num(count)));
    b.addEventListener('click',()=>{if($('#creative').value===key)return;if(![...$('#creative').options].some(o=>o.value===key)){const o=E('option',adName(key));o.value=key;$('#creative').append(o);}$('#creative').value=key;void load();});
    box.append(b);
  }
}
let riverWidth=0;
function funnel(d){
  chips(d);
  const a=d.audience,gone=a?a.hidden.crawlers+a.hidden.abroad:0;
  $('#audience-note').textContent=!a?'':a.mode==='all'?'Showing every visit, including bots and visits from abroad.':`Showing UK shoppers only. Hidden: ${num(a.hidden.crawlers)} bot visits and ${num(a.hidden.abroad)} from abroad${gone?'':' (none in this range)'}.`;
  const root=$('#funnel');root.replaceChildren();
  const steps=d.funnel,top=steps[0].visits||0,n=steps.length;
  const W=Math.round(root.clientWidth||root.getBoundingClientRect().width||900);riverWidth=W;
  const e=d.errorVisits;$('#funnel-errors').textContent=`${num(e.preview_error)} visits hit a preview error and ${num(e.checkout_error)} hit a payment page error. The Errors tab has times.`;
  if(!top){root.append(E('p','No visits in this range yet.','empty'));return;}
  const svg=N('svg',{class:'river-svg',role:'img','aria-label':steps.map(s=>`${s.label}: ${num(s.visits)}`).join('; ')});
  const colour=s=>s.step==='paid'?'var(--good)':'var(--bar)';
  const size=(s,full)=>Math.max(s.visits/top*full,s.visits?3:0);
  const slab=(s,attrs)=>{const g=N('g',{class:'slab',tabindex:0});g.dataset.tip=`${s.label}: ${num(s.visits)} (${pct(s.visits,top)} of arrivals)`;g.append(N('rect',{...attrs,rx:3,fill:colour(s)}));return g;};
  if(W>=1150){
    const padT=34,padB=58,ch=170,sw=Math.min(34,Math.max(18,W/n*.38)),gap=(W-sw*n)/(n-1),mid=padT+ch/2,H=padT+ch+padB;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('height',H);
    PHASES.forEach(([name,keys],i)=>{const idx=keys.map(k=>steps.findIndex(s=>s.step===k)).filter(j=>j>=0);if(!idx.length)return;const x0=Math.max(0,Math.min(...idx)*(sw+gap)-gap/2),x1=Math.min(W,Math.max(...idx)*(sw+gap)+sw+gap/2);
      svg.append(N('rect',{x:x0,y:0,width:x1-x0,height:H,class:'phase'+(i%2?' alt':'')}));svg.append(N('text',{x:x0+8,y:H-7,class:'phase-name'},name));});
    const h=s=>size(s,ch);
    for(let i=0;i<n-1;i++){const x0=i*(sw+gap)+sw,x1=(i+1)*(sw+gap),a=h(steps[i])/2,b=h(steps[i+1])/2;
      svg.append(N('path',{d:`M${x0} ${mid-a} C${x0+gap/2} ${mid-a} ${x1-gap/2} ${mid-b} ${x1} ${mid-b} L${x1} ${mid+b} C${x1-gap/2} ${mid+b} ${x0+gap/2} ${mid+a} ${x0} ${mid+a} Z`,class:'band'}));
      const lost=Math.max(0,steps[i].visits-steps[i+1].visits);if(lost)svg.append(N('text',{x:x0+gap/2,y:12,class:'drop','text-anchor':'middle'},'−'+num(lost)));}
    steps.forEach((s,i)=>{const x=i*(sw+gap),hh=h(s),g=slab(s,{x,y:mid-hh/2,width:sw,height:hh});
      g.append(N('text',{x:x+sw/2,y:mid-hh/2-6,class:'count','text-anchor':'middle'},num(s.visits)));
      if(i)g.append(N('text',{x:x+sw/2,y:mid+hh/2+14,class:'share','text-anchor':'middle'},pct(s.visits,top)));
      const label=N('text',{x:x+sw/2,y:H-padB+16,class:'label'+(s.visits?'':' dim'),'text-anchor':'middle'});(SHORT_FUNNEL[s.step]||s.label).split(' ').forEach((w,j)=>label.append(N('tspan',{x:x+sw/2,dy:j?12:0},w)));g.append(label);svg.append(g);});
  }else{
    const padL=104,padR=58,rowH=38,bar=14,cw=W-padL-padR,cx=padL+cw/2,H=n*rowH+4;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('height',H);
    const w=s=>size(s,cw),cy=i=>i*rowH+rowH/2+2;
    for(let i=0;i<n-1;i++){const a=w(steps[i])/2,b=w(steps[i+1])/2,y0=cy(i)+bar/2,y1=cy(i+1)-bar/2,g=y1-y0;
      svg.append(N('path',{d:`M${cx-a} ${y0} C${cx-a} ${y0+g/2} ${cx-b} ${y1-g/2} ${cx-b} ${y1} L${cx+b} ${y1} C${cx+b} ${y1-g/2} ${cx+a} ${y0+g/2} ${cx+a} ${y0} Z`,class:'band'}));
      const lost=Math.max(0,steps[i].visits-steps[i+1].visits);if(lost)svg.append(N('text',{x:W,y:y0+g/2+4,class:'drop','text-anchor':'end'},'−'+num(lost)));}
    steps.forEach((s,i)=>{const ww=w(s),y=cy(i),g=slab(s,{x:cx-ww/2,y:y-bar/2,width:ww,height:bar});
      g.append(N('text',{x:padL-10,y:y+4,class:'label'+(s.visits?'':' dim'),'text-anchor':'end'},SHORT_FUNNEL[s.step]||s.label));
      const c=N('text',{x:cx,y:y-bar/2-4,class:'count','text-anchor':'middle'},num(s.visits));if(i)c.append(N('tspan',{class:'share',dx:6},pct(s.visits,top)));g.append(c);svg.append(g);});
  }
  root.append(svg);
}
new ResizeObserver(()=>{const r=$('#funnel');if(S.data&&r.clientWidth&&Math.abs(r.clientWidth-riverWidth)>24)funnel(S.data);}).observe($('#funnel'));

function profit(d){
  const e=d.economics,signed=p=>(p<0?'−':'')+pounds(Math.abs(p));
  const lines=[
    ['Revenue',pounds(e.revenuePence),`${num(e.sales)} ${e.sales===1?'sale':'sales'}`,'in'],
    ['Payment fees',signed(-e.feesPence),`${(e.costs.fee_percent/100).toFixed(2)}% + ${pounds(e.costs.fee_fixed)} each`,'out'],
    ['Printing',signed(-e.printPence),`A5 ${pounds(e.costs.print_a5)}, A4 ${pounds(e.costs.print_a4)}`,'out'],
    ['Finished drawings',signed(-e.artPence),`${pounds(e.costs.art_book)} a book`,'out'],
    ['Previews for everyone',signed(-e.previewPence),`${num(e.previewAttempts)} drawn at ${pounds(e.costs.preview)}`,'out'],
    ['Ad spend',signed(-e.spendPence),e.spendPence?'entered below':'none entered','out'],
    ['Profit',signed(e.profitPence),e.sales?`${signed(e.profitPerSalePence)} a sale`:'no sales in this range',e.profitPence<0?'total loss':'total gain'],
  ];
  $('#ledger').replaceChildren(...lines.map(([label,value,note,cls])=>{const row=E('div',undefined,cls);const dd=E('dd',value);dd.append(E('small',note));row.append(E('dt',label),dd);return row;}));
  $('#room').replaceChildren(...e.room.map(r=>{const li=E('li');li.append(E('strong',`${r.label} at ${pounds(r.pricePence)}`),E('span',r.adRoomPence>0?`up to ${pounds(r.adRoomPence)} of ads per sale`:'no room for ads at this price'));return li;}));
  const s=e.stop,share=Math.min(1,s.spentSinceSalePence/s.limitPence);
  $('#stop-line').textContent=`${pounds(s.spentSinceSalePence)} of ${pounds(s.limitPence)} spent ${s.lastSaleAt?'since the last sale on '+when(s.lastSaleAt):'with no sale yet'}.${share>=1?' Pause the ads and rethink.':''}`;
  $('#stop-fill').style.width=Math.round(share*100)+'%';$('#stop-fill').classList.toggle('over',share>=1);
  for(const [k,v] of Object.entries(e.costs)){const input=document.querySelector(`#cost-form [name="${k}"]`);if(input&&document.activeElement!==input)input.value=(v/100).toFixed(2);}
}
function ads(d){
  const body=$('#ads');body.replaceChildren();
  if(!d.ads.length){const tr=E('tr');const td=E('td','No measured visits in this range.','empty-row');td.colSpan=10;tr.append(td);body.append(tr);return;}
  for(const a of d.ads){
    const tr=E('tr',undefined,a.creative===d.filter.creative?'selected':'');
    const cells=[adName(a.creative),num(a.visits),num(a.previews),num(a.prices),num(a.checkouts),num(a.sales),a.spendPence?pounds(a.spendPence):'—',a.spendPence&&a.visits?pounds(Math.round(a.spendPence/a.visits)):'—',a.spendPence&&a.sales?pounds(Math.round(a.spendPence/a.sales)):'—',a.sales||a.spendPence?pounds(a.revenuePence-a.costPence-a.spendPence):'—'];
    cells.forEach((c,i)=>tr.append(E('td',c,i?'num':'')));body.append(tr);
  }
}

const SHORT={arrive:'Arrived',maker_start:'Opened maker',step_2:'Photo page',photo_open:'Tapped add',photo_picked:'Picked photo',photo_passed:'Photo OK',photo_failed:'Photo failed',step_1:'Name',step_10:'Email page',preview_start:'Asked for preview',preview_success:'Got character',step_5:'Character',step_8:'Reading level',step_9:'Story details',step_3:'Story tone',step_4:'Story',step_6:'Book size',price_visible:'Saw prices',step_11:'Delivery',step_7:'Review & pay',book_saved:'Saved book',checkout_start:'Pressed pay'};
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
  const countries=(e.countries||[]).slice(0,5).map(x=>`${countryName(x.key)} ${pct(x.count,arrived)}`).join(', ');
  $('#everyone-note').textContent=[countries&&`From ${countries}.`,devices&&`Arrived on ${devices}.`,recent&&`Arrivals by day: ${recent}.`].filter(Boolean).join(' ');
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
  bars($('#by-source'),t.source);bars($('#by-campaign'),t.campaign);bars($('#by-country'),t.country,countryName);bars($('#by-device'),t.device,k=>device[k]||k);
}

// Detail lists.
const TABS=[['people','People & visits',d=>d.peopleTotal],['visits','Visits',d=>d.journeyTotal],['previews','Previews',d=>d.previewTotal],['books','Books',d=>d.orders.length],['records','Email records',d=>d.contacts.length+d.quotes.length+d.launchSignups.length+d.colouringSignups.length],['errors','Errors',d=>d.errors.length]];
function tabs(d){
  const nav=$('#list-tabs');nav.replaceChildren();
  for(const [key,label,count] of TABS){const b=E('button',label,S.tab===key?'active':'');b.type='button';b.append(E('span',num(count(d))));b.onclick=()=>{S.tab=key;S.search='';S.page=0;tabs(d);};nav.append(b);}
  const root=$('#list');root.replaceChildren();({people:peopleView,visits,previews,books,records,errors})[S.tab](root,d);
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
function peopleView(root,d){
  const bar=E('div',undefined,'list-tools'),input=E('input'),kind=E('select'),body=E('div'),pager=E('div',undefined,'list-pager');
  input.type='search';input.placeholder='Search email, step, book, ad or town…';input.value=S.search;input.setAttribute('aria-label','Search people and visits');
  for(const [value,label] of [['','All records'],['email','Known emails'],['visit','Anonymous visits'],['preview','Unlinked previews']]){const option=E('option',label);option.value=value;kind.append(option);}kind.value=S.personKind;kind.setAttribute('aria-label','Filter record type');
  const summary=E('p',`${num(d.knownEmailTotal)} unique email addresses, ${num(d.anonymousTotal)} anonymous visits or unlinked previews. One email can belong to more than one person.`);
  bar.append(input,kind,summary);root.append(bar,body,pager);
  const draw=()=>{
    const list=d.people.filter(p=>(!S.personKind||p.kind===S.personKind)&&matches(p.email,p.furthest,p.title,p.names,p.source,p.creative,p.country,whereText(p.where),...p.activity));
    const size=50,pages=Math.max(1,Math.ceil(list.length/size));S.page=Math.min(S.page,pages-1);body.replaceChildren();
    table(body,['Last seen','Email or visit','Visits','Furthest step','Pages reached','What they did','Book','Source / place'],list.slice(S.page*size,(S.page+1)*size).map(p=>{
      const details=E('span',undefined,'person-details');for(const activity of p.activity)details.append(tag(activity,activity==='Paid book'?'good':''));
      if(p.previews)details.append(E('small',`${p.previewMade} of ${p.previews} previews made`));
      if(p.activity.includes('Saw price'))details.append(E('small',p.offerConsent?'Offer email allowed':'No offer email permission'));
      if(p.launchConsent)details.append(E('small','Joined the interest list'));
      const source=E('span',p.creative?adName(p.creative):p.source||'—');source.append(E('small',p.country?countryName(p.country):'Location unknown'));
      return [when(p.lastAt),p.email||E('span',p.kind==='preview'?'Unlinked preview':p.ambiguous?'Visit with multiple emails':'Anonymous visit','muted'),p.visits||'—',p.furthest,p.steps.length?steps(p,d):'—',details.childNodes.length?details:'—',p.title?`${p.title}${p.names?' ('+p.names+')':''}`:'—',[source,p.where?E('small',whereText(p.where)):null].filter(Boolean)];
    }),'No records match.');
    pager.replaceChildren();const prev=E('button','Previous'),next=E('button','Next');prev.type=next.type='button';prev.disabled=S.page===0;next.disabled=S.page>=pages-1;prev.onclick=()=>{S.page--;draw();};next.onclick=()=>{S.page++;draw();};pager.append(E('span',`Showing ${list.length?S.page*size+1:0}–${Math.min((S.page+1)*size,list.length)} of ${num(list.length)}`),prev,E('span',`Page ${S.page+1} of ${pages}`),next);
  };
  input.oninput=()=>{S.search=input.value;S.page=0;draw();};kind.onchange=()=>{S.personKind=kind.value;S.page=0;draw();};draw();
}
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
    table(body,['Arrived','Pages reached','Got as far as','What they made','Ad','Device','Where','Notes'],list.map(j=>[when(j.firstAt),steps(j,d),j.furthest,madeCell(j.made),[E('span',adName(j.creative)),E('small',j.source)],j.device==='mobile'?'Phone':j.device==='desktop'?'Computer':'—',where(j.where,j.country),[...j.errors.map(e=>tag(e,'bad')),...(j.steps.includes('paid')?[tag('Paid','good')]:[]),...(j.firstScreen?[tag('First screen '+j.firstScreen,j.firstScreen==='under 5s'?'bad':undefined)]:[]),...(j.extras.includes('name_typed')?[tag('Typed a name')]:[]),...(j.extras.includes('start_tapped')?[tag('Tapped start')]:[]),...(j.extras.includes('story_edited')?[tag('Edited story')]:[]),...(j.signup?[tag('Launch list: '+j.signup.email,'warn')]:[])]]),'No visits match.');};
  tools(root,'Filter by ad, town, email, book…',`Newest ${num(d.journeys.length)} of ${num(d.journeyTotal)} visits. Each square is one page in the funnel above.`,draw);root.append(body);draw();
}
function previews(root,d){
  const body=E('div'),status={succeeded:['Made','good'],failed:['Failed','bad'],started:['Unfinished','warn']};
  const draw=()=>{body.replaceChildren();const list=d.previews.filter(p=>matches(p.email,p.status,p.creative,p.savedBook,whereText(p.where)));
    table(body,['When','Result','Email','Tries by this email','Ad','Where','Saved book'],list.map(p=>[when(p.at),tag(...(status[p.status]||[p.status])),p.email||'Not given',p.triesByEmail??'—',p.creative?adName(p.creative):'—',where(p.where,p.country),p.savedBook||'—']),'No previews in this range.');};
  tools(root,'Filter by email or ad…',`Every drawing request, newest first. Names and story choices are only kept once a book is saved.`,draw);root.append(body);draw();
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
function records(root,d){
  const body=E('div');
  const draw=()=>{body.replaceChildren();
    body.append(E('h3','Left an email for a preview','list-title'));
    table(body,['When','Email','Previews','Ad','Where','Saved book'],d.contacts.filter(c=>matches(c.email,c.creative,c.country,whereText(c.where))).map(c=>[when(c.at),c.email,c.previews,adName(c.creative),where(c.where,c.country),c.savedBook||'—']),'None in this range.');
    body.append(E('h3','Saw a price','list-title'));
    table(body,['Last saw','Email','Book','Price','Offer emails allowed','Bought'],d.quotes.filter(q=>matches(q.email,q.size)).map(q=>[when(q.lastAt),q.email,q.size.toUpperCase(),pounds(q.pricePence),q.offerConsent?'Yes':'No',q.bought?tag('Bought','good'):'No']),'None in this range.');
    body.append(E('h3','Storybook interest list','list-title'));
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
$('#cost-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{const body=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,Number(v)]));const r=await fetch('/api/owner-analytics/costs',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Costs were not saved.');await load();msg('Costs saved. Profit figures use them now.');}
  catch(error){msg(error.message,true);}finally{button.disabled=false;}
});
$('#spend-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{const r=await fetch('/api/owner-analytics/spend',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:$('#spend-day').value,creative:$('#spend-creative').value,pounds:$('#spend-pounds').value})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Spend was not saved.');$('#spend-pounds').value='';await load();msg(d.pence?`Saved ${pounds(d.pence)} for ${shortDay(d.day)}.`:`Removed spend for ${shortDay(d.day)}.`);}
  catch(error){msg(error.message,true);}finally{button.disabled=false;}
});

document.querySelectorAll('.presets button').forEach(b=>b.addEventListener('click',()=>{setPreset(Number(b.dataset.days));void load();}));
$('#filters').addEventListener('submit',e=>{e.preventDefault();void load();});
for(const id of ['#creative','#source','#audience-all'])$(id).addEventListener('change',()=>void load());
const start=new URLSearchParams(location.search);
if(/^\d{4}-\d{2}-\d{2}$/.test(start.get('from')||'')&&/^\d{4}-\d{2}-\d{2}$/.test(start.get('to')||'')){$('#from').value=start.get('from');$('#to').value=start.get('to');}else setPreset(7);
$('#spend-day').value=ukDay(new Date());
$('#audience-all').checked=start.get('audience')==='all';
for(const [id,key] of [['#creative','creative'],['#source','source']])if(start.get(key)){const o=E('option',start.get(key));o.value=start.get(key);$(id).append(o);$(id).value=start.get(key);}
void load();

// Scorecard: the few numbers that decide whether the ads are working, against their aims.
function scorecard(d){
  const el=(t,c,txt)=>{const n=document.createElement(t);if(c)n.className=c;if(txt!==undefined)n.textContent=txt;return n;};
  const f=Object.fromEntries((d.funnel||[]).map(s=>[s.step,s.visits]));const v=k=>f[k]||0;
  const from=d.range?.from,to=d.range?.to,days=from&&to?Math.max(1,Math.round((Date.parse(to)-Date.parse(from))/86400000)+1):1;
  const arrived=v('visit'),opened=v('maker_start')||v('step_1'),pastName=v('step_8'),photo=v('photo_picked'),character=v('preview_success'),prices=v('price_visible'),pressed=v('checkout_start'),sales=d.headline?.sales??v('paid');
  const stop=d.economics?.stop||{},limit=stop.limitPence||0,spent=stop.spentSinceSalePence||0,spend=d.headline?.spendPence||0;
  const rate=(a,b)=>b?a/b:null,p=x=>x===null?'—':Math.round(x*100)+'%';
  const verdict=(now,aim,base,lower)=>{if(now===null||base<5)return['Too few yet',''];const r=lower?aim/Math.max(now,1e-9):now/aim;return r>=1?['On track','ok']:r>=.7?['Close','warn']:['Behind','bad'];};
  const perDay=arrived/days;
  $('#sc-lede').textContent=`${num(arrived)} real UK visitors in ${days===1?'this day':days+' days'} (${perDay.toFixed(1)} a day). ${num(character)} made a character, ${num(pressed)} pressed pay and ${sales?num(sales)+' paid':'nobody has paid yet'}.`;
  const tiles=[
    ['Visitors a day',perDay.toFixed(1),perDay>=15?'ok':perDay>=10?'warn':'bad','Aim: 15 a day from ads.'],
    ['Got past the name page',p(rate(pastName,opened)),verdict(rate(pastName,opened),.4,opened)[1],`${num(pastName)} of ${num(opened)} who opened the maker.`],
    ['Added a photo',p(rate(photo,pastName)),verdict(rate(photo,pastName),.5,pastName)[1],`${num(photo)} of ${num(pastName)} who got past the name.`],
    ['Pressed pay',num(pressed),pressed?'ok':'',`${num(prices)} saw the prices.`],
    ['Orders',num(sales),sales?'ok':'bad','The number that decides everything.']
  ];
  const box=$('#sc-tiles');box.replaceChildren();
  for(const [lab,big,cls,note] of tiles){const t=el('div','sc-tile');t.append(el('span','lab',lab),el('span','big '+cls,big),el('span','note',note));box.append(t);}
  if(limit){const t=el('div','sc-tile');t.append(el('span','lab','Spent since last sale'),el('span','big '+(spent>=limit?'bad':spent>=limit*.7?'warn':''),pounds(spent)));const m=el('div','sc-meter'),i=el('i');i.style.width=Math.min(100,spent/limit*100)+'%';m.append(i);t.append(m,el('span','note',spend?`Stop line ${pounds(limit)}. No sale by then means stop.`:'Enter Google spend in Ad spend below to track this.'));box.append(t);}
  const fu=d.followups;if(fu&&!fu.error){const t=el('div','sc-tile');t.append(el('span','lab','Reminder emails'),el('span','big '+(fu.enabled?'ok':'bad'),fu.enabled?'On':'Off'),el('span','note',fu.enabled?`${num(fu.firstSent)} reminders and ${num(fu.secondSent)} 10% codes sent. ${num(fu.enrolled)} people signed up.`:'Turn on FOLLOWUP_EMAILS_ENABLED in the site settings to start sending.'));box.append(t);}
  const steps=[['Arrived',arrived],['Opened the maker',opened],['Got past the name page',pastName],['Added a photo',photo],['Got their character',character],['Saw the prices',prices],['Pressed pay',pressed],['Paid',sales]];
  let worst=-1,worstDrop=0;steps.forEach(([,n],i)=>{if(i){const drop=steps[i-1][1]-n;if(drop>worstDrop){worstDrop=drop;worst=i;}}});
  const fun=$('#sc-funnel');fun.replaceChildren();
  steps.forEach(([lab,n],i)=>{const r=el('div','sc-row'+(i===worst?' leak':''));const tr=el('div','track'),bar=el('i');bar.style.width=(arrived?n/arrived*100:0)+'%';tr.append(bar);const val=el('span','val');val.append(el('b','',num(n)),document.createTextNode(' '+(arrived?Math.round(n/arrived*100)+'%':'')));r.append(el('span','lab-txt',lab+(i===worst?` (−${worstDrop})`:'')),tr,val);fun.append(r);});
  const rows=[
    ['Visitors a day','Are the ads bringing people in?',perDay.toFixed(1),'15+',perDay>=15?['On track','ok']:perDay>=10?['Close','warn']:['Behind','bad']],
    ['Got past the name page','Does the first screen hook them?',p(rate(pastName,opened)),'40%',verdict(rate(pastName,opened),.4,opened)],
    ['Added a photo','Do they trust us with a photo?',p(rate(photo,pastName)),'50%',verdict(rate(photo,pastName),.5,pastName)],
    ['Got their character','Does the free preview work?',p(rate(character,photo)),'90%',verdict(rate(character,photo),.9,photo)],
    ['Character to prices','Do they like it enough to look at prices?',p(rate(prices,character)),'50%',verdict(rate(prices,character),.5,character)],
    ['Prices to pressed pay','Is the price right?',p(rate(pressed,prices)),'50%',verdict(rate(pressed,prices),.5,prices)],
    ['Pressed pay to paid','Does the payment page feel safe?',p(rate(sales,pressed)),'50%',verdict(rate(sales,pressed),.5,pressed)],
    ['Orders','Are we making money?',num(sales),'1+',sales?['On track','ok']:['Behind','bad']]
  ];
  const tb=$('#sc-table');tb.replaceChildren();
  for(const [m,w,now,aim,[vt,vc]] of rows){const tr=el('tr');const vd=el('td');vd.append(el('span','pill '+vc,vt));tr.append(el('td','',m),el('td','what',w),el('td','',now),el('td','',aim),vd);tb.append(tr);}
}
