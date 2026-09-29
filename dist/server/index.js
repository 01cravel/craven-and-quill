import {campaignApi,beginPreview,finishPreview} from './campaign.js';
const RATE_WINDOW_MS=60*60*1000;
const RATE_LIMIT=3;
const rateBuckets=new Map();
const SIGNUP_RATE_LIMIT=20;
const signupBuckets=new Map();
const SIGNUP_INTERESTS=new Set(['ghosts','animals','mandalas','storybook','general']);
const SIGNUPS_TABLE='CREATE TABLE IF NOT EXISTS signups (email TEXT PRIMARY KEY, interest TEXT NOT NULL, page TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)';

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
}

function allowedOrigin(request){
  const origin=request.headers.get('Origin');
  return !origin||origin===new URL(request.url).origin;
}

function rateLimited(request,buckets=rateBuckets,limit=RATE_LIMIT){
  const now=Date.now();const ip=request.headers.get('CF-Connecting-IP')||'unknown';const existing=buckets.get(ip);
  if(!existing||now-existing.startedAt>RATE_WINDOW_MS){buckets.set(ip,{startedAt:now,count:1});return false;}
  existing.count+=1;return existing.count>limit;
}

function clean(value,max=160){return String(value||'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}

function validEmail(value){return value.length<=254&&/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(value);}

function characterPrompt({name,age,mood,story,adjustment}){
  const change=adjustment==='cartoon'?'Make this version noticeably more cartoon-like with bolder shapes and less realistic facial rendering.':adjustment==='likeness'?'Prioritise an even closer likeness to the reference face, hair, eyes, skin tone and smile.':adjustment==='expression'?'Give the character a warmer, more joyful expression while preserving their identity.':'';
  return `Create a brand-new, full-body premium storybook cartoon caricature of the person in the reference photo. The character is ${name||'the story hero'} and the reading audience is ${age||'general'}. Preserve their recognisable identity closely: face shape, skin tone, eye shape and colour, eyebrows, nose, mouth shape, hair colour, texture and style. Keep their apparent age and presentation consistent with the photo. Give them a subtle, natural, friendly smile with gently upturned lips and relaxed eyes, even if the reference expression is neutral or serious. Preserve their recognisable facial features; avoid an exaggerated grin or forced teeth-baring smile. Redraw them from scratch, never apply a filter to the photograph. Make the result clearly illustrated and about 40% stylised: expressive hand-painted shapes, gentle ink outlines, simplified texture, warm personality, not photorealistic, not 3D, no photographic skin. Show the entire body from head to toe, standing naturally, facing mostly forward, centred with comfortable space around the head and feet. Use a simple tasteful outfit suited to the person and story. Story mood: ${mood||'adventure'}. Story context: ${story||'a personalised adventure'}. Use a clean warm off-white background. No scenery, props, text, logos, watermark, border, extra people or cropped limbs. ${change}`;
}

async function generateCharacter(request,env){
  if(request.method!=='POST')return json({error:'Use the character form to create a preview.'},405,{Allow:'POST'});
  if(!allowedOrigin(request))return json({error:'Please reload the page and try again.'},403);
  if(rateLimited(request))return json({error:'You have used the free character tries for now. Please try again in an hour.'},429,{'Retry-After':'3600'});
  if(!env.OPENAI_API_KEY)return json({error:'Character generation is being connected. Please try again shortly.'},503);
  const length=Number(request.headers.get('Content-Length')||0);if(length>10*1024*1024)return json({error:'That photo is too large. Use one under 8 MB.'},413);
  let input;try{input=await request.formData();}catch{return json({error:'We could not read that photo. Please upload it again.'},400);}
  const photo=input.get('photo');
  if(!(photo instanceof File)||!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size<1||photo.size>8*1024*1024)return json({error:'Use a JPG, PNG or WebP photo under 8 MB.'},400);
  let previewId;try{previewId=await beginPreview(env);}catch(error){return json({error:error.message||'Previews are temporarily unavailable.'},503);}
  const details={name:clean(input.get('name'),60),age:clean(input.get('age'),30),mood:clean(input.get('mood'),30),story:clean(input.get('story'),500),adjustment:clean(input.get('adjustment'),30)};
  const form=new FormData();form.append('model','gpt-image-2');form.append('image[]',photo,photo.name||'reference.jpg');form.append('prompt',characterPrompt(details));form.append('size','1024x1536');form.append('quality','medium');form.append('output_format','jpeg');form.append('output_compression','85');
  let response;try{response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form});}catch{await finishPreview(env,previewId,'failed').catch(()=>{});return json({error:'The drawing service did not respond. Please try again.'},502);}
  const requestId=response.headers.get('x-request-id');let result;try{result=await response.json();}catch{await finishPreview(env,previewId,'failed').catch(()=>{});return json({error:'The drawing service returned an unreadable result.'},502);}
  const image=result?.data?.[0]?.b64_json;
  if(!response.ok||!image){
    await finishPreview(env,previewId,'failed').catch(()=>{});
    const code=result?.error?.code||result?.error?.type||'';
    const details=result?.error?.moderation_details;
    console.error('Character drawing failed',response.status,code,requestId,details?.moderation_stage||'');
    if(code==='moderation_blocked')return json({error:'This character preview could not be created. Try a different photo or change the story idea.',code:'character_blocked',requestId},422);
    if(['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached'].includes(code))return json({error:'Previews are paused for a moment. Please try again later.',requestId},503);
    const status=response.status===429?429:response.status===400?400:502;
    return json({error:response.status===429?'The drawing service is busy. Please try again shortly.':'The character could not be drawn this time. Please try again.',requestId},status);
  }
  try{await finishPreview(env,previewId,'succeeded');}catch{return json({error:'Your preview could not be saved. Please try again shortly.'},503);}
  return json({image:`data:image/jpeg;base64,${image}`,requestId,previewId});
}

// Colouring-books launch list. Stores email + what they asked for in the site's own D1 database.
// The table is created on first use so no separate migration step is needed.
async function subscribe(request,env){
  if(request.method!=='POST')return json({error:'Use the signup form.'},405,{Allow:'POST'});
  if(!allowedOrigin(request))return json({error:'Please reload the page and try again.'},403);
  if(rateLimited(request,signupBuckets,SIGNUP_RATE_LIMIT))return json({error:'Too many attempts. Please try again in an hour.'},429,{'Retry-After':'3600'});
  if(!env.DB)return json({error:'Signups are being connected. Please try again shortly.'},503);
  let input;try{input=await request.json();}catch{return json({error:'Please enter your email address.'},400);}
  if(clean(input.website))return json({ok:true});
  const email=clean(input.email,254).toLowerCase();
  if(!validEmail(email))return json({error:'Please enter a valid email address.'},400);
  const interest=SIGNUP_INTERESTS.has(input.interest)?input.interest:'general';
  const requestedPage=clean(input.page,200);const page=requestedPage.startsWith('/')?requestedPage:'/';
  const now=new Date().toISOString();
  try{
    await env.DB.prepare(SIGNUPS_TABLE).run();
    await env.DB.prepare('INSERT INTO signups (email, interest, page, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT(email) DO UPDATE SET interest = excluded.interest, page = excluded.page, updated_at = excluded.updated_at').bind(email,interest,page,now).run();
  }catch{return json({error:'We could not save that just now. Please try again.'},500);}
  return json({ok:true});
}

function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}

// Private export of the launch list. Needs SIGNUPS_EXPORT_TOKEN set in the site's secrets.
async function exportSignups(request,env){
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
  if(!env.SIGNUPS_EXPORT_TOKEN)return json({error:'Export is not configured.'},503);
  const token=new URL(request.url).searchParams.get('token')||'';
  if(token.length!==env.SIGNUPS_EXPORT_TOKEN.length||token!==env.SIGNUPS_EXPORT_TOKEN)return json({error:'Not found.'},404);
  if(!env.DB)return json({error:'Signups are being connected.'},503);
  let rows;try{await env.DB.prepare(SIGNUPS_TABLE).run();rows=(await env.DB.prepare('SELECT email, interest, page, created_at, updated_at FROM signups ORDER BY created_at').all()).results||[];}catch{return json({error:'Could not read signups.'},500);}
  const lines=['email,interest,page,created_at,updated_at',...rows.map(r=>[r.email,r.interest,r.page,r.created_at,r.updated_at].map(csvCell).join(','))];
  return new Response(lines.join('\n')+'\n',{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="signups.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}

async function serveAsset(request,env){
  if(!env.ASSETS)return new Response('Site assets are unavailable.',{status:503});
  const url=new URL(request.url);let path=url.pathname;
  if(path==='/')path='/index.html';else if(!path.split('/').pop().includes('.'))path=`${path.replace(/\/$/,'')}.html`;
  const assetUrl=new URL(url);assetUrl.pathname=path;
  return env.ASSETS.fetch(new Request(assetUrl,request));
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  const campaignResponse=await campaignApi(request,env);if(campaignResponse)return campaignResponse;
  if(url.pathname==='/api/generate-character')return generateCharacter(request,env);
  if(url.pathname==='/api/subscribe')return subscribe(request,env);
  if(url.pathname==='/api/signups.csv')return exportSignups(request,env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return serveAsset(request,env);
}};
