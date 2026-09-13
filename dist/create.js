const state={step:1,names:'',secondName:'',age:'6-8',mood:'adventure',ownIdea:'',ideas:[],selected:0,photos:[],photoChecks:[],previewApproved:false,previewAdjusted:false,product:'digital',price:19};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const track=(event,data={})=>{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event,...data});};
track('story_maker_open',{offer:'one_page_free'});

const ideaBanks={
  funny:[
    ['The Great Cake Mix-Up','A runaway birthday cake gathers a whole town for the silliest party ever.'],
    ['The Very Polite Dragon','A hiccupping dragon needs help saying excuse me without setting the curtains alight.'],
    ['Penguins at Breakfast','Three penguins arrive for pancakes and try very hard to act normal.'],
    ['The Socks That Escaped','Every missing sock has built a secret kingdom and sent an invitation to tea.'],
    ['The Moon Has the Giggles','The moon cannot stop laughing, and the stars need help getting to sleep.']
  ],
  adventure:[
    ['The Map Beneath the Moon','A silver map opens a river to a library hidden among the clouds.'],
    ['The Lantern Beyond the Woods','A small light reveals a hidden path and a lost fox waiting to be guided home.'],
    ['The Cloudship Captain','A silver cloudship lands outside with an empty captain’s chair and a storm ahead.'],
    ['The Library Beneath the Lake','A paper boat leads to a library where unfinished stories need a brave ending.'],
    ['The Mountain That Moved','A wandering mountain must be brought home before the last light leaves the valley.']
  ],
  classic:[
    ['The Little Cloud','A tiny cloud needs a kind friend to help the garden and find its family.'],
    ['The Birthday Star','A fallen star needs help finding the warmest light in the whole wide world.'],
    ['The Door in the Old Oak','A tiny garden door opens onto a kingdom preparing for its first spring.'],
    ['The Snowdrop Crown','The first flower of spring must be carried safely through a quiet, sleeping wood.'],
    ['The Little House of Light','A lonely house glows brighter with every act of kindness.']
  ]
};
let ideaOffset=0;
let photoUrls=[];

function fullNames(){return[state.names,state.secondName].filter(Boolean).join(' and ');}
function getBookSlug(){const value=fullNames().toLowerCase();if(value.includes('luke')||state.mood==='funny')return'luke';if(value.includes('noah')||state.age==='3-5'||state.mood==='classic')return'noah';return'amara';}
function updateCover(){$('#mini-cover-art').src='assets/storybook.webp';$('#mini-cover-art').alt=`Sample ${state.mood==='own'?'personalised':state.mood} story cover`;}
function updateLive(){
  state.names=$('#names').value.trim();
  state.secondName=$('#second-person').hidden?'':$('#second-name').value.trim();
  state.age=($('input[name="age"]:checked')||{}).value||'6-8';
  state.mood=($('input[name="mood"]:checked')||{}).value||'adventure';
  $('#live-name').textContent=(fullNames()||'Someone special').toUpperCase();
  $('#live-age').textContent=`Age ${state.age.replace('-', '–')}`;
  $('#live-mood').textContent=state.mood==='own'?'Their own idea':state.mood[0].toUpperCase()+state.mood.slice(1);
  const chosen=state.ideas[state.selected];
  $('#live-title').textContent=state.mood==='own'?'Their own adventure':chosen?.[0]||ideaBanks[state.mood]?.[0]?.[0]||'Their own story';
  updateCover();
}

function showStep(number){
  state.step=number;
  $$('.step').forEach(step=>{const active=Number(step.dataset.step)===number;step.hidden=!active;step.classList.toggle('active',active);});
  $$('.journey-step').forEach(item=>{const n=Number(item.dataset.progress);item.classList.toggle('active',n===number);item.classList.toggle('done',n<number);});
  window.scrollTo({top:0,behavior:'smooth'});
  track('story_step_view',{step:number});
}

function buildIdeas(){
  state.mood=($('input[name="mood"]:checked')||{}).value||'adventure';
  const own=state.mood==='own';
  $('#ai-ideas').hidden=own;
  $('#own-options').hidden=!own;
  if(own){state.ideas=[];state.selected=0;updateLive();return;}
  const bank=ideaBanks[state.mood];
  state.ideas=[0,1,2].map(index=>bank[(index+ideaOffset)%bank.length]);
  const list=$('#idea-list');list.replaceChildren();
  state.ideas.forEach((idea,index)=>{
    const label=document.createElement('label');label.className='idea';
    label.innerHTML=`<input type="radio" name="story-idea" value="${index}" ${index===0?'checked':''}><span><b>${idea[0]}</b><small>${idea[1]}</small></span>`;
    label.querySelector('input').addEventListener('change',()=>{state.selected=index;updateLive();});
    list.append(label);
  });
  state.selected=0;updateLive();
}

$('#names').addEventListener('input',updateLive);
$('#second-name').addEventListener('input',updateLive);
$$('input[name="age"]').forEach(input=>input.addEventListener('change',updateLive));
$$('input[name="mood"]').forEach(input=>input.addEventListener('change',()=>{ideaOffset=0;buildIdeas();}));
$('#add-person').addEventListener('click',()=>{const panel=$('#second-person');const opening=panel.hidden;panel.hidden=!opening;$('#add-person').innerHTML=opening?'− Remove second person <span>Optional</span>':'+ Add another person <span>Optional</span>';if(opening)$('#second-name').focus();else{$('#second-name').value='';updateLive();}});
$('#shuffle-ideas').addEventListener('click',()=>{ideaOffset=(ideaOffset+3)%5;buildIdeas();track('story_ideas_shuffled',{mood:state.mood});});
$$('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{$('#own-idea').value=button.dataset.prompt;$('#own-idea').focus();}));

async function inspectPhoto(file){
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))return{pass:false,message:'Use a JPG, PNG or WebP image.'};
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch{return{pass:false,message:'This image could not be read. Try another file.'};}
  const width=bitmap.width,height=bitmap.height,short=Math.min(width,height);
  if(short<640){bitmap.close();return{pass:false,message:`This photo is ${width}×${height}. Use at least 640 pixels on the shortest side.`};}
  const canvas=document.createElement('canvas');const size=180;canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,size,size);bitmap.close();
  const data=ctx.getImageData(0,0,size,size).data;let light=0,contrast=0,edges=0;const grey=[];
  for(let index=0;index<data.length;index+=4){const value=.299*data[index]+.587*data[index+1]+.114*data[index+2];grey.push(value);light+=value;}
  light/=grey.length;for(const value of grey)contrast+=(value-light)*(value-light);contrast=Math.sqrt(contrast/grey.length);
  for(let y=1;y<size-1;y++){for(let x=1;x<size-1;x++){const index=y*size+x;edges+=Math.abs(4*grey[index]-grey[index-1]-grey[index+1]-grey[index-size]-grey[index+size]);}}
  edges/=((size-2)*(size-2));
  if(light<45||light>225)return{pass:false,message:'The face is too dark or washed out. Use an evenly lit photo.'};
  if(contrast<22||edges<9)return{pass:false,message:'The photo is too soft. Use a sharper, clearer photo.'};
  let faceMessage='Size, light and sharpness passed. Confirm the face manually below.';
  if('FaceDetector' in window){
    try{const detector=new FaceDetector({fastMode:true,maxDetectedFaces:5});const image=await createImageBitmap(file);const faces=await detector.detect(image);image.close();if(faces.length!==1)return{pass:false,message:faces.length===0?'No clear face was found. Use a front-facing photo.':'More than one face was found. Upload one person per photo.'};faceMessage='One clear face found. Confirm it manually below.';}catch{}
  }
  return{pass:true,message:faceMessage};
}

$('#photos').addEventListener('change',async event=>{
  photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];
  const requiredCount=$('#second-person').hidden?1:2;
  const files=[...event.target.files].slice(0,requiredCount);
  state.photos=files;state.photoChecks=[];$('#photo-list').replaceChildren();$('#face-confirm').checked=false;
  const check=$('#photo-check');check.hidden=false;check.className='photo-check';check.innerHTML='<strong>Checking the photo…</strong><span>Looking at size, light, sharpness and face count.</span>';
  files.forEach((file,index)=>{const url=URL.createObjectURL(file);photoUrls.push(url);const thumb=document.createElement('img');thumb.src=url;thumb.alt=`Selected photo ${index+1}`;$('#photo-list').append(thumb);});
  if(!files.length){check.hidden=true;$('#face-confirm-wrap').hidden=true;return;}
  state.photoChecks=await Promise.all(files.map(inspectPhoto));
  const failed=state.photoChecks.find(item=>!item.pass);
  const countProblem=files.length!==requiredCount;
  check.classList.add(failed||countProblem?'fail':'pass');
  check.innerHTML=countProblem?`<strong>Add ${requiredCount===2?'two photos':'one photo'}</strong><span>Use one separate photo for each person.</span>`:failed?`<strong>Use another photo</strong><span>${failed.message}</span>`:`<strong>${requiredCount===2?'Both photos passed':'Photo passed'} the automatic checks</strong><span>${state.photoChecks.map(item=>item.message).join(' ')}</span>`;
  $('#face-confirm-wrap').hidden=Boolean(failed||countProblem);$('#step-3-error').textContent='';
  track('photos_checked',{count:files.length,passed:!failed&&!countProblem});
});

function selectedStory(){
  if(state.mood==='own'){
    const summary=$('#own-idea').value.trim();
    const hero=fullNames()||'The Hero';
    let customTitle=`${hero}’s Own Adventure`;
    if(/alien|spaceship|space ship|ufo/i.test(summary)&&/dubai/i.test(summary))customTitle=`${hero} and the Visitors Above Dubai`;
    else if(/alien|spaceship|space ship|ufo/i.test(summary))customTitle=`${hero} and the Visitors from the Stars`;
    else if(/birthday|cake/i.test(summary))customTitle=`${hero} and the Birthday Surprise`;
    return[customTitle,summary];
  }
  const selected=$('input[name="story-idea"]:checked');
  state.selected=selected?Number(selected.value):0;
  return state.ideas[state.selected];
}

function previewText(idea){
  const who=fullNames()||'Our hero';
  if(state.mood==='own'){
    if(state.age==='3-5')return`${who} took one brave step. ${idea[1]} And that was where the adventure began.`;
    if(state.age==='9-11')return`${who} had always thought ordinary days announced themselves clearly. Then ${idea[1].charAt(0).toLowerCase()+idea[1].slice(1)} One choice was about to change everything.`;
    return`${who} noticed something impossible. ${idea[1]} With one brave step, the ordinary world slipped away.`;
  }
  if(state.age==='3-5')return`${who} found something surprising. It wiggled. It sparkled. “Let’s help,” said ${state.names||'our hero'}. And off they went.`;
  if(state.age==='9-11')return`${who} knew the day had gone wonderfully wrong when the first clue appeared. ${idea[1]} There was no sensible reason to follow it, which made following it irresistible.`;
  return`${who} noticed a curious light where no light should be. ${idea[1]} With one brave step, the adventure began.`;
}

function preparePreview(){
  const idea=selectedStory();const slug=getBookSlug();
  state.previewApproved=false;$('#choose-book').disabled=true;$('#approve-face').classList.remove('selected');$('#adjust-panel').hidden=true;
  $('#result-names').textContent=fullNames();$('#result-story-title').textContent=idea[0];$('#live-title').textContent=idea[0];
  $('#story-copy').textContent=previewText(idea);$('#preview-image').src='assets/storybook.webp';$('#preview-image').alt=`Sample opening illustration format for ${idea[0]}`;
  $('#likeness-title').textContent=`Does this look like ${fullNames()}?`;
  $('#making-state').hidden=false;$('#result-state').hidden=true;
  $$('#making-state li').forEach((item,index)=>item.classList.toggle('done',index===0));
  setTimeout(()=>{$$('#making-state li').forEach((item,index)=>setTimeout(()=>item.classList.add('done'),index*220));setTimeout(()=>{$('#making-state').hidden=true;$('#result-state').hidden=false;track('free_preview_created',{mood:state.mood,age:state.age,pages_generated:1});},900);},80);
}

for(let index=0;index<10;index+=1){const marker=document.createElement('span');marker.setAttribute('aria-hidden','true');$('#locked-dots').append(marker);}

$('#approve-face').addEventListener('click',()=>{state.previewApproved=true;$('#approve-face').classList.add('selected');$('#adjust-face').classList.remove('selected');$('#adjust-panel').hidden=true;$('#choose-book').disabled=false;$('#step-4-error').textContent='';track('preview_likeness_approved',{adjusted:state.previewAdjusted});});
$('#adjust-face').addEventListener('click',()=>{state.previewApproved=false;$('#choose-book').disabled=true;$('#approve-face').classList.remove('selected');$('#adjust-face').classList.add('selected');$('#adjust-panel').hidden=false;});
$('#update-preview').addEventListener('click',()=>{const button=$('#update-preview');state.previewAdjusted=true;button.disabled=true;button.textContent='Updating one free page…';setTimeout(()=>{button.disabled=false;button.textContent='Preview updated. Check it again';$('#adjust-panel').hidden=true;$('#adjust-face').classList.remove('selected');track('free_preview_adjusted',{adjustment:$('input[name="adjustment"]:checked').value});},700);});

$$('[data-next]').forEach(button=>button.addEventListener('click',()=>{
  const next=Number(button.dataset.next);
  if(state.step===1){
    updateLive();
    if(!state.names){$('#step-1-error').textContent='Add their first name to continue.';$('#names').focus();return;}
    if(!$('#second-person').hidden&&!state.secondName){$('#step-1-error').textContent='Add the second person’s first name or remove that option.';$('#second-name').focus();return;}
    $('#step-1-error').textContent='';buildIdeas();
  }
  if(state.step===2){
    state.mood=$('input[name="mood"]:checked').value;state.ownIdea=$('#own-idea').value.trim();
    if(state.mood==='own'&&!state.ownIdea){$('#step-2-error').textContent='Tell us what should happen, even in one sentence.';$('#own-idea').focus();return;}
    if(state.mood!=='own'&&!$('input[name="story-idea"]:checked')){$('#step-2-error').textContent='Choose one story idea.';return;}
    $('#step-2-error').textContent='';updateLive();
  }
  if(state.step===3){
    const requiredCount=$('#second-person').hidden?1:2;
    if(state.photos.length!==requiredCount){$('#step-3-error').textContent=`Add ${requiredCount===2?'one clear photo for each person':'one clear photo'} to continue.`;return;}
    if(state.photoChecks.length!==state.photos.length){$('#step-3-error').textContent='Wait for the photo check to finish.';return;}
    if(state.photoChecks.some(item=>!item.pass)){$('#step-3-error').textContent='Use a photo that passes every check.';return;}
    if(!$('#face-confirm').checked){$('#step-3-error').textContent='Confirm that every face is clearly recognisable.';$('#face-confirm').focus();return;}
    if(!$('#photo-permission').checked){$('#step-3-error').textContent='Confirm that you have permission to use the photos.';$('#photo-permission').focus();return;}
    $('#step-3-error').textContent='';preparePreview();
  }
  if(state.step===4&&!state.previewApproved){$('#step-4-error').textContent='Confirm the character looks right before choosing your book.';return;}
  showStep(next);
}));

$$('[data-back]').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.back))));

function updateProduct(){
  const chosen=$('input[name="product"]:checked');state.product=chosen.value;state.price=Number(chosen.dataset.price);
  const hardback=state.product==='hardback';$('#shipping-fields').hidden=!hardback;
  const label=hardback?'Hardback + digital + animation':'Digital book + animation';
  $('#order-label').textContent=label;$('#order-price').textContent=`£${state.price}`;$('#button-price').textContent=`£${state.price}`;
}
$$('input[name="product"]').forEach(input=>input.addEventListener('change',updateProduct));

$('#place-order').addEventListener('click',()=>{
  updateProduct();const email=$('#email').value.trim();const giftOpen=$('.gift-extra').open;
  if(!email||!$('#email').validity.valid){$('#step-5-error').textContent='Enter a valid email address for the book.';$('#email').focus();return;}
  if(state.product==='hardback'&&!$('#address').value.trim()){$('#step-5-error').textContent='Add the delivery address for the hardback.';$('#address').focus();return;}
  if(giftOpen&&!$('#gift-from').value.trim()){$('#step-5-error').textContent='Add who the gift message is from, or close the gift message.';$('#gift-from').focus();return;}
  if(!$('#card-name').value.trim()||$('#card-number').value.replace(/\D/g,'').length!==16||!/^\d{2}\/\d{2}$/.test($('#card-expiry').value.trim())||!/^\d{3,4}$/.test($('#card-cvc').value.trim())){$('#step-5-error').textContent='Check the test payment details to continue.';$('#card-name').focus();return;}
  $('#step-5-error').textContent='';
  const idea=selectedStory();const slug=getBookSlug();
  const payload={book:slug,names:fullNames(),age:state.age,mode:state.mood==='own'?'own':'ai',mood:state.mood,title:idea[0],storySummary:idea[1],format:'both',gift:giftOpen,giftFrom:$('#gift-from').value.trim(),giftMessage:$('#gift-message').value.trim(),product:state.product,price:state.price,paymentStatus:'test-paid'};
  localStorage.setItem('craven-quill-story-idea',JSON.stringify(payload));
  const button=$('#place-order');button.disabled=true;button.textContent='Payment accepted. Creating the full book…';
  track('test_order_placed',{product:state.product,price:state.price,full_pages_authorised:10});
  setTimeout(()=>{window.location.href=`test-book.html?book=${slug}&order=1`;},850);
});

const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();try{void Promise.resolve(context.registerTool({name:'read_story_maker_state',title:'Read story maker',description:'Read the visible step and non-photo choices. Uploaded images are never exposed.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({step:state.step,names:fullNames(),age:state.age,mood:state.mood,selectedIdea:selectedStory()?.[0]||null,previewApproved:state.previewApproved,product:state.product})},{signal:lifecycle.signal})).catch(()=>{});}catch{}}

buildIdeas();updateLive();updateProduct();
