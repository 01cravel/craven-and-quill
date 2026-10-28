// UK address finder. The Ideal Postcodes key stays on the server: the page only ever talks to /api/address/*.
// Suggestions are free; each resolved address costs one lookup credit, so resolves are rate limited harder.
const HOST='https://api.ideal-postcodes.co.uk/v1';
const HOUR=60*60*1000;
const LIMITS={search:300,resolve:30};
const buckets={search:new Map(),resolve:new Map()};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const text=(value,max=120)=>String(value||'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

function limited(kind,request){
  const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'unknown',map=buckets[kind];
  if(map.size>5000)for(const [key,value] of map)if(now-value.since>=HOUR)map.delete(key);
  const bucket=map.get(ip);
  if(!bucket||now-bucket.since>=HOUR){map.set(ip,{since:now,count:1});return false;}
  bucket.count+=1;return bucket.count>LIMITS[kind];
}

async function supplier(env,path,params){
  const url=new URL(HOST+path);url.searchParams.set('api_key',env.IDEAL_POSTCODES_API_KEY);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const response=await (env.fetch||fetch)(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000)});
  const data=await response.json().catch(()=>null);
  return {ok:response.ok&&data?.code===2000,status:response.status,data};
}

export function addressFromSupplier(a){
  const postcode=text(a?.postcode,12).toUpperCase();
  return {line1:text(a?.line_1,200),line2:text([a?.line_2,a?.line_3].filter(Boolean).join(', '),200),townOrCity:text(a?.post_town,100),county:text(a?.county,100),postcode};
}

export async function addressApi(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/address/'))return null;
  if(request.method!=='GET')return reply({error:'Not found.'},404);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return reply({error:'Please reload the page and try again.'},403);
  const available=!!env.IDEAL_POSTCODES_API_KEY;
  const action=url.pathname.slice('/api/address/'.length);
  if(action==='status')return reply({available});
  if(!available)return reply({error:'Address search is unavailable. Enter the address instead.',available:false},503);
  if(action==='search'){
    const query=text(url.searchParams.get('q'),80);
    if(query.length<2)return reply({hits:[]});
    if(limited('search',request))return reply({error:'Too many searches. Enter the address instead.'},429);
    try{
      const r=await supplier(env,'/autocomplete/addresses',{query,limit:'7',context:'gbr'});
      if(!r.ok)return reply({error:'Address search is unavailable. Enter the address instead.'},502);
      const hits=(r.data.result?.hits||[]).filter(hit=>typeof hit?.id==='string'&&/^[A-Za-z0-9_]{1,40}$/.test(hit.id)).map(hit=>({id:hit.id,suggestion:text(hit.suggestion,160)})).slice(0,7);
      return reply({hits});
    }catch{return reply({error:'Address search is unavailable. Enter the address instead.'},502);}
  }
  if(action==='resolve'){
    const id=url.searchParams.get('id')||'';
    if(!/^[A-Za-z0-9_]{1,40}$/.test(id))return reply({error:'Choose an address from the list.'},400);
    if(limited('resolve',request))return reply({error:'Too many address lookups. Enter the address instead.'},429);
    try{
      const r=await supplier(env,`/autocomplete/addresses/${encodeURIComponent(id)}/gbr`,{});
      if(r.status===404)return reply({error:'That address could not be found. Try again or enter it instead.'},404);
      if(!r.ok)return reply({error:'Address search is unavailable. Enter the address instead.'},502);
      const address=addressFromSupplier(r.data.result);
      if(!address.line1||!address.townOrCity||!address.postcode)return reply({error:'That address is incomplete. Enter it instead.'},422);
      return reply({address});
    }catch{return reply({error:'Address search is unavailable. Enter the address instead.'},502);}
  }
  return reply({error:'Not found.'},404);
}
