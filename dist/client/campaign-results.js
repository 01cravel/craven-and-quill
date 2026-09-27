const $=selector=>document.querySelector(selector);let report;
$('#since').value=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
function rows(target,data,keys){target.replaceChildren();for(const row of data){const tr=document.createElement('tr');for(const key of keys){const td=document.createElement('td');td.textContent=row[key]??'';tr.append(td);}target.append(tr);}}
function render(){
  if(!report)return;
  const paid=report.leads.filter(row=>row.source==='meta'&&row.campaign==='cq_uk_launch_2026'&&row.country==='GB');
  const count=paid.reduce((n,row)=>n+row.signups,0);
  const all=report.leads.reduce((n,row)=>n+row.signups,0);
  const spend=Math.max(0,Number($('#spend').value)||0);
  const attempts=report.previews.reduce((n,row)=>n+row.attempts,0);
  const success=report.previews.find(row=>row.status==='succeeded')?.attempts||0;
  const measured=report.measuredConversion||{visitors:0,converted_visitors:0};
  const stats=[['UK paid signups',count],['All-source signups',all],['Cost / UK paid signup',count&&spend?'£'+(spend/count).toFixed(2):'Enter spend'],['Measured visitor conversion',measured.visitors?(100*measured.converted_visitors/measured.visitors).toFixed(1)+'%':'No measured visits'],['Drawing requests',attempts],['Preview success',attempts?(100*success/attempts).toFixed(1)+'%':'No attempts']];
  $('#stats').replaceChildren();
  for(const [title,value]of stats){const card=document.createElement('article');const label=document.createElement('span');label.textContent=title;const number=document.createElement('strong');number.textContent=value;card.append(label,number);$('#stats').append(card);}
  const decisions=[];
  if(attempts>=20&&success/attempts<0.9)decisions.push('Pause ads: more than 10% of drawing requests have not completed.');
  if(spend>=200)decisions.push('The £200 test cap has been reached. Stop spending and review.');
  if(spend>=50&&!count)decisions.push('Pause: £50 or more spent with no UK paid signups.');
  if(!spend)decisions.push('Enter actual Meta spend for this date range to assess cost.');
  else if(count<30)decisions.push('Fewer than 30 signups: evidence remains limited. Do not automatically extend the test.');
  else if(spend/count<=4)decisions.push('Signup cost target met. Check signup quality before a paid-order test.');
  else if(spend/count<=8)decisions.push('Improve the offer or journey before another test.');
  else decisions.push('Pause this approach. Signup cost is above £8.');
  if(measured.visitors>=100&&measured.converted_visitors/measured.visitors<0.05)decisions.push('Fewer than 5% of measured visitors joined. Revisit the page or offer.');
  $('#decision').textContent=decisions.join(' ');
  $('#note').textContent=report.note+' Cost uses Meta signups attributed to cq_uk_launch_2026 from GB. Enter matching campaign spend in GBP. These are review prompts, not automatic controls on Meta spending. Counts do not prove sales or profitability.';
  rows($('#leads'),report.leads,['source','campaign','creative','country','signups','active_signups']);
  rows($('#events'),report.events,['source','campaign','creative','country','event','visits']);
  $('#report').hidden=false;
}
async function get(path){const response=await fetch(path,{headers:{Authorization:'Bearer '+$('#access-token').value}});if(!response.ok)throw new Error(response.status===404?'The access token was not accepted.':'Results are unavailable. Try again shortly.');return response;}
$('#report-form').addEventListener('submit',async event=>{event.preventDefault();$('#error').textContent='';try{report=await(await get('/api/campaign-report?since='+encodeURIComponent($('#since').value+'T00:00:00.000Z'))).json();render();}catch(error){$('#error').textContent=error.message;}});
$('#spend').addEventListener('input',render);
$('#export').addEventListener('click',async()=>{try{const blob=await(await get('/api/launch-signups.csv')).blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='storybook-launch-signups.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}catch(error){$('#error').textContent=error.message;}});
