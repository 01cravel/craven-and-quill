const RATE_WINDOW_MS=60*60*1000;
const RATE_LIMIT=3;
const rateBuckets=new Map();

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
}

function allowedOrigin(request){
  const origin=request.headers.get('Origin');
  return !origin||origin===new URL(request.url).origin;
}

function rateLimited(request){
  const now=Date.now();const ip=request.headers.get('CF-Connecting-IP')||'unknown';const existing=rateBuckets.get(ip);
  if(!existing||now-existing.startedAt>RATE_WINDOW_MS){rateBuckets.set(ip,{startedAt:now,count:1});return false;}
  existing.count+=1;return existing.count>RATE_LIMIT;
}

function clean(value,max=160){return String(value||'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}

function characterPrompt({name,age,mood,story,adjustment}){
  const change=adjustment==='cartoon'?'Make this version noticeably more cartoon-like with bolder shapes and less realistic facial rendering.':adjustment==='likeness'?'Prioritise an even closer likeness to the reference face, hair, eyes, skin tone and smile.':adjustment==='expression'?'Give the character a warmer, more joyful expression while preserving their identity.':'';
  return `Create a brand-new, full-body premium storybook cartoon caricature of the person in the reference photo. The character is ${name||'the story hero'} and the reading audience is ${age||'general'}. Preserve their recognisable identity closely: face shape, skin tone, eye shape and colour, eyebrows, nose, smile, hair colour, texture and style. Keep their apparent age and presentation consistent with the photo. Redraw them from scratch, never apply a filter to the photograph. Make the result clearly illustrated and about 40% stylised: expressive hand-painted shapes, gentle ink outlines, simplified texture, warm personality, not photorealistic, not 3D, no photographic skin. Show the entire body from head to toe, standing naturally, facing mostly forward, centred with comfortable space around the head and feet. Use a simple tasteful outfit suited to the person and story. Story mood: ${mood||'adventure'}. Story context: ${story||'a personalised adventure'}. Use a clean warm off-white background. No scenery, props, text, logos, watermark, border, extra people or cropped limbs. ${change}`;
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
  const details={name:clean(input.get('name'),60),age:clean(input.get('age'),30),mood:clean(input.get('mood'),30),story:clean(input.get('story'),500),adjustment:clean(input.get('adjustment'),30)};
  const form=new FormData();form.append('model','gpt-image-2');form.append('image[]',photo,photo.name||'reference.jpg');form.append('prompt',characterPrompt(details));form.append('size','1024x1536');form.append('quality','medium');form.append('output_format','jpeg');form.append('output_compression','85');
  let response;try{response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form});}catch{return json({error:'The drawing service did not respond. Please try again.'},502);}
  const requestId=response.headers.get('x-request-id');let result;try{result=await response.json();}catch{return json({error:'The drawing service returned an unreadable result.'},502);}
  const image=result?.data?.[0]?.b64_json;
  if(!response.ok||!image){const status=response.status===429?429:response.status===400?400:502;return json({error:response.status===429?'The drawing service is busy. Please try again shortly.':'The character could not be drawn from this photo. Try a clearer front-facing photo.',requestId},status);}
  return json({image:`data:image/jpeg;base64,${image}`,requestId});
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
  if(url.pathname==='/api/generate-character')return generateCharacter(request,env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return serveAsset(request,env);
}};
