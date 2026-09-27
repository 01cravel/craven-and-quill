const state={previewId:null,step:1,names:'',secondName:'',age:'6-8',mood:'adventure',ownIdea:'',ideas:[],selected:0,photos:[],photoChecks:[],characterImages:[],product:'bundle',price:49.99};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const track=(event,data={})=>{const names={free_preview_created:'preview_success',free_preview_failed:'preview_error'};if(names[event])window.cqMeasurement?.record(names[event]);};
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
  const ageLabels={'3-5':'Age 3–5','6-8':'Age 6–8','9-11':'Age 9–11','9-12':'Age 9–12','teen-adult':'Teen or adult'};
  $('#live-age').textContent=ageLabels[state.age]||'Reading level set';
  $('#live-mood').textContent=state.mood==='own'?'Their own idea':state.mood[0].toUpperCase()+state.mood.slice(1);
  const chosen=state.ideas[state.selected];
  $('#live-title').textContent=state.mood==='own'?'Their own adventure':chosen?.[0]||ideaBanks[state.mood]?.[0]?.[0]||'Their own story';
  updateCover();
}

function showStep(number){
  state.step=number;
  if(number===6)window.cqMeasurement?.record('price_view');
  $$('.step').forEach(step=>{const active=Number(step.dataset.step)===number;step.hidden=!active;step.classList.toggle('active',active);});
  $$('.journey-step').forEach(item=>{const n=Number(item.dataset.progress);item.classList.toggle('active',n===number);item.classList.toggle('done',n<number);});
  const current=document.querySelector(`.journey-step[data-progress="${number}"] em`);$('#progress-num').textContent=number;$('#progress-name').textContent=current?current.textContent:'';$('#progress-fill').style.width=`${number/7*100}%`;
  window.scrollTo({top:0,behavior:'smooth'});
  track('story_step_view',{step:number});
}

function buildIdeas(){
  state.mood=($('input[name="mood"]:checked')||{}).value||'adventure';
  const own=state.mood==='own';
  $('#step-3-title').textContent=own?'Tell us your story.':'Choose their story.';
  $('#story-choice-intro').textContent=own?'Describe what should happen. One or two sentences is enough.':'Pick one idea, or ask us for different ones.';
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
    const canvas=document.createElement('canvas');const size=180;canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,size,size);bitmap.close();
  const data=ctx.getImageData(0,0,size,size).data;let light=0,contrast=0,edges=0;const grey=[];
  for(let index=0;index<data.length;index+=4){const value=.299*data[index]+.587*data[index+1]+.114*data[index+2];grey.push(value);light+=value;}
  light/=grey.length;for(const value of grey)contrast+=(value-light)*(value-light);contrast=Math.sqrt(contrast/grey.length);
  for(let y=1;y<size-1;y++){for(let x=1;x<size-1;x++){const index=y*size+x;edges+=Math.abs(4*grey[index]-grey[index-1]-grey[index+1]-grey[index-size]-grey[index+size]);}}
  edges/=((size-2)*(size-2));
  if(light<45||light>225)return{pass:false,message:'The face is too dark or washed out. Use an evenly lit photo.'};
  if(contrast<22||edges<9)return{pass:false,message:'The photo is too soft. Use a sharper, clearer photo.'};
  let faceMessage='Light and sharpness passed. Confirm the face manually below.';
  if('FaceDetector' in window){
    try{const detector=new FaceDetector({fastMode:true,maxDetectedFaces:5});const image=await createImageBitmap(file);const faces=await detector.detect(image);image.close();if(faces.length!==1)return{pass:false,message:faces.length===0?'No clear face was found. Use a front-facing photo.':'More than one face was found. Upload one person per photo.'};faceMessage='One clear face found. Confirm it manually below.';}catch{}
  }
  return{pass:true,message:faceMessage};
}

$('#photos').addEventListener('change',async event=>{
  photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];
  const requiredCount=$('#second-person').hidden?1:2;
  const files=[...event.target.files].slice(0,requiredCount);
  state.photos=files;state.photoChecks=[];state.characterImages=[];$('#photo-list').replaceChildren();$('#face-confirm').checked=false;
  const check=$('#photo-check');check.hidden=false;check.className='photo-check';check.innerHTML='<strong>Checking the photo…</strong>';
  files.forEach((file,index)=>{const url=URL.createObjectURL(file);photoUrls.push(url);const thumb=document.createElement('img');thumb.src=url;thumb.alt=`Selected photo ${index+1}`;$('#photo-list').append(thumb);});
  $('.upload-wrap').classList.toggle('has-photo',files.length>0);$('.upload strong').textContent=files.length?(files.length>1?'Photos added':'Photo added'):'Add a photo';$('.upload small').textContent=files.length?'Tap to change':'Face forward, both eyes clear, no sunglasses.';$('.upload-icon').style.backgroundImage=files.length?`url(${photoUrls[0]})`:'';
  if(!files.length){check.hidden=true;$('#face-confirm-wrap').hidden=true;return;}
  state.photoChecks=await Promise.all(files.map(inspectPhoto));
  const failed=state.photoChecks.find(item=>!item.pass);
  const countProblem=files.length!==requiredCount;
  check.classList.add(failed||countProblem?'fail':'pass');
  check.innerHTML=countProblem?`<strong>Add ${requiredCount===2?'two photos':'one photo'}</strong><span>Use one separate photo for each person.</span>`:failed?`<strong>Use another photo</strong><span>${failed.message}</span>`:`<strong>${requiredCount===2?'Both photos look good':'Photo looks good'}</strong><span>Tick below to confirm the face is clear.</span>`;
  $('#face-confirm-wrap').hidden=Boolean(failed||countProblem);$('#step-4-error').textContent='';
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
    if(['9-11','9-12','teen-adult'].includes(state.age))return`${who} had always thought ordinary days announced themselves clearly. Then ${idea[1].charAt(0).toLowerCase()+idea[1].slice(1)} One choice was about to change everything.`;
    return`${who} noticed something impossible. ${idea[1]} With one brave step, the ordinary world slipped away.`;
  }
  if(state.age==='3-5')return`${who} found something surprising. It wiggled. It sparkled. “Let’s help,” said ${state.names||'our hero'}. And off they went.`;
  if(['9-11','9-12','teen-adult'].includes(state.age))return`${who} knew the day had gone wonderfully wrong when the first clue appeared. ${idea[1]} There was no sensible reason to follow it, which made following it irresistible.`;
  return`${who} noticed a curious light where no light should be. ${idea[1]} With one brave step, the adventure began.`;
}

async function requestCharacter(file,name){
  const idea=selectedStory();const form=new FormData();
  form.append('photo',file,file.name||'photo.jpg');form.append('name',name);form.append('age',state.age);form.append('mood',state.mood);form.append('story',idea?.[1]||'');
  const response=await fetch('/api/generate-character',{method:'POST',body:form,headers:{'X-Craven-Preview':'character'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.image)throw Object.assign(new Error(data.error||'The character could not be drawn. Please try again.'),{code:data.code});
  state.previewId=data.previewId||null;
  return data.image;
}

async function renderStoryArt(){
  for(let index=0;index<state.photos.length;index+=1){
    const file=state.photos[index];const name=index===0?state.names:state.secondName;
    state.characterImages[index]=state.characterImages[index]||await requestCharacter(file,name);
  }
  $('#preview-image').src=state.characterImages[0];$('#preview-image').alt=`Illustrated ${state.names} on the first story page`;
  const second=$('#preview-image-second');const hasSecond=Boolean(state.characterImages[1]);
  second.hidden=!hasSecond;$('#preview-art').classList.toggle('two-people',hasSecond);
  if(hasSecond){second.src=state.characterImages[1];second.alt=`Illustrated ${state.secondName} on the first story page`;}
}

async function preparePreview(){
  const idea=selectedStory();
  window.cqMeasurement?.record('preview_start');
  $('#choose-book').disabled=true;
  $('#result-story-title').textContent=idea[0];$('#live-title').textContent=idea[0];
  $('#story-copy').textContent=previewText(idea);$('#preview-image').src='assets/storybook.webp';$('#preview-image').alt=`Sample opening illustration format for ${idea[0]}`;
  $('#preview-image-second').hidden=true;$('#preview-art').classList.remove('two-people');
  $('#making-state').hidden=false;$('#result-state').hidden=true;
  $('#generation-error').hidden=true;$('#blocked-actions').hidden=true;$('#retry-generation').hidden=false;$$('#making-state li').forEach((item,index)=>item.classList.toggle('done',index===0));
  try{
    $$('#making-state li')[1].classList.add('done');await renderStoryArt();$$('#making-state li')[2].classList.add('done');
    $('#making-state').hidden=true;$('#result-state').hidden=false;$('#choose-book').disabled=false;track('free_preview_created',{mood:state.mood,age:state.age,pages_generated:1});
  }catch(error){
    $('#generation-error-copy').textContent=error.message||'The character could not be drawn. Please try again.';$('#generation-error').hidden=false;
    const blocked=error.code==='character_blocked';$('#blocked-actions').hidden=!blocked;$('#retry-generation').hidden=blocked;
    track('free_preview_failed',{reason:blocked?'blocked':'other'});
  }
}

for(let index=0;index<10;index+=1){const marker=document.createElement('span');marker.setAttribute('aria-hidden','true');$('#locked-dots').append(marker);}

$('#retry-generation').addEventListener('click',()=>{void preparePreview();});
$('#change-photo').addEventListener('click',()=>showStep(4));
$('#change-story').addEventListener('click',()=>{state.characterImages=[];showStep(3);});

$$('[data-next]').forEach(button=>button.addEventListener('click',()=>{
  const next=Number(button.dataset.next);
  if(state.step===1){
    updateLive();
    if(!state.names){$('#step-1-error').textContent='Add their first name to continue.';$('#names').focus();return;}
    if(!$('#second-person').hidden&&!state.secondName){$('#step-1-error').textContent='Add the second person’s first name or remove that option.';$('#second-name').focus();return;}
    $('#step-1-error').textContent='';
  }
  if(state.step===2){
    state.mood=$('input[name="mood"]:checked').value;$('#step-2-error').textContent='';ideaOffset=0;buildIdeas();updateLive();
  }
  if(state.step===3){
    state.ownIdea=$('#own-idea').value.trim();
    if(state.mood==='own'&&!state.ownIdea){$('#step-3-error').textContent='Tell us what should happen, even in one sentence.';$('#own-idea').focus();return;}
    if(state.mood!=='own'&&!$('input[name="story-idea"]:checked')){$('#step-3-error').textContent='Choose one story idea.';return;}
    $('#step-3-error').textContent='';updateLive();
  }
  if(state.step===4){
    const requiredCount=$('#second-person').hidden?1:2;
    if(state.photos.length!==requiredCount){$('#step-4-error').textContent=`Add ${requiredCount===2?'one clear photo for each person':'one clear photo'} to continue.`;return;}
    if(state.photoChecks.length!==state.photos.length){$('#step-4-error').textContent='Wait for the photo check to finish.';return;}
    if(state.photoChecks.some(item=>!item.pass)){$('#step-4-error').textContent='Use a photo that passes every check.';return;}
    if(!$('#face-confirm').checked){$('#step-4-error').textContent='Confirm that every face is clearly recognisable.';$('#face-confirm').focus();return;}
    if(!$('#photo-permission').checked){$('#step-4-error').textContent='Confirm that you have permission to use the photos.';$('#photo-permission').focus();return;}
    $('#step-4-error').textContent='';void preparePreview();
  }
  if(state.step===5&&!state.characterImages[0]){$('#step-5-error').textContent='Wait for the first page to finish before choosing your book.';return;}
  if(state.step===6)updateProduct();
  showStep(next);
}));

$$('[data-back]').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.back))));

function updateProduct(){
  const chosen=$('input[name="product"]:checked');state.product=chosen.value;state.price=Number(chosen.dataset.price);
  const labels={bundle:'Digital & Hardback',hardback:'Hardback',digital:'Digital'};
  $('#order-label').textContent=labels[state.product];$('#order-price').textContent=`£${Number.isInteger(state.price)?state.price:state.price.toFixed(2)}`;
}
$$('input[name="product"]').forEach(input=>input.addEventListener('change',updateProduct));

$('#join-launch').addEventListener('click',async()=>{
  const error=$('#step-7-error');const button=$('#join-launch');if(button.disabled)return;
  const email=$('#email').value.trim().toLowerCase();
  if(!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)){error.textContent='Enter a valid email address.';$('#email').focus();return;}
  if(!$('#launch-consent').checked){error.textContent='Tick the email permission box to join the launch list.';$('#launch-consent').focus();return;}
  updateProduct();button.disabled=true;button.textContent='Saving…';error.textContent='';
  try{
    const response=await fetch('/api/launch-signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,product:state.product,previewId:state.previewId,consent:true,consentVersion:'storybook-launch-2026-09-27',website:$('#website').value,...window.cqMeasurement?.context()})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.ok!==true)throw new Error(result.error||'We could not save that just now. Please try again.');
    $('#launch-form').hidden=true;$('#launch-success').hidden=false;
    $('#step-7-title').textContent='Thank you.';
  }catch(cause){error.textContent=cause.message;button.disabled=false;button.textContent='Join the launch list';}
});

const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();try{void Promise.resolve(context.registerTool({name:'read_story_maker_state',title:'Read story maker',description:'Read the visible step and non-photo choices. Uploaded images are never exposed.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({step:state.step,names:fullNames(),age:state.age,mood:state.mood,selectedIdea:selectedStory()?.[0]||null,product:state.product})},{signal:lifecycle.signal})).catch(()=>{});}catch{}}

buildIdeas();updateLive();updateProduct();

const characterTest=new URLSearchParams(window.location.search).get('character-test');
if(characterTest&&['127.0.0.1','localhost'].includes(window.location.hostname)){
  void (async()=>{
    const response=await fetch('assets/private-character-proofs/test-upload.png');
    const photo=new File([await response.blob()],'character-test.png',{type:'image/png'});
    state.names=characterTest==='luke'?'Luke':'Jamie';state.photos=[photo];photoUrls=['assets/private-character-proofs/test-upload.png'];
    $('#names').value=state.names;updateLive();showStep(5);await preparePreview();
  })();
}
