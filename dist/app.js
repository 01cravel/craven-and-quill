const dataLayer=window.dataLayer=window.dataLayer||[];
const track=(event,details={})=>dataLayer.push({event,...details});
track('page_view',{page_title:document.title});

const heroSlides=[...document.querySelectorAll('[data-hero-slide]')];
const heroControls=[...document.querySelectorAll('[data-hero-go]')];
function showHero(index){heroSlides.forEach((slide,i)=>{slide.hidden=i!==index;});heroControls.forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));track('hero_slide_view',{slide:index===0?'personalised':'colouring'});}
heroControls.forEach(button=>button.addEventListener('click',()=>showHero(Number(button.dataset.heroGo))));

const menuButton=document.querySelector('.menu-button');
const nav=document.querySelector('#site-nav');
menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));});
nav.addEventListener('click',()=>{nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');});

const books={
  ghosts:{title:'Ghosts on the Early Shift',description:'Gentle ghosts keep the town cosy before sunrise, one café, bakery and bookshop at a time.',images:['ghosts-cover.webp','ghosts-1.webp','ghosts-2.webp','ghosts-3.webp']},
  animals:{title:'Little Animals, Lovely Days',description:'Bold, friendly scenes with a fox, rabbit, hedgehog and their small everyday adventures.',images:['animals-cover.webp','animals-1.webp','animals-2.webp','animals-3.webp']},
  petals:{title:'Petals in a Spin',description:'Balanced floral patterns with clear petals, leaves and satisfying spaces to fill.',images:['petals-cover.webp','petals-1.webp','petals-2.webp','petals-3.webp']}
};
const previewDialog=document.querySelector('#preview-dialog');
const previewImage=document.querySelector('#preview-image');
const previewTitle=document.querySelector('#preview-title');
const previewDescription=document.querySelector('#preview-description');
const previewThumbs=document.querySelector('#preview-thumbs');
function showPreview(key){const book=books[key];previewTitle.textContent=book.title;previewDescription.textContent=book.description;previewThumbs.replaceChildren();book.images.forEach((name,index)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Show sample ${index+1}`);button.setAttribute('aria-current',String(index===0));const thumb=document.createElement('img');thumb.src=`assets/${name}`;thumb.alt='';thumb.width=72;thumb.height=72;button.append(thumb);button.addEventListener('click',()=>{previewImage.src=`assets/${name}`;previewImage.alt=`${book.title}, sample ${index+1}`;previewThumbs.querySelectorAll('button').forEach(item=>item.setAttribute('aria-current','false'));button.setAttribute('aria-current','true');track('book_sample_view',{book:key,sample:index+1});});previewThumbs.append(button);});previewImage.src=`assets/${book.images[0]}`;previewImage.alt=`${book.title} cover`;previewDialog.showModal();track('product_preview_open',{book:key});}
document.querySelectorAll('.preview').forEach(button=>button.addEventListener('click',()=>showPreview(button.dataset.book)));
document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));

const storyDialog=document.querySelector('#story-dialog');
const storyForm=document.querySelector('#story-form');
const storyResult=document.querySelector('#story-result');
const nameInput=document.querySelector('#child-name');
function openStory(){track('personalisation_landing_open');window.location.href='personalised.html';}
document.querySelector('#start-story').addEventListener('click',openStory);
document.querySelector('.second-story').addEventListener('click',openStory);
nameInput.addEventListener('input',()=>document.querySelector('#cover-name').textContent=nameInput.value.trim()||'Your child');
storyForm.addEventListener('submit',event=>{event.preventDefault();const values=new FormData(storyForm);const name=String(values.get('name')).trim();const age=String(values.get('age'));const dedication=String(values.get('dedication')).trim();document.querySelector('#result-name').textContent=name;document.querySelector('#result-copy').textContent=`On the eve of ${name}’s ${age}th birthday, a small golden star slipped from the sky and landed beneath the oldest oak in the wood.${dedication?` Inside the cover, your message reads: “${dedication}”`:''}`;storyForm.hidden=true;storyResult.hidden=false;track('personalisation_preview_complete',{age});});
document.querySelector('#edit-story').addEventListener('click',()=>{storyResult.hidden=true;storyForm.hidden=false;nameInput.focus();});
document.querySelector('.close-story').addEventListener('click',()=>storyDialog.close());

const policyDialog=document.querySelector('#policy-dialog');
const policyTitle=document.querySelector('#policy-title');
const policyCopy=document.querySelector('#policy-copy');
const policies={
  privacy:{title:'Privacy draft',copy:'<h3>What this site uses</h3><p>The current preview does not send form details to a server. Basic anonymous visit and button-event measurement can be connected before launch.</p><h3>Personalised books</h3><p>A final policy must name the photo and print-file processors, explain each use, set deletion periods and keep marketing permission separate from ordering.</p>'},
  returns:{title:'Returns draft',copy:'<h3>Colouring books</h3><p>Purchases made through Amazon will follow the policy shown on that Amazon listing.</p><h3>Personalised books</h3><p>The final policy must explain the proof-approval point, cancellation window, damaged-book evidence and when a replacement or refund is offered.</p>'},
  terms:{title:'Terms draft',copy:'<h3>Before ordering opens</h3><p>The final terms must name the seller, accepted payment methods, territory, prices and taxes, production times, delivery estimates and limits of responsibility.</p><h3>Personalisation permission</h3><p>The adult placing an order must confirm they may supply the child details and any optional image used to create the book.</p>'}
};
document.querySelectorAll('[data-policy]').forEach(button=>button.addEventListener('click',()=>{const policy=policies[button.dataset.policy];policyTitle.textContent=policy.title;policyCopy.innerHTML=policy.copy;policyDialog.showModal();track('policy_view',{policy:button.dataset.policy});}));
