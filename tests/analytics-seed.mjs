// Invented sample traffic for analytics tests and the local preview. Never real customer data.
const FLOW=['landing_view','maker_start','step_1','step_2','preview_start','preview_success','step_5','step_4','story_generated','price_visible','step_7','checkout_start'];
const ADS=[['meta','paid_social','cq_d_drop_photo','d_video'],['meta','paid_social','cq_d_drop_photo','d_static'],['direct','none','organic','none'],['instagram','social','organic','bio_link']];
const COUNTRIES=['GB','GB','GB','GB','GB','IE','US','AE'];
const TOWNS={GB:[['Leeds','England'],['Manchester','England'],['Glasgow','Scotland'],['Bristol','England'],['Cardiff','Wales']],IE:[['Dublin','Leinster']],US:[['Austin','Texas']],AE:[['Dubai','Dubai']]};

// Deterministic so tests and screenshots are repeatable.
function random(seed){let x=seed>>>0;return ()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};}

export function seedAnalytics(DB,{now=Date.now(),days=7,visits=140}={}){
  const r=random(42),db=DB.sqlite;
  const event=db.prepare('INSERT INTO campaign_events (id, visit_id, event, source, medium, campaign, creative, country, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  const receipt=db.prepare('INSERT INTO preview_receipts (id, status, created_at, email) VALUES (?,?,?,?)');
  const contact=db.prepare('INSERT OR IGNORE INTO preview_contacts (email, source, medium, campaign, creative, country, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)');
  const order=db.prepare('INSERT INTO customer_orders (id, token_hash, email, size, amount, status, payment_status, payment_mode, revision, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?,?)');
  const detail=db.prepare('INSERT INTO visit_details (visit_id, ip_prefix, town, region, created_at) VALUES (?,?,?,?,?)'),link=db.prepare('INSERT OR IGNORE INTO visit_links (visit_id, kind, ref, created_at) VALUES (?,?,?,?)');
  const counter=db.prepare("INSERT INTO visit_counts VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO UPDATE SET n = n + excluded.n");
  const STEPS=new Set(['maker_start','step_1','step_2','preview_start','preview_success','price_visible','checkout_start']);
  const tallyCount=(t,event,ad,country,n=1)=>counter.run(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(t),event,ad[0],ad[1],ad[2],ad[3],country,r()<.8?'mobile':'desktop',n);
  const names=['Amara','Jamie','Olly','Ruby','Teddy','Isla','Biscuit','Leo','Poppy','Max'];
  const created=[];
  for(let i=0;i<visits;i++){
    const ad=ADS[Math.floor(r()*r()*ADS.length)],country=COUNTRIES[Math.floor(r()*COUNTRIES.length)],visit=crypto.randomUUID();
    let t=now-Math.floor(r()*days*86400000);const evening=r()<.5;if(evening)t-=(t%86400000)-(19*3600000)+Math.floor(r()*3)*3600000;if(t>now)t-=86400000;
    const at=()=>{t+=Math.floor(20000+r()*90000);return new Date(Math.min(t,now)).toISOString();};
    const start=ad[0]==='meta'?1:0;let depth=start;
    while(depth<FLOW.length-1&&r()<(depth<4?.72:.8))depth++;
    const steps=FLOW.slice(start,depth+1);
    const failed=steps.includes('preview_start')&&!steps.includes('preview_success')&&r()<.6;
    for(const step of steps)event.run(visit+':'+step,visit,step,...ad,country,at());
    // Cookie-free counts also see the visitors who ignored the banner, roughly three for every one measured.
    tallyCount(t,'arrive',ad,country,1+Math.floor(r()*4));for(const step of steps)if(STEPS.has(step))tallyCount(t,step,ad,country,1+Math.floor(r()*2));
    const town=TOWNS[country][Math.floor(r()*TOWNS[country].length)];detail.run(visit,`${80+Math.floor(r()*90)}.${Math.floor(r()*255)}.${Math.floor(r()*255)}.0`,...town,new Date(t).toISOString());
    event.run(visit+':device',visit,r()<.78?'device_mobile':'device_desktop',...ad,country,at());
    if(failed)event.run(visit+':preview_error',visit,'preview_error',...ad,country,at());
    if(steps.includes('preview_start')){
      const email=`reader${i}@example.test`;
      const tries=failed&&r()<.5?2:1;
      for(let n=0;n<tries;n++){const id=crypto.randomUUID(),status=n<tries-1?'failed':steps.includes('preview_success')?'succeeded':failed?'failed':'started';receipt.run(id,status,new Date(t-60000+n).toISOString(),email);link.run(visit,'preview',id,new Date(t-60000+n).toISOString());}
      contact.run(email,...ad,country,new Date(t-90000).toISOString(),new Date(t-90000).toISOString());link.run(visit,'contact',email,new Date(t-90000).toISOString());
      if(steps.includes('checkout_start')){
        const paid=r()<.55,id=crypto.randomUUID(),name=names[i%names.length],when=at();
        const state={names:name,age:r()<.5?'3-5':'6-8',story:{title:`${name} and the ${['Moonlit Picnic','Missing Sandwich','Brave Little Boat','Secret Garden Door'][i%4]}`,synopsis:`${name} sets off on a small adventure that ends with everyone laughing.`},characters:[],measurement:{visitId:visit,source:ad[0],medium:ad[1],campaign:ad[2],creative:ad[3],country}};
        order.run(id,'hash-'+i,email,i%3?'a5':'a4',i%3?3999:4799,paid?'awaiting_review':'saved',paid?'paid':'unpaid',paid?'live':null,JSON.stringify(state),when,when);
        if(!paid&&r()<.4)event.run(visit+':checkout_error',visit,'checkout_error',...ad,country,at());
        created.push({id,paid,creative:ad[3]});
      }
    }
  }
  return {orders:created};
}
