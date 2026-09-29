const $=selector=>document.querySelector(selector);let report;
$('#since').value=new Date().toISOString().slice(0,10);
$('#until').value=new Date(Date.now()+86400000).toISOString().slice(0,10);
function rows(target,data,keys){target.replaceChildren();for(const row of data){const tr=document.createElement('tr');for(const key of keys){const td=document.createElement('td');td.textContent=row[key]??'';tr.append(td);}target.append(tr);}}
function render(){
  if(!report)return;
  const paid=report.leads.filter(row=>row.source==='meta'&&row.medium==='paid_social'&&row.campaign===report.campaign&&row.country==='GB');
  const count=paid.reduce((n,row)=>n+Number(row.qualified_signups||0),0);
  const spend=Math.max(0,Number($('#spend').value)||0),drawingCost=Math.max(0,Number($('#drawing-cost').value)||0);
  const cpl=count?spend/count:null,totalCpl=count?(spend+drawingCost)/count:null;
  const margin=Number($('#margin').value)||0;
  const attempts=report.previews.reduce((n,row)=>n+row.attempts,0);
  const success=report.previews.find(row=>row.status==='succeeded')?.attempts||0;
  const measured=report.measuredConversion||{visitors:0,converted_visitors:0};
  const early=(report.previewContacts||[]).reduce((n,row)=>n+Number(row.contacts||0),0);
  const stats=[['Preview emails (selected campaign)',early],['Qualified UK paid signups',count],['Ad cost / qualified signup',count?'£'+cpl.toFixed(2):'No qualified signups'],['Ad + preview cost / signup',count?'£'+totalCpl.toFixed(2):'No qualified signups'],['Measured visitor conversion',measured.visitors?(100*measured.converted_visitors/measured.visitors).toFixed(1)+'%':'No measured visits'],['Drawing requests (all traffic)',attempts],['Preview success',attempts?(100*success/attempts).toFixed(1)+'%':'No attempts']];
  $('#stats').replaceChildren();
  for(const [title,value]of stats){const card=document.createElement('article');const label=document.createElement('span');label.textContent=title;const number=document.createElement('strong');number.textContent=value;card.append(label,number);$('#stats').append(card);}
  const decisions=[];
  const unhealthy=attempts>=20&&success/attempts<0.9;
  if(unhealthy)decisions.push('Fix the preview before judging demand: more than 10% of drawing requests have not completed.');
  if(spend>=100)decisions.push('£100 media cap reached: stop spending.');
  if(spend>=30&&!count)decisions.push('Early stop: £30 spent with no qualified UK paid signups. Inspect the journey before spending more.');
  if(!spend)decisions.push('Enter matching actual Meta spend. No demand decision yet.');
  else if(unhealthy)decisions.push('Result is inconclusive while the journey is failing.');
  else if(count>=25&&cpl<=4)decisions.push('Interest signal met: proceed only to costing and a small paid pilot. This does not validate sales.');
  else if(spend<100)decisions.push('Test incomplete. Assess at £100 or the seven-day end date, whichever comes first; never extend automatically.');
  else if(count>=10)decisions.push('Revise or interview before another test: 10–24 signups, or cost above £4.');
  else decisions.push('Do not scale this offer/channel: fewer than 10 qualified signups at £100. This does not disprove every version of the idea.');
  if(measured.visitors>=100&&measured.converted_visitors/measured.visitors<0.05)decisions.push('Below 5% of measured visitors joined: inspect the offer and the step where people leave.');
  if(margin>0&&count)decisions.push('At the entered costs, at least '+(100*totalCpl/margin).toFixed(1)+'% of signups must buy just to cover acquisition. This assumes the chosen margin, excludes fixed overhead and is not a forecast.');
  else decisions.push('Profitability remains unknown until printing, shipping, payment, generation and refund costs are confirmed.');
  $('#decision').textContent=decisions.join(' ');
  $('#note').textContent=report.note+' Report range is UTC, end exclusive. Match Meta spend to that range (Meta bills in UK time). Enter actual preview costs separately. Thresholds are pre-set hypotheses, not industry benchmarks. This page does not pause Meta automatically.';
  rows($('#leads'),report.leads,['source','campaign','creative','country','signups','qualified_signups']);
  rows($('#events'),report.events,['source','campaign','creative','country','event','visits']);
  rows($('#products'),report.products,['product','price_pence','signups']);
  $('#report').hidden=false;
}
async function get(path){const response=await fetch(path,{headers:{Authorization:'Bearer '+$('#access-token').value}});if(!response.ok)throw new Error(response.status===404?'The access token was not accepted.':'Results are unavailable. Check the dates and try again.');return response;}
$('#report-form').addEventListener('submit',async event=>{event.preventDefault();$('#error').textContent='';try{const query=new URLSearchParams({since:$('#since').value+'T00:00:00.000Z',until:$('#until').value+'T00:00:00.000Z',campaign:$('#campaign').value});report=await(await get('/api/campaign-report?'+query)).json();render();}catch(error){$('#error').textContent=error.message;}});
for(const id of ['spend','drawing-cost','margin'])$('#'+id).addEventListener('input',render);
$('#export').addEventListener('click',async()=>{try{const blob=await(await get('/api/launch-signups.csv')).blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='storybook-launch-signups.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}catch(error){$('#error').textContent=error.message;}});

$('#export-preview').addEventListener('click',async()=>{try{const blob=await(await get('/api/preview-emails.csv')).blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='preview-contacts-not-marketing.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}catch(error){$('#error').textContent=error.message;}});
