const state={previewId:null,rewritesRemaining:3,step:1,storyMode:'invent',names:'',secondName:'',age:'',mood:'adventure',ownIdea:'',details:'',storyDraft:null,storyBasis:null,storylineNeedsUpdate:false,storyPage:0,ideas:[],selected:0,photos:[],photoChecks:[],characterImages:[],product:'a5',price:39.99};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const track=(event,data={})=>{const names={story_maker_open:'maker_start',free_preview_created:'preview_success',free_preview_failed:'preview_error'};const allowed=['maker_start','story_generated','story_edited','checkout_start','checkout_error','book_saved'];const value=names[event]||(event==='story_step_view'?'step_'+data.step:event);if(allowed.includes(value)||/^step_[124567]$/.test(value)||names[event])window.cqMeasurement?.record(value);};
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
function updateCover(){const ready=!!state.characterImages[0];$('#mini-cover').hidden=!ready;$('.story-side .gift-page-preview').hidden=ready;$('#mini-cover-art').src=state.characterImages[0]||'assets/storybook.webp';$('#cover-caption').textContent=ready?'Your character, cover design follows after payment':'Your inside gift page';$('#mini-cover-art').alt='Your illustrated character';}
function updateGiftPage(){
 const name=$('#names').value.trim()||'Someone special',sender=$('#sender-name').value.trim(),message=$('#dedication').value.trim();
 $$('[data-gift-name]').forEach(el=>el.textContent=name);
 $$('[data-gift-sender]').forEach(el=>{el.textContent=sender?'Given with love by '+sender:'';el.hidden=!sender;});
 $$('[data-gift-message]').forEach(el=>{el.textContent=message;el.hidden=!message;});
}

function updateLive(){
  updateGiftPage();
  state.names=$('#names').value.trim();
  state.secondName=$('#second-person').hidden?'':$('#second-name').value.trim();
  state.age=($('input[name="age"]:checked')||{}).value||'';
  state.mood=($('input[name="mood"]:checked')||{}).value||'adventure';
  state.details=state.storyMode==='plot'?'':$('#personal-details').value.trim();
  $('#live-name').textContent=(fullNames()||'Someone special').toUpperCase();
  fitCoverName();
  const ageLabels={'3-5':'Age 3–5','6-8':'Age 6–8','9-11':'Age 9–11','9-12':'Age 9–12','teen-adult':'Teen or adult'};
  $('#live-age').textContent=ageLabels[state.age]||'Your reader';
  $('#live-mood').textContent=state.mood==='own'?'Their own idea':state.mood[0].toUpperCase()+state.mood.slice(1);
  const chosen=state.ideas[state.selected];
  $('#live-title').textContent=state.storyDraft?.title||(state.mood==='own'?'Their own adventure':chosen?.[0]||ideaBanks[state.mood]?.[0]?.[0]||'Their own story');
  updateCover();
  updateStoryGate();
}

function scrollToStepTop(number){
  document.activeElement?.blur();
  const heading=[...document.querySelectorAll(`.step[data-step="${number}"] h1,.step[data-step="${number}"] h2`)].find(el=>el.getClientRects().length);
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  const resetScroll=()=>{if(state.step!==number)return;$('.step-panel').scrollTop=0;if(!matchMedia('(max-width:780px)').matches)window.scrollTo({top:0,left:0,behavior:'instant'});};
  resetScroll();requestAnimationFrame(resetScroll);
}

function showStep(number){
  const order=[1,8,2,12,9,3,10,5,4,6,11,7];
  if(!order.includes(number)&&number!==4)number=1;
  const previous=state.step;
  document.documentElement.style.setProperty('--step-direction',order.indexOf(number)<order.indexOf(previous)?'-1':'1');
  state.step=number;
  if(number===2){updatePhotoGate();renderPhotoThumbnails(state.photos);}
  if(number===9)configureBrief();
  if(number===6){window.cqMeasurement?.record('price_view');void saveQuote().catch(()=>{});}
  $$('.step').forEach(step=>{const active=Number(step.dataset.step)===number;step.hidden=!active;step.classList.toggle('active',active);});
  $$('.journey-step').forEach(item=>{const n=Number(item.dataset.progress);item.classList.toggle('active',n===number);item.classList.toggle('done',n<number);});
  const names={1:'Their name',8:'Reading level',2:'Their photo',12:'Story approach',9:state.storyMode==='plot'?'Your idea':'About them',3:'Story tone',4:'Your story',10:'Your email',5:'Your character',6:'Book size',11:'Delivery',7:'Review & pay'};
  const visibleStep=order.indexOf(number)+1;$('#progress-num').textContent=visibleStep;$('#progress-name').textContent=names[number];$('#progress-fill').style.width=`${visibleStep/order.length*100}%`;
  $('.journey').setAttribute('aria-label',`Step ${visibleStep} of ${order.length}: ${names[number]}`);
  if(number===7)$('#delivery-summary').textContent=[$('#recipient-name').value,$('#address-line1').value,$('#address-line2').value,$('#town').value,$('#postcode').value].filter(Boolean).join(', ');
  if(number===4&&state.storyDraft)requestAnimationFrame(()=>turnStoryPage(state.storyPage,'instant'));
  if(number===5&&state.storyDraft)$('#illustration-count').textContent=`${state.storyDraft.spreads.length} story illustrations and a cover`;
  scrollToStepTop(number);
  track('story_step_view',{step:number});
  window.dispatchEvent(new Event('cq-draft-change'));
}

function configureBrief(){
 const own=state.storyMode==='plot';
 $('#interests-options').hidden=own;$('#own-options').hidden=!own;
 $('#step-9-title').textContent=own?'What should happen?':'What makes them, them?';
 $('#brief-intro').textContent=own?'Share your plot, even in one sentence. We’ll turn it into a complete story.':'A few favourite things or little habits are enough. We’ll build the adventure around them.';
 $('#brief-help-copy').textContent=own?'Who is the hero? What do they want? What goes wrong? For example: they score the winning goal at Wembley, but their lucky boots have gone missing.':'What do they love doing? What makes them laugh? A favourite place, food or little habit is plenty.';
}
function validBrief(){
 const field=state.storyMode==='plot'?$('#own-idea'):$('#personal-details');
 if(field.value.trim())return true;
 showStep(9);$('#step-9-error').textContent=state.storyMode==='plot'?'Give us a sentence about what should happen.':'Tell us one thing about them so we can make it personal.';field.focus();return false;
}
function buildIdeas(){
 state.ideas=[['Their own adventure',state.storyMode==='plot'?$('#own-idea').value.trim():'Invent an original plot driven by the supplied personality and interests. Make these details central to the adventure rather than decorations on an unrelated story.']];
 state.selected=0;configureBrief();updateLive();
}

let storyWriting=false,storyRequest=0;
function storyBasis(){return JSON.stringify({names:state.names,secondName:state.secondName,age:state.age,mood:state.mood,details:state.details,idea:state.storyMode==='plot'?$('#own-idea').value.trim():'Invent an original plot driven by the supplied personality and interests. Make these details central to the adventure rather than decorations on an unrelated story.'});}
function draftValid(story){return Boolean(typeof story?.title==='string'&&story.title.trim()&&story.title.length<=120&&typeof story?.synopsis==='string'&&story.synopsis.trim()&&story.synopsis.length<=600&&Array.isArray(story.spreads)&&story.spreads.length===10&&story.spreads.every(page=>typeof page?.text==='string'&&page.text.trim()&&page.text.length<=1500&&typeof page?.image_scene==='string'&&page.image_scene.trim()&&page.image_scene.length<=800));}
function updateStoryGate(){
  const outdated=Boolean(state.storyDraft&&(state.storyBasis!==storyBasis()||state.storylineNeedsUpdate));
  $('#story-outdated').hidden=!outdated;
  $('#story-outdated').textContent=state.storylineNeedsUpdate?'You changed the storyline. Choose Rewrite story to update the pages before continuing.':'You changed their details or starting idea. Your draft is still here. Choose Rewrite story before continuing.';
  $('#use-story').disabled=storyWriting||!draftValid(state.storyDraft)||outdated;
  $('#use-story').hidden=!draftValid(state.storyDraft)||outdated;
  $('#generate-story').hidden=draftValid(state.storyDraft)&&!outdated;
  $('#generate-story').disabled=storyWriting;
  $('#revise-story').disabled=storyWriting||state.rewritesRemaining<=0;
  $('#rewrite-label').textContent=state.rewritesRemaining>0?`Rewrite story · ${state.rewritesRemaining} left`:'No rewrites left · you can still edit';
  $('#generate-story').textContent=storyWriting?'Writing your story…':state.storyDraft?'Update my preview':'Continue';
}
function invalidatePreview(){state.characterImages=[];state.previewId=null;$('#choose-book').disabled=true;}
function editDraft(){
  if(!state.storyDraft)return;
  state.storyDraft.title=$('#story-title').value;
  if(state.storyDraft.synopsis!==$('#story-synopsis').value)state.storylineNeedsUpdate=true;
  state.storyDraft.synopsis=$('#story-synopsis').value;
  $$('#story-pages textarea').forEach((field,index)=>{state.storyDraft.spreads[index].text=field.value;});
  track('story_edited');updateLive();
}
function updateStoryPage(index){
  const total=state.storyDraft?.spreads.length||0;
  state.storyPage=Math.max(0,Math.min(index,total-1));
  $('#story-page-position').textContent=`Page ${state.storyPage+1} of ${total}`;
  $('#story-previous').disabled=state.storyPage===0;
  $('#story-next').disabled=state.storyPage>=total-1;
  $$('#story-pages .story-page').forEach((page,i)=>{page.inert=i!==state.storyPage;page.setAttribute('aria-hidden',String(i!==state.storyPage));});
}
function turnStoryPage(index,behavior){
  const pages=$('#story-pages');if(!state.storyDraft||!pages.clientWidth)return;
  updateStoryPage(index);
  pages.scrollTo({left:state.storyPage*pages.clientWidth,behavior:behavior||(matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth')});
}
function renderStoryDraft(){
  const story=state.storyDraft;$('#story-editor').hidden=false;$('#story-summary').textContent=story.synopsis;
  $('#story-title').value=story.title;$('#story-synopsis').value=story.synopsis;
  const pages=$('#story-pages');pages.replaceChildren();
  story.spreads.forEach((page,index)=>{
    const panel=document.createElement('article');panel.className='story-page';panel.setAttribute('role','group');panel.setAttribute('aria-roledescription','page');panel.setAttribute('aria-label',`Page ${index+1} of ${story.spreads.length}`);
    const folio=document.createElement('p');folio.className='story-page-folio';folio.textContent=`Page ${index+1}`;
    const label=document.createElement('label');label.htmlFor=`story-page-${index+1}`;label.textContent=`Story text for page ${index+1}`;
    label.className='story-page-label';
    const field=document.createElement('textarea');field.id=label.htmlFor;field.rows=6;field.readOnly=true;field.maxLength=1500;field.value=page.text;field.addEventListener('input',editDraft);
    const edit=document.createElement('button');edit.type='button';edit.className='edit-page';edit.textContent='Edit text';edit.addEventListener('click',()=>{field.readOnly=!field.readOnly;edit.textContent=field.readOnly?'Edit text':'Done';if(!field.readOnly)field.focus({preventScroll:true});});
    panel.append(edit,label,field);pages.append(panel);
  });
  turnStoryPage(state.storyPage,'instant');
  updateLive();
}
async function writeStory(revision=false){
  if(storyWriting)return;
  if(revision&&state.rewritesRemaining<=0)return;
  updateLive();if(!validBrief())return;
  const error=$('#step-4-error');error.textContent='';
  const basis=JSON.parse(storyBasis());
  if(!basis.age){showStep(8);$('#step-8-error').textContent='Choose a reading level first.';return;}
  if(!basis.names){error.textContent='Add their first name before generating a story.';showStep(1);$('#names').focus();return;}
  if(!basis.idea){error.textContent='Add a starting idea before generating the story.';$('#own-idea').focus();return;}
  if(revision&&!draftValid(state.storyDraft)){error.textContent='Keep a title, storyline and words on all ten pages before updating the story.';return;}
  const changes=revision?$('#story-changes').value.trim():'';
  const capturedBasis=storyBasis(),request=++storyRequest;
  const previous=revision?JSON.parse(JSON.stringify(state.storyDraft)):null;
  storyWriting=true;updateStoryGate();
  $('#story-writing-status').textContent=revision?'Updating the story. Your current version stays below.':'Writing their ten-page story…';
  $$('#story-editor input,#story-editor textarea').forEach(field=>field.disabled=true);
  try{
    const response=await fetch('/api/generate-story',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...basis,changes,previousStory:previous}),signal:AbortSignal.timeout(85000)});
    const result=await response.json().catch(()=>({}));
    if(Number.isInteger(result.rewritesRemaining))state.rewritesRemaining=result.rewritesRemaining;
    window.dispatchEvent(new Event('cq-draft-change'));
    if(!response.ok||result.ok!==true||!draftValid(result.story))throw new Error(result.error||'The story did not finish. Your current draft has not changed. Please try again.');
    if(request!==storyRequest||capturedBasis!==storyBasis())throw new Error('Your details changed while we were writing. Your draft has not changed. Generate again with the latest details.');
    if(!revision)state.storyPage=0;
    state.storyDraft=result.story;state.storyBasis=capturedBasis;state.storylineNeedsUpdate=false;renderStoryDraft();
    window.dispatchEvent(new Event('cq-draft-change'));$('#story-changes').value='';$('#story-writing-status').textContent='';
    track('story_generated');if(!revision){$('#story-editor').open=false;if(!state.characterImages.length&&!state.photos.length){showStep(2);$('#step-2-error').textContent='Add your photo again to create a new preview. Your story is saved.';}else{showStep(5);void preparePreview();}}else{$('#story-editor').open=true;$('.rewrite-options').open=false;}
  }catch(cause){error.textContent=cause.name==='TimeoutError'?'The story took too long. Your draft has not changed. Please try again.':cause.message||'We could not write the story. Your draft has not changed.';$('#story-writing-status').textContent='';}
  finally{storyWriting=false;$$('#story-editor input,#story-editor textarea').forEach(field=>field.disabled=false);updateStoryGate();}
}
$('#personal-details').addEventListener('input',updateLive);
$('#own-idea').addEventListener('input',updateLive);
$('#story-title').addEventListener('input',editDraft);$('#story-synopsis').addEventListener('input',editDraft);
$('#generate-story').addEventListener('click',()=>{
  updateLive();if(!validBrief())return;
  if(!JSON.parse(storyBasis()).idea){$('#step-4-error').textContent='Add a starting idea first.';$('#own-idea').focus();return;}
  showStep(10);
});
$('#start-preview').addEventListener('click',()=>{
  if(!validPreviewEmail()){$('#step-10-error').textContent='Enter a valid email address to keep your preview.';$('#email').focus();return;}
  $('#step-10-error').textContent='';if(state.storyDraft&&state.storyBasis===storyBasis()){showStep(5);void preparePreview();}else{showStep(4);void writeStory(!!state.storyDraft);}
});
$('#revise-story').addEventListener('click',()=>{void writeStory(true);});
$('#story-previous').addEventListener('click',()=>turnStoryPage(state.storyPage-1));
$('#story-next').addEventListener('click',()=>turnStoryPage(state.storyPage+1));
$('#story-pages').addEventListener('scroll',()=>{const pages=$('#story-pages');if(pages.clientWidth&&state.storyDraft)updateStoryPage(Math.round(pages.scrollLeft/pages.clientWidth));},{passive:true});
$('#story-pages').addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea,button')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  if(event.key==='Home'||event.key==='End')turnStoryPage(event.key==='Home'?0:state.storyDraft.spreads.length-1,'instant');
  else turnStoryPage(state.storyPage+(event.key==='ArrowLeft'?-1:1));
});
new ResizeObserver(()=>turnStoryPage(state.storyPage,'instant')).observe($('#story-pages'));

$('#names').addEventListener('input',updateLive);
$('#sender-name').addEventListener('input',updateGiftPage);
$('#dedication').addEventListener('input',updateGiftPage);
$('#second-name').addEventListener('input',updateLive);
$$('input[name="age"]').forEach(input=>input.addEventListener('change',updateLive));
$$('input[name="mood"]').forEach(input=>input.addEventListener('change',()=>{ideaOffset=0;buildIdeas();}));

$$('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{$('#own-idea').value=button.dataset.prompt;updateLive();$('#own-idea').focus();}));

async function inspectPhoto(file){
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))return{pass:false,message:'Use a JPG, PNG or WebP image.'};
  let bitmap;
  try{bitmap=await window.cqPhotoUpload.decode(file);}catch{return{pass:false,message:'This image could not be read. Try another file.'};}
    const canvas=document.createElement('canvas');const size=180;canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,size,size);bitmap.close?.();
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

function validPreviewEmail(){
  const email=$('#email').value.trim();
  return email.length<=254&&/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)&&$('#email').validity.valid;
}
function validPhotoCount(){return state.secondName?state.photos.length===2:state.photos.length>=1&&state.photos.length<=3;}
function updatePhotoGate(){
  const requiredCount=$('#second-person').hidden?1:2;
  const ready=validPhotoCount()&&state.photoChecks.length===state.photos.length&&state.photoChecks.every(check=>check.pass)&&$('#face-confirm').checked&&$('#photo-permission').checked;
  $('#photo-continue').disabled=!ready;
  $('#extra-photo-wrap').hidden=!state.photos.length||!!state.secondName;$('#extra-photos').disabled=state.photos.length>=3;
  $('.extra-photo-label').textContent=state.photos.length>=3?'Three reference photos added':`+ Add ${3-state.photos.length} more for a better likeness (optional)`;
}
['#face-confirm','#photo-permission'].forEach(selector=>$(selector).addEventListener('change',updatePhotoGate));
$('#email').addEventListener('input',()=>{updatePhotoGate();$('#step-2-error').textContent='';});
$('#email').addEventListener('change',updatePhotoGate);

function renderPhotoThumbnails(files){
  photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];$('#photo-list').replaceChildren();
  files.forEach((file,index)=>{const url=URL.createObjectURL(file);photoUrls.push(url);const thumb=document.createElement('img');thumb.src=url;thumb.alt=`Selected photo ${index+1}`;const item=document.createElement('div');item.className='photo-reference';const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove photo ${index+1}`);remove.addEventListener('click',()=>void selectPhotos(state.photos.filter((_,i)=>i!==index)));item.append(thumb,remove);$('#photo-list').append(item);});
  $('.upload-wrap').classList.toggle('has-photo',files.length>0);$('.upload strong').textContent=files.length?(files.length>1?'Photos added':'Photo added'):'Add a clear photo';$('.upload small').textContent=files.length?'Tap to change':'Face forward, both eyes clear, no sunglasses.';$('.upload-icon').style.backgroundImage=files.length?`url(${photoUrls[0]})`:'';
}
let photoSelection=0;
async function selectPhotos(files){
  const selection=++photoSelection;
  $('#photos').value='';
  photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];
  const requiredCount=$('#second-person').hidden?1:2;
  files=files.slice(0,state.secondName?2:3);
  state.photos=files;state.previewId=null;state.photoChecks=[];state.characterImages=[];$('#photo-list').replaceChildren();$('#face-confirm').checked=false;$('#face-confirm-wrap').hidden=true;$('#step-2-error').textContent='';updatePhotoGate();
  const check=$('#photo-check');check.hidden=false;check.className='photo-check';check.innerHTML='<strong>Checking the photo…</strong>';
  renderPhotoThumbnails(files);
  if(!files.length){check.hidden=true;$('#face-confirm-wrap').hidden=true;window.dispatchEvent(new Event('cq-draft-change'));return;}
  const results=await Promise.all(files.map(async file=>{
    try{const prepared=await window.cqPhotoUpload.prepare(file);return{file:prepared,check:await inspectPhoto(prepared)};}
    catch(error){return{file,check:{pass:false,message:error.message||'This photo could not be read. Try a screenshot instead.'}};}
  }));
  if(selection!==photoSelection)return;
  state.photos=results.map(result=>result.file);state.photoChecks=results.map(result=>result.check);
  const failed=state.photoChecks.find(item=>!item.pass);
  const countProblem=!validPhotoCount();
  check.classList.add(failed||countProblem?'fail':'pass');
  check.innerHTML=countProblem?`<strong>Add ${requiredCount===2?'two photos':'one photo'}</strong><span>Use one separate photo for each person.</span>`:failed?`<strong>Use another photo</strong><span>${failed.message}</span>`:`<strong>${files.length>1?'Photos look good':'Photo looks good'}</strong><span>Tick below to confirm the face is clear.</span>`;
  $('#face-confirm-wrap').hidden=Boolean(failed||countProblem);$('#step-2-error').textContent='';
  updatePhotoGate();
  track('photos_checked',{count:files.length,passed:!failed&&!countProblem});window.dispatchEvent(new Event('cq-draft-change'));
}
$('#photos').addEventListener('change',event=>void selectPhotos([...event.target.files]));
$('#extra-photos').addEventListener('change',event=>{const added=[...event.target.files];event.target.value='';if(state.photos.length+added.length>3){$('#step-2-error').textContent='Choose up to three photos in total.';return;}void selectPhotos([...state.photos,...added]);});

function selectedStory(){
  if(state.storyDraft)return[state.storyDraft.title,state.storyDraft.synopsis];
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
  if(state.storyDraft)return state.storyDraft.spreads[0].text;
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

let drawingProgress=null,generationBusy=false;
async function requestCharacter(file,name){
  const idea=selectedStory();const form=new FormData();
  for(const photo of (Array.isArray(file)?file:[file]))form.append('photo',photo,photo.name||'photo.jpg');form.append('email',$('#email').value.trim().toLowerCase());form.append('name',name);form.append('age',state.age);form.append('mood',state.mood);form.append('story',`${idea?.[1]||''} ${state.storyDraft?.spreads[0]?.text||''}`.slice(0,500));
  const data=await window.cqPreviewProgress.request(form,event=>drawingProgress?.update(event));
  state.previewId=data.previewId||null;
  return data.image;
}

async function renderStoryArt(){
  const groups=state.secondName?state.photos.map(photo=>[photo]):[state.photos];
  for(let index=0;index<groups.length;index+=1){
    const file=groups[index];const name=index===0?state.names:state.secondName;
    drawingProgress?.person(index,groups.length);
    state.characterImages[index]=state.characterImages[index]||await requestCharacter(file,name);
  }
  $('#preview-image').src=state.characterImages[0];$('#preview-image').alt=`Illustrated ${state.names} on the first story page`;
  const second=$('#preview-image-second');const hasSecond=Boolean(state.characterImages[1]);
  second.hidden=!hasSecond;$('#preview-art').classList.toggle('two-people',hasSecond);
  if(hasSecond){second.src=state.characterImages[1];second.alt=`Illustrated ${state.secondName} on the first story page`;}
}

async function capturePreviewEmail(){
  const response=await fetch('/api/preview-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#email').value.trim().toLowerCase(),website:$('#website').value,...window.cqMeasurement?.context()}),signal:AbortSignal.timeout(15000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw new Error(result.error||'We could not save your email. Please try again.');
}

async function preparePreview(){
  if(generationBusy)return;generationBusy=true;
  const idea=selectedStory();
  window.cqMeasurement?.record('preview_start');
  $('#choose-book').disabled=true;
  $('#result-story-title').textContent=idea[0];$('#live-title').textContent=idea[0];
  $('#story-copy').textContent=previewText(idea);$('#preview-image').src='assets/storybook.webp';$('#preview-image').alt=`Sample opening illustration format for ${idea[0]}`;
  $('#preview-image-second').hidden=true;$('#preview-art').classList.remove('two-people');
  $('#making-state').hidden=false;$('#result-state').hidden=true;
  $('#generation-error').hidden=true;$('#blocked-actions').hidden=true;$('#retry-generation').hidden=false;drawingProgress=window.cqPreviewProgress.start();if(state.step===5)scrollToStepTop(5);
  try{
    await capturePreviewEmail();
    await renderStoryArt();
    await Promise.all([$('#preview-image'),...(state.characterImages[1]?[$('#preview-image-second')]:[])].map(image=>image.decode()));
    drawingProgress.stop(true);
    $('#making-state').hidden=true;$('#result-state').hidden=false;$('#choose-book').disabled=false;updateCover();window.dispatchEvent(new Event('cq-draft-change'));track('free_preview_created',{mood:state.mood,age:state.age,pages_generated:1});
  }catch(error){
    drawingProgress.stop(false);
    $('#generation-error-copy').textContent=error.message||'The character could not be drawn. Please try again.';$('#generation-error').hidden=false;
    const blocked=error.code==='character_blocked';$('#blocked-actions').hidden=!blocked;$('#retry-generation').hidden=blocked;
    track('free_preview_failed',{reason:blocked?'blocked':'other'});
  }finally{generationBusy=false;}
}

for(let index=0;index<10;index+=1){const marker=document.createElement('span');marker.setAttribute('aria-hidden','true');$('#locked-dots').append(marker);}

$('#retry-generation').addEventListener('click',()=>{void preparePreview();});
$('#change-photo').addEventListener('click',()=>showStep(2));
$('#change-story').addEventListener('click',()=>{state.characterImages=[];showStep(4);});

$$('[data-next]').forEach(button=>button.addEventListener('click',()=>{
  const next=Number(button.dataset.next);
  if(state.step===1){
    updateLive();
    if(!state.names){$('#step-1-error').textContent='Add their first name to continue.';$('#names').focus();return;}
    if(!$('#second-person').hidden&&!state.secondName){$('#step-1-error').textContent='Add the second person’s first name or remove that option.';$('#second-name').focus();return;}
    $('#step-1-error').textContent='';
  }
  if(state.step===8&&!$('input[name="age"]:checked')){$('#step-8-error').textContent='Choose a reading level.';return;}
  if(state.step===12){const selected=$('input[name="story-mode"]:checked');if(!selected){$('#step-12-error').textContent='Choose how you’d like us to create the story.';return;}state.storyMode=selected.value;$('#step-12-error').textContent='';buildIdeas();}
  if(state.step===9){updateLive();const own=state.storyMode==='plot';const field=own?$('#own-idea'):$('#personal-details');if(!field.value.trim()){$('#step-9-error').textContent=own?'Give us a sentence about what should happen.':'Tell us one thing about them so we can make it personal.';field.focus();return;}$('#step-9-error').textContent='';buildIdeas();}
  if(state.step===11){
    const invalid=['recipient-name','address-line1','town','postcode'].find(id=>!$('#'+id).value.trim());
    if(invalid){$('#step-11-error').textContent='Complete the delivery address to continue.';$('#'+invalid).focus();return;}
    $('#step-11-error').textContent='';
  }
  if(state.step===3){
    if(!$('input[name="mood"]:checked')){$('#step-3-error').textContent='Choose a story style.';return;}
    state.mood=$('input[name="mood"]:checked').value;$('#step-3-error').textContent='';buildIdeas();updateLive();
  }
  if(state.step===4){
    if(storyWriting||!draftValid(state.storyDraft)){$('#step-4-error').textContent='Generate their story, then read and edit it before continuing.';return;}
    if(state.storyBasis!==storyBasis()||state.storylineNeedsUpdate){$('#step-4-error').textContent='Update the story to use the latest storyline and details before continuing.';return;}
    state.ownIdea=$('#own-idea').value.trim();
    if(state.mood==='own'&&!state.ownIdea){$('#step-4-error').textContent='Tell us what should happen, even in one sentence.';$('#own-idea').focus();return;}
    $('#step-4-error').textContent='';updateLive();
  }
  if(state.step===2){updateLive();if(!$('#second-person').hidden&&!state.secondName){$('#step-2-error').textContent='Add the second first name or remove that option.';$('#second-name').focus();return;}}
  if(state.step===2||(state.step===4&&!state.characterImages.length)){
    const photoReady=validPhotoCount()&&state.photoChecks.length===state.photos.length&&state.photoChecks.every(check=>check.pass)&&$('#face-confirm').checked&&$('#photo-permission').checked&&validPreviewEmail();
    if(state.step===4&&!photoReady)showStep(2);
    const requiredCount=$('#second-person').hidden?1:2;
    if(!validPhotoCount()){$('#step-2-error').textContent=`Add ${requiredCount===2?'one clear photo for each person':'one clear photo'} to continue.`;return;}
    if(state.photoChecks.length!==state.photos.length){$('#step-2-error').textContent='Wait for the photo check to finish.';return;}
    const failedPhoto=state.photoChecks.find(item=>!item.pass);
    if(failedPhoto){$('#step-2-error').textContent=failedPhoto.message;$('#photo-check').scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(!$('#face-confirm').checked){$('#step-2-error').textContent='Confirm that every face is clearly recognisable.';$('#face-confirm').focus();return;}
    if(!$('#photo-permission').checked){$('#step-2-error').textContent='Confirm that you have permission to use the photos.';$('#photo-permission').focus();return;}
    if(state.step===4&&!validPreviewEmail()){showStep(10);$('#step-10-error').textContent='Enter your email to create the preview.';return;}
    $('#step-2-error').textContent='';if(state.step===4)void preparePreview();
  }
  if(state.step===4&&state.characterImages.length){$('#story-copy').textContent=previewText(selectedStory());}
  if(state.step===5&&!state.characterImages[0]){$('#step-5-error').textContent='Wait for the first page to finish before choosing your book.';return;}
  if(state.step===6)updateProduct();
  showStep(next);
}));

$$('[data-back]').forEach(button=>button.addEventListener('click',()=>{if(state.step===5&&button.dataset.back==='4')$('#story-editor').open=true;showStep(Number(button.dataset.back));}));

let orderCatalog=null,orderRequest=null;
const offerCode=new URLSearchParams(location.search).get('offer')?.trim().toUpperCase()||'';
if(/^CQ[A-Z0-9]{10}$/.test(offerCode)){$('#offer-code-note').hidden=false;$('#offer-code-note').textContent=`Offer code ${offerCode} will be checked before payment. No discount is applied until the final total updates.`;}
async function saveQuote(explicitConsent){
 if(!validPreviewEmail()||!state.previewId)return;
 const body={email:$('#email').value.trim().toLowerCase(),previewId:state.previewId,size:$('input[name="product"]:checked').value};
 if(typeof explicitConsent==='boolean')body.offerConsent=explicitConsent;
 const r=await fetch('/api/orders/quote-interest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not save your offer preference.');
}
$('#offer-email-consent').addEventListener('change',async event=>{try{await saveQuote(event.target.checked);$('#step-6-error').textContent='';}catch(e){event.target.checked=!event.target.checked;$('#step-6-error').textContent=e.message;}});
async function loadOrderCatalog(){try{const r=await fetch('/api/orders/catalog');if(!r.ok)return;orderCatalog=await r.json();for(const product of orderCatalog.products){const radio=document.querySelector(`input[name="product"][value="${product.id}"]`);if(radio){radio.dataset.price=String(product.pricePence/100);radio.closest('label').querySelector('.current-price').textContent=`£${(product.pricePence/100).toFixed(2)}`;}}if(orderCatalog.checkoutEnabled){$('#order-availability').textContent='Secure payment, then we create the rest of your illustrations. You and our team approve the finished proof before printing.';$('#join-launch').textContent='Continue to payment';}updateProduct();}catch{}}
function updateProduct(){
  const chosen=$('input[name="product"]:checked');state.product=chosen.value;state.price=Number(chosen.dataset.price);
  $('#order-label').textContent=state.product==='a4'?'A4 hardback + digital PDF':'A5 hardback + digital PDF';
  $('#order-price').textContent=`£${state.price.toFixed(2)}`;
}
$$('input[name="product"]').forEach(input=>input.addEventListener('change',()=>{$('#purchase-intent').checked=false;orderRequest=null;updateProduct();void saveQuote().catch(()=>{});}));
$('#join-launch').addEventListener('click',async()=>{
 const error=$('#step-7-error'),button=$('#join-launch');if(button.disabled)return;
 if(!validPreviewEmail()){showStep(10);$('#step-10-error').textContent='Enter a valid email address.';return;}
 if(!$('#purchase-intent').checked||!$('#photo-permission').checked){error.textContent='Confirm the story and your permission to create this book.';return;}
 const fields=['recipient-name','address-line1','town','postcode'];const invalid=fields.find(id=>!$('#'+id).value.trim());if(invalid){showStep(11);$('#step-11-error').textContent='Complete the UK delivery address.';$('#'+invalid).focus();return;}
 if(!draftValid(state.storyDraft)||!state.characterImages.length){error.textContent='Finish the story and character preview first.';return;}
 updateProduct();button.disabled=true;button.textContent='Saving your book…';error.textContent='';
 orderRequest=orderRequest||{id:crypto.randomUUID(),key:crypto.randomUUID()+crypto.randomUUID()};
 try{await window.cqSaveDraft?.();const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({measurement:window.cqMeasurement?.context(),requestId:orderRequest.id,accessToken:orderRequest.key,email:$('#email').value.trim().toLowerCase(),size:state.product,story:state.storyDraft,names:fullNames(),age:state.age,previewId:state.previewId,characters:state.characterImages,approvedStory:true,photoPermission:true,dedication:$('#dedication').value.trim(),senderName:$('#sender-name').value.trim(),recipient:{name:$('#recipient-name').value.trim(),address:{line1:$('#address-line1').value.trim(),line2:$('#address-line2').value.trim(),townOrCity:$('#town').value.trim(),postalOrZipCode:$('#postcode').value.trim(),countryCode:'GB'}}}),signal:AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Your book could not be saved. Please retry.');track('book_saved');const privateUrl=`/order.html?id=${data.order.id}#key=${orderRequest.key}`;
 if(offerCode){const applied=await fetch(`/api/orders/${data.order.id}/apply-offer`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+orderRequest.key},body:JSON.stringify({revision:data.order.revision,code:offerCode})});const result=await applied.json();if(!applied.ok)throw new Error(result.error||'Your offer could not be applied. Your book is saved and no payment started.');data.order=result;$('#order-price').textContent=`£${(result.amount/100).toFixed(2)}`;$('#offer-code-note').textContent=`Offer ${offerCode} applied. Your total is £${(result.amount/100).toFixed(2)}.`;}
 if(orderCatalog?.checkoutEnabled){
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+orderRequest.key};
 const session=await fetch(`/api/orders/${data.order.id}/session`,{method:'POST',headers,body:JSON.stringify({token:orderRequest.key})});if(!session.ok)throw Error('Your book is saved. Please retry to open secure payment.');
 track('checkout_start');button.textContent='Opening secure payment…';
 const checkout=await fetch(`/api/orders/${data.order.id}/checkout`,{method:'POST',headers,body:JSON.stringify({revision:data.order.revision}),signal:AbortSignal.timeout(30000)});const payment=await checkout.json();
 if(!checkout.ok){track('checkout_error');location.assign(privateUrl);return;}
 const destination=new URL(payment.url);if(destination.protocol!=='https:'||!(destination.hostname==='ziina.com'||destination.hostname.endsWith('.ziina.com')||destination.hostname==='checkout.stripe.com'))throw Error('Payment address could not be verified. Your book is saved.');
 location.assign(destination.href);
 }else location.assign(privateUrl);}catch(cause){error.textContent=cause.message||'The connection stopped. Retry to save the same book without duplicating it.';button.disabled=false;button.textContent=orderCatalog?.checkoutEnabled?'Continue to payment':'Save my book, no payment';}
});
void loadOrderCatalog();

const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();try{void Promise.resolve(context.registerTool({name:'read_story_maker_state',title:'Read story maker',description:'Read the visible step and non-photo choices. Uploaded images are never exposed.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({step:state.step,names:fullNames(),age:state.age,mood:state.mood,selectedIdea:selectedStory()?.[0]||null,product:state.product})},{signal:lifecycle.signal})).catch(()=>{});}catch{}}

buildIdeas();updateLive();updateProduct();updatePhotoGate();

const characterTest=new URLSearchParams(window.location.search).get('character-test');
if(characterTest&&['127.0.0.1','localhost'].includes(window.location.hostname)){
  void (async()=>{
    const response=await fetch('assets/private-character-proofs/test-upload.png');
    const photo=new File([await response.blob()],'character-test.png',{type:'image/png'});
    state.names=characterTest==='luke'?'Luke':'Jamie';state.photos=[photo];photoUrls=['assets/private-character-proofs/test-upload.png'];
    $('#names').value=state.names;updateLive();showStep(5);await preparePreview();
  })();
}

function fitCoverName(){const el=$('#live-name');if(!el)return;el.style.fontSize='';el.style.whiteSpace='nowrap';let size=parseFloat(getComputedStyle(el).fontSize);while(el.scrollWidth>el.clientWidth&&size>14){size-=1;el.style.fontSize=size+'px';}if(el.scrollWidth>el.clientWidth)el.style.whiteSpace='normal';}
new ResizeObserver(fitCoverName).observe($('#mini-cover'));
document.fonts.ready.then(fitCoverName);

let quickAdvanceTimer;
for(const [name,step,next] of [['age',8,2],['mood',3,10],['story-mode',12,9],['product',6,11]]){
  for(const input of $$(`input[name="${name}"]`))input.addEventListener('click',()=>{
    if(state.step!==step)return;
    clearTimeout(quickAdvanceTimer);
    quickAdvanceTimer=setTimeout(()=>{if(state.step===step&&input.checked)document.querySelector(`.step[data-step="${step}"] [data-next="${next}"]`).click();},160);
  });
}
$('#names').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();document.querySelector('[data-step="1"] [data-next]').click();}});
$('#story-maker').addEventListener('submit',event=>event.preventDefault());
showStep(1);
