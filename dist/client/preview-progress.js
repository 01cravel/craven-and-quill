(()=>{
  function request(form,onProgress=()=>{}){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','/api/generate-character');xhr.timeout=210000;
      xhr.setRequestHeader('X-Craven-Preview','character');
      xhr.upload.onprogress=event=>onProgress({phase:'upload',percent:event.lengthComputable?Math.min(100,Math.round(event.loaded/event.total*100)):null});
      xhr.upload.onload=()=>onProgress({phase:'drawing'});
      xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{data={};}
        if(xhr.status<200||xhr.status>=300||!data.image){reject(Object.assign(new Error(data.error||'The character could not be drawn. Please try again.'),{code:data.code}));return;}
        onProgress({phase:'received'});resolve(data);
      };
      xhr.onerror=()=>reject(new Error('The connection was interrupted. Check your internet connection, then try again.'));
      xhr.ontimeout=()=>reject(new Error('The illustration is taking too long. Please try again in a few minutes.'));
      xhr.onabort=()=>reject(new Error('The preview was interrupted. Please try again.'));
      xhr.send(form);
    });
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
  const firstName=()=>{const v=(document.getElementById('names')?.value||'').trim().split(/,|&| and /i)[0].trim();return v?v.charAt(0).toUpperCase()+v.slice(1):'';};
  function start(){
    const root=document.getElementById('drawing-progress'),bar=document.getElementById('drawing-bar'),stage=document.getElementById('drawing-stage'),note=document.getElementById('drawing-note');
    let stopped=false,phase='saving',phaseAt=Date.now(),index=0,total=1,value=4;
    const fill=next=>{value=Math.max(value,next);root.style.setProperty('--progress',`${value}%`);};
    const words=(title,detail)=>{if(stage.textContent!==title)stage.textContent=title;note.textContent=detail;bar.setAttribute('aria-valuetext',title);};
    const tick=()=>{if(stopped)return;const seconds=(Date.now()-phaseAt)/1000;
      // Estimated visual pacing. The provider exposes no drawing percentage.
      // Never retreat, and never reach completion before the response arrives.
      if(phase==='drawing'){
        const base=18+index/total*72,span=72/total;fill(base+span*.92*(1-Math.exp(-seconds/42)));
        const person=total>1?` (${index+1} of ${total})`:'';
        const n=firstName(),their=n?n+'’s':'their';
        if(seconds<10)words('Sketching '+their+' face'+person,'Takes about a minute. Stick the kettle on.');
        else if(seconds<20)words('Getting that smile just right'+person,'We’re working from their photo.');
        else if(seconds<32)words('Doing the hair (always the tricky bit)'+person,'Curls, fringes, the lot.');
        else if(seconds<45)words('Adding a splash of colour'+person,'Nearly ready for their first page.');
        else if(seconds<70)words('Picking out a storybook outfit'+person,'Every hero needs one.');
        else words('Final touches'+person,'Good drawings take a moment. Not long now.');
      }
    };
    const update=event=>{if(stopped)return;if(phase!==event.phase)phaseAt=Date.now();phase=event.phase;root.dataset.phase=phase;
      if(phase==='upload'){fill(10+index/total*72);words('Having a good look at their photo','Takes about a minute. Stick the kettle on.');}
      if(phase==='drawing'){fill(18+index/total*72);tick();}
      if(phase==='received'){fill(18+(index+1)/total*72);words(index+1===total?'Ta-da!':'One down, one to go',index+1===total?'Here they come.':'Next, we’ll draw their story companion.');}
    };
    const nameEl=document.getElementById('sketch-name');if(nameEl)nameEl.textContent=firstName()||'them';const pad=sketch();root.dataset.phase='saving';fill(4);words('Getting the paper ready','Takes about a minute. Stick the kettle on.');const timer=setInterval(tick,1000);
    return{update,person(next,count){index=next;total=count;update({phase:'upload'});},stop(ok){stopped=true;clearInterval(timer);pad.finish();root.dataset.phase=ok?'complete':'error';if(ok)fill(100);words(ok?'Your first page is ready':'Preview paused',ok?'A new adventure, with them at the heart of it.':'See below to continue.');}};
  }
  window.cqPreviewProgress={request,start};
})();
