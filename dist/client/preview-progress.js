(()=>{
  // One drawing attempt. Most finish in under a minute; one that has not answered in 100 seconds is treated as stuck.
  function attempt(form,onProgress){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','/api/generate-character');xhr.timeout=100000;
      xhr.setRequestHeader('X-Craven-Preview','character');
      xhr.upload.onprogress=event=>onProgress({phase:'upload',percent:event.lengthComputable?Math.min(100,Math.round(event.loaded/event.total*100)):null});
      xhr.upload.onload=()=>onProgress({phase:'drawing'});
      xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{data={};}
        if(xhr.status<200||xhr.status>=300||!data.image){reject(Object.assign(new Error(data.error||'The character could not be drawn. Please try again.'),{code:data.code,stuck:xhr.status>=502&&xhr.status<=504}));return;}
        onProgress({phase:'received'});resolve(data);
      };
      xhr.onerror=()=>reject(Object.assign(new Error('The connection was interrupted. Check your internet connection, then tap Try again.'),{stuck:true}));
      xhr.ontimeout=()=>reject(Object.assign(new Error('We could not finish the drawing this time. Tap Try again and we will have another go.'),{stuck:true}));
      xhr.onabort=()=>reject(new Error('The preview was interrupted. Please try again.'));
      xhr.send(form);
    });
  }
  // A stuck or dropped drawing gets one automatic second try, so the shopper is never left on a frozen screen.
  // A refusal (for example a photo we cannot use) is not retried.
  async function request(form,onProgress=()=>{}){
    try{return await attempt(form,onProgress);}
    catch(error){if(!error.stuck)throw error;onProgress({phase:'retry'});return attempt(form,onProgress);}
  }

  // Sketchpad: draws the character line by line with a moving pencil, then washes in colour, and repeats.
  let sketchRun=0;
  function sketch(){
    const svg=document.getElementById('sketch');if(!svg)return{finish(){}};
    const run=++sketchRun,paths=[...svg.querySelectorAll('.ink path')],pencil=document.getElementById('sketch-pencil');
    const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lens=paths.map(p=>p.getTotalLength());
    const reset=()=>{svg.classList.remove('washed','done');paths.forEach((p,i)=>{p.style.strokeDasharray=lens[i];p.style.strokeDashoffset=lens[i];});};
    const showAll=()=>{paths.forEach(p=>{p.style.strokeDashoffset=0;});svg.classList.add('washed','done');};
    if(calm){showAll();return{finish(){}};}
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const drawPath=(i)=>new Promise(resolve=>{const p=paths[i],len=lens[i],dur=Math.max(260,Math.min(1500,len*7));let t0=null;
      const step=t=>{if(run!==sketchRun)return resolve();if(t0===null)t0=t;const k=Math.min(1,(t-t0)/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        p.style.strokeDashoffset=len*(1-e);const pt=p.getPointAtLength(len*e);pencil.setAttribute('transform',`translate(${pt.x} ${pt.y})`);
        if(k<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
    (async()=>{while(run===sketchRun){reset();await wait(250);for(let i=0;i<paths.length&&run===sketchRun;i++){await drawPath(i);await wait(90);}
      if(run!==sketchRun)return;svg.classList.add('washed','done');await wait(3600);}})();
    return{finish(){sketchRun++;showAll();}};
  }

  // Magic easel: their own photo, untouched, in a frame while gold light sweeps over it, then sparkles and a gilt edge.
  // The photo itself is never altered, so it can't look strange.
  let magicRun=0;
  function magic(photoUrl){
    const box=document.getElementById('magic');if(!box)return{stage(){},finish(){}};
    const run=++magicRun,photo=document.getElementById('magic-photo');
    box.dataset.stage='study';box.classList.remove('no-photo','calm');if(matchMedia('(prefers-reduced-motion: reduce)').matches)box.classList.add('calm');
    photo.removeAttribute('src');
    if(photoUrl){photo.onload=null;photo.onerror=()=>{if(run===magicRun)box.classList.add('no-photo');};photo.src=photoUrl;}
    else box.classList.add('no-photo');
    return{
      stage(next){if(run===magicRun&&box.dataset.stage!==next&&box.dataset.stage!=='paused')box.dataset.stage=next;},
      finish(ok){if(run!==magicRun)return;box.dataset.stage=ok?'gild':'paused';}
    };
  }
  const niceName=v=>v.replace(/(^|[\s\-'’])(\p{Ll})/gu,(m,a,b)=>a+b.toUpperCase());
  const firstName=()=>{const v=(document.getElementById('names')?.value||'').trim().split(/,|&| and /i)[0].trim();return v?niceName(v):'';};
  function start(photoUrl){
    const root=document.getElementById('drawing-progress'),bar=document.getElementById('drawing-bar'),stage=document.getElementById('drawing-stage'),note=document.getElementById('drawing-note');
    let stopped=false,phase='saving',phaseAt=Date.now(),index=0,total=1,value=4;
    const fill=next=>{value=Math.max(value,next);root.style.setProperty('--progress',`${value}%`);};
    const words=(title,detail)=>{if(stage.textContent!==title)stage.textContent=title;note.textContent=detail;bar.setAttribute('aria-valuetext',title);};
    const began=Date.now();let wand={stage(){},finish(){}};
    const stageNow=()=>{const all=(Date.now()-began)/1000;return all<5?'study':all<17?'sketch':all<31?'paint':'gild';};
    const tick=()=>{if(stopped)return;const seconds=(Date.now()-phaseAt)/1000;wand.stage(stageNow());
      // Estimated visual pacing. The provider exposes no drawing percentage.
      // Never retreat, and never reach completion before the response arrives.
      if(phase==='drawing'){
        const base=18+index/total*72,span=72/total;fill(base+span*.92*(1-Math.exp(-seconds/42)));
        const person=total>1?` (${index+1} of ${total})`:'';
        const n=firstName(),their=n?n+'’s':'their';
        const who=n||'them',lines={study:`Studying ${their} photo`,sketch:`Drawing ${who} as a storybook hero`,paint:`Adding colour and light`,gild:'Adding the final golden touches'};
        words(lines[stageNow()]+person,seconds<45?'Usually under a minute.':'Nearly there.');
      }
    };
    const update=event=>{if(stopped)return;if(phase!==event.phase)phaseAt=Date.now();phase=event.phase;root.dataset.phase=phase;
      if(phase==='upload'){fill(10+index/total*72);words('Reading their photo','Usually under a minute.');}
      if(phase==='drawing'){fill(18+index/total*72);tick();}
      if(phase==='retry'){words('Taking longer than usual','Trying again now. Stay on this page.');}
      if(phase==='received'){fill(18+(index+1)/total*72);words(index+1===total?'Nearly there':'One down, one to go','Putting the pages together.');}
    };
    const nameEl=document.getElementById('sketch-name');if(nameEl)nameEl.textContent=firstName()||'Your star';const pad=sketch();wand=magic(photoUrl);root.dataset.phase='saving';fill(4);words('Getting started','Usually under a minute.');const timer=setInterval(tick,1000);
    return{update,person(next,count){index=next;total=count;update({phase:'upload'});},stop(ok){stopped=true;clearInterval(timer);pad.finish();wand.finish(ok);root.dataset.phase=ok?'complete':'error';if(ok)fill(100);words(ok?'Ready':'Paused',ok?'':'See below to continue.');}};
  }
  window.cqPreviewProgress={request,start};
})();
