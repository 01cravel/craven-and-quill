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
    const root=document.getElementById('drawing-progress'),bar=document.getElementById('drawing-bar'),stage=document.getElementById('drawing-stage'),note=document.getElementById('drawing-note'),clock=document.getElementById('drawing-time');
    const rows=document.querySelectorAll('#making-state li');const started=Date.now();let stopped=false,phase='upload',person='';
    const tick=()=>{const seconds=Math.floor((Date.now()-started)/1000);clock.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      if(phase==='drawing')note.textContent=seconds>=90?'This one is taking a little longer. Keep this page open while we wait for your illustration.':'Drawing takes a little time. You can watch the timer here while we wait for your illustration.';};
    const update=event=>{if(stopped)return;phase=event.phase;root.dataset.phase=phase;bar.removeAttribute('aria-valuenow');
      if(phase==='upload'){const percent=event.percent;stage.textContent='Uploading your photo'+person;note.textContent=percent==null?'Sending your prepared photo securely.':`${percent}% uploaded`;root.style.setProperty('--upload',`${percent??0}%`);if(percent!=null){bar.setAttribute('aria-valuenow',String(percent));bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');}}
      if(phase==='drawing'){stage.textContent='Illustrating your character'+person;rows[1].classList.add('done');}
      if(phase==='received'){stage.textContent='Opening your first page';note.textContent='Your illustration has arrived.';rows[2].classList.add('done');}
      bar.setAttribute('aria-valuetext',stage.textContent);tick();
    };
    rows.forEach((row,index)=>row.classList.toggle('done',index===0));update({phase:'upload',percent:0});const timer=setInterval(tick,1000);tick();
    return{update,person(index,total){person=total>1?` (${index+1} of ${total})`:'';rows[1].classList.remove('done');rows[2].classList.remove('done');update({phase:'upload',percent:0});},stop(ok){stopped=true;clearInterval(timer);root.dataset.phase=ok?'complete':'error';stage.textContent=ok?'Your first page is ready':'Preview paused';note.textContent=ok?'Made for your story.':'See below for the next step.';bar.setAttribute('aria-valuetext',stage.textContent);bar.removeAttribute('aria-valuenow');}};
  }
  window.cqPreviewProgress={request,start};
})();
