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
        if(seconds<18)words('Drawing their storybook character'+person,'Inspired by their photo. Made for their story.');
        else if(seconds<42)words('Their illustration is taking shape'+person,'A familiar face, a gentle smile, a little storybook magic.');
        else if(seconds<85)words('Bringing their character to life'+person,'Their illustration will be the centre of the first page.');
        else words('Still drawing their illustration'+person,'Some characters take a little longer. We’ll show it as soon as it’s ready.');
      }
    };
    const update=event=>{if(stopped)return;if(phase!==event.phase)phaseAt=Date.now();phase=event.phase;root.dataset.phase=phase;
      if(phase==='upload'){fill(10+index/total*72);words('Preparing their photo','Sending the reference for their illustrated character.');}
      if(phase==='drawing'){fill(18+index/total*72);tick();}
      if(phase==='received'){fill(18+(index+1)/total*72);words(index+1===total?'Opening their first page':'Their first character is ready',index+1===total?'Pairing their illustration with the opening of their story.':'Next, we’ll draw their story companion.');}
    };
    root.dataset.phase='saving';fill(4);words('Saving your preview details','Then the storybook magic begins.');const timer=setInterval(tick,1000);
    return{update,person(next,count){index=next;total=count;update({phase:'upload'});},stop(ok){stopped=true;clearInterval(timer);root.dataset.phase=ok?'complete':'error';if(ok)fill(100);words(ok?'Your first page is ready':'Preview paused',ok?'A new adventure, with them at the heart of it.':'See below to continue.');}};
  }
  window.cqPreviewProgress={request,start};
})();
