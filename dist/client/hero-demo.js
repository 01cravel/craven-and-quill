// Homepage hero demo, on a loop: a photo is dragged onto a blank hardback, the cover fills in with
// their illustrated character, then the book turns its painted pages, closes and spins round.
// It uses the example book (Oliver), so it is the same for everyone. Without JavaScript, or with
// reduced motion, the still photo of the finished book stays in place.
(()=>{
 const stage=document.querySelector('.hero-stage');
 if(!stage||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const PHOTO='assets/hero-child-photo.jpg',COVER='assets/cake-book-portrait/page-01.webp';
 const TITLE='Oliver and the Cake That Wouldn’t Wait';
 const PAGES=[
  ['assets/cake-book-portrait/page-02.webp','Oliver had promised himself the cake would be finished before noon. Then the cake said, “Hic!”'],
  ['assets/cake-book-portrait/page-03.webp','Two icing-covered boots pushed through the bottom layer. The cake hopped down and sprinted through the open door.'],
  ['assets/cake-book-portrait/page-04.webp','The cake burst into Mrs Bell’s bakery during the lunch rush. Oliver followed, with Pip close behind.']
 ];

 // ---- Pieces on the stage ----
 const demo=el('div','demo');demo.setAttribute('aria-hidden','true');
 const card=el('div','demo-card'),photo=el('img','demo-photo');photo.src=PHOTO;photo.alt='';card.append(photo);
 const hand=el('span','demo-hand');hand.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V14c0 3.9-2.6 7-6.3 7-2.4 0-3.9-1-5.2-2.8L4 14.6a1.6 1.6 0 0 1 2.5-2L9 15"/></svg>';
 card.append(hand);
 const dust=el('span','demo-dust');[[8,22,0],[90,14,.6],[95,52,1.3],[5,64,2],[84,86,.3],[14,90,1.7],[50,6,1],[66,94,2.4]].forEach(([x,y,d])=>{const i=el('i');i.style.cssText=`left:${x}%;top:${y}%;animation-delay:${d}s`;dust.append(i);});
 const flash=el('span','demo-flash');
 const bookHost=el('div','demo-book');
 const caption=el('p','stage-caption demo-cap','');
 demo.append(dust,bookHost,flash,card,caption);
 stage.append(demo);

 // ---- The hardback: same build as the book on the maker's price page ----
 const GAP=1.5,BLOCK=8;
 const buildBook=()=>{
  const cover=el('div','pb3-cover'),art=el('img');art.src=COVER;art.alt='';art.draggable=false;cover.append(art);
  const blank=el('div','demo-blank');blank.append(el('span',null,'Drop a photo'));cover.append(blank);
  const copy=el('div','pbook-cover-copy');copy.append(el('p',null,'A personalised story for Oliver'),el('h3',null,TITLE));cover.append(copy);
  const rights=[cover],lefts=[];
  PAGES.forEach(([src,text],i)=>{
   const left=el('div','pbook-page pbook-art'),img=el('img','pbook-paint');img.src=src;img.alt='';img.draggable=false;left.append(img);lefts.push(left);
   const body=el('div','pbook-body');body.append(el('p','pbook-text',text));
   const words=el('div','pbook-page pbook-words');words.append(el('p','pbook-head',TITLE),body,el('span','pbook-folio',String(i*2+3)));rights.push(words);
  });
  const book=el('div','pb3-book');
  book.append(el('div','pb3-shadow'),el('div','pb3-back'),el('div','pb3-edge pb3-back-edge'),el('div','pb3-edge pb3-fore'),el('div','pb3-edge pb3-tail'),el('div','pb3-ribbon'));
  const spine=el('div','pb3-spine');spine.append(el('span',null,TITLE));
  const back=el('div','pb3-backcover'),bimg=el('img');bimg.src=COVER;bimg.alt='';back.append(bimg,el('span',null,'Craven & Quill'));
  book.append(spine,back);
  rights.forEach((right,i)=>{
   const leaf=el('div','pb3-leaf'+(i===0?' pb3-hard':''));
   const front=el('div','pb3-face pb3-front');front.append(right);
   const rear=el('div','pb3-face pb3-rear');if(lefts[i])rear.append(lefts[i]);
   leaf.append(front,rear);if(i===0)leaf.append(el('div','pb3-board-edge'),el('div','pb3-board-tail'));
   book.append(leaf);
  });
  const s=el('div','pb3');s.append(book);return s;
 };
 const layout=(s,page)=>{
  const leaves=[...s.querySelectorAll('.pb3-leaf')],n=leaves.length,prev=s.dataset.page===undefined?page:Number(s.dataset.page);
  const show=(lo,hi)=>leaves.forEach((leaf,i)=>leaf.classList.toggle('pb3-off',i<lo||i>hi));
  s.dataset.page=String(page);clearTimeout(s._settle);
  if(prev===page||s.classList.contains('instant'))show(page-1,page);
  else{show(Math.min(prev,page)-1,Math.max(prev,page));s._settle=setTimeout(()=>show(page-1,page),1450);}
  s.dataset.open=page?'1':'0';s.style.setProperty('--depth',(BLOCK+(n-page)*GAP)+'px');
  leaves.forEach((leaf,i)=>{const turned=i<page;
   if(leaf.dataset.turned!==undefined&&leaf.dataset.turned!==String(turned)&&!s.classList.contains('instant')){leaf.classList.remove('turning');void leaf.offsetWidth;leaf.classList.add('turning');clearTimeout(leaf._t);leaf._t=setTimeout(()=>leaf.classList.remove('turning'),1400);}
   leaf.dataset.turned=String(turned);
   leaf.style.transform=turned?`translateZ(${(i+1)*GAP}px) rotateY(-180deg)`:`translateZ(${BLOCK+(n-i)*GAP}px) rotateY(0deg)`;});
 };
 let book=null;
 const sizeBook=()=>{const pw=Math.round(Math.min(stage.clientWidth*.28,stage.clientHeight*.3,200))+'px';bookHost.style.setProperty('--pw',pw);book?.style.setProperty('--pw',pw);};
 new ResizeObserver(sizeBook).observe(stage);

 // ---- The loop. It only runs while the hero is on screen and the tab is visible. ----
 let onScreen=true;
 new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;}).observe(stage);
 const wait=ms=>new Promise(done=>{const end=Date.now()+ms;const tick=()=>{if(Date.now()>=end)return done();setTimeout(tick,Math.min(250,end-Date.now()));};tick();});
 const holdWhileHidden=async()=>{while(!onScreen||document.visibilityState!=='visible')await wait(400);};
 const scene=(name,text)=>{demo.dataset.scene=name;if(text&&caption.textContent!==text){caption.classList.remove('show');void caption.offsetWidth;caption.textContent=text;caption.classList.add('show');}};
 const ready=new Promise(done=>{if(photo.complete&&photo.naturalWidth)done();else{photo.onload=done;photo.onerror=done;}});
 (async()=>{
  await ready;
  stage.classList.add('demo-on');
  for(;;){
   await holdWhileHidden();
   book?.remove();book=buildBook();book.classList.add('instant');bookHost.replaceChildren(book);sizeBook();layout(book,0);
   requestAnimationFrame(()=>requestAnimationFrame(()=>book.classList.remove('instant')));
   demo.classList.remove('revealed');
   scene('empty','One photo');await wait(1000);
   scene('drag');await wait(1800);
   scene('dropped','Their hardback, made from it');demo.classList.add('revealed');await wait(2600);
   for(let p=1;p<=PAGES.length;p++){await holdWhileHidden();layout(book,p);await wait(3000);}
   layout(book,0);await wait(1500);
   book.classList.add('twirl');
   const on=setTimeout(()=>book.classList.add('from-back'),1900),off=setTimeout(()=>book.classList.remove('from-back'),3270);
   await wait(6000);clearTimeout(on);clearTimeout(off);book.classList.remove('twirl','from-back');
   await wait(1800);
  }
 })();
})();
