// Homepage hero demo, on a loop: a photo is dragged in, a quill sketches it, watercolour washes in,
// then it becomes the real hardback, which turns its painted pages, closes and spins round.
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
 const drop=el('div','demo-drop');drop.append(el('span',null,'Drop a photo'));
 const frame=el('div','demo-frame'),photo=el('img','demo-photo'),sketchC=el('canvas','demo-sketch'),paintC=el('canvas','demo-paint');
 photo.src=PHOTO;photo.alt='';sketchC.width=paintC.width=240;sketchC.height=paintC.height=300;
 frame.append(photo,sketchC,paintC,el('span','demo-scan'));
 const quill=el('span','demo-quill');quill.innerHTML='<span><svg viewBox="0 0 48 48"><path class="q-vane" d="M44 3C30 6 17 16 10 33l5 1C22 21 32 11 44 3z"/><path class="q-shaft" d="M44 3 6 42"/><path class="q-nib" d="M9 37 4 45l8-5z"/></svg></span>';
 frame.append(quill);
 const hand=el('span','demo-hand');hand.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V14c0 3.9-2.6 7-6.3 7-2.4 0-3.9-1-5.2-2.8L4 14.6a1.6 1.6 0 0 1 2.5-2L9 15"/></svg>';
 const dust=el('span','demo-dust');[[8,22,0],[90,14,.6],[95,52,1.3],[5,64,2],[84,86,.3],[14,90,1.7],[50,6,1],[66,94,2.4]].forEach(([x,y,d])=>{const i=el('i');i.style.cssText=`left:${x}%;top:${y}%;animation-delay:${d}s`;dust.append(i);});
 const bookHost=el('div','demo-book');
 const caption=el('p','stage-caption demo-cap','One photo');
 const card=el('div','demo-card');card.append(frame,hand);
 demo.append(drop,dust,card,bookHost,caption);
 stage.append(demo);

 // ---- Pencil and watercolour versions of the photo, made in the browser ----
 const paintPhoto=()=>{
  const W=240,H=300,src=el('canvas');src.width=W;src.height=H;
  const sx=src.getContext('2d',{willReadFrequently:true}),r=Math.max(W/photo.naturalWidth,H/photo.naturalHeight);
  const dw=photo.naturalWidth*r,dh=photo.naturalHeight*r;sx.drawImage(photo,(W-dw)/2,(H-dh)/2.6,dw,dh);
  const d=sx.getImageData(0,0,W,H).data,L=new Float32Array(W*H);
  for(let i=0;i<W*H;i++)L[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];
  const at=(x,y)=>L[Math.min(H-1,Math.max(0,y))*W+Math.min(W-1,Math.max(0,x))];
  const sk=sketchC.getContext('2d').createImageData(W,H),pt=paintC.getContext('2d').createImageData(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const gx=-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1)+at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1);
   const gy=-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1)+at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1);
   const i=y*W+x,o=i*4,e=Math.min(1,Math.hypot(gx,gy)/260),v=Math.max(0,Math.min(1,.78+L[i]/255*.26)-e*1.25);
   sk.data[o]=247*v;sk.data[o+1]=241*v;sk.data[o+2]=229*v;sk.data[o+3]=255;
   let rr=0,gg=0,bb=0,n=0;for(let dy=-2;dy<=2;dy+=2)for(let dx=-2;dx<=2;dx+=2){const p=(Math.min(H-1,Math.max(0,y+dy))*W+Math.min(W-1,Math.max(0,x+dx)))*4;rr+=d[p];gg+=d[p+1];bb+=d[p+2];n++;}
   rr/=n;gg/=n;bb/=n;const g=(rr+gg+bb)/3;rr=g+(rr-g)*1.25;gg=g+(gg-g)*1.25;bb=g+(bb-g)*1.25;
   const q=c=>Math.round(Math.min(255,Math.max(0,c))/34)*34,ink=1-e*.6;
   pt.data[o]=(q(rr)*.8+247*.2)*ink;pt.data[o+1]=(q(gg)*.8+241*.2)*ink;pt.data[o+2]=(q(bb)*.8+229*.2)*ink;pt.data[o+3]=255;
  }
  sketchC.getContext('2d').putImageData(sk,0,0);paintC.getContext('2d').putImageData(pt,0,0);
 };

 // ---- The hardback: same build as the book on the maker's price page ----
 const GAP=1.5,BLOCK=8;
 const buildBook=()=>{
  const cover=el('div','pb3-cover'),art=el('img');art.src=COVER;art.alt='';art.draggable=false;cover.append(art);
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
  try{paintPhoto();}catch{demo.classList.add('no-paint');}
  stage.classList.add('demo-on');
  for(;;){
   await holdWhileHidden();
   book?.remove();book=buildBook();book.classList.add('instant');bookHost.replaceChildren(book);sizeBook();layout(book,0);
   scene('empty','One photo');await wait(900);
   scene('drag');await wait(1700);
   scene('dropped');await wait(700);
   scene('scan','A little magic');await wait(2600);
   scene('sketch');await wait(5200);
   scene('paint');await wait(4600);
   scene('book','Their hardback, made from it');book.classList.remove('instant');await wait(1400);
   for(let p=1;p<=PAGES.length;p++){await holdWhileHidden();layout(book,p);await wait(3000);}
   layout(book,0);await wait(1500);
   book.classList.add('twirl');
   const on=setTimeout(()=>book.classList.add('from-back'),1900),off=setTimeout(()=>book.classList.remove('from-back'),3270);
   await wait(6000);clearTimeout(on);clearTimeout(off);book.classList.remove('twirl','from-back');
   await wait(1800);
  }
 })();
})();
