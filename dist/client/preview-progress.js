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
    const root=document.getElementById('drawing-progress'),bar=document.getElementById('drawing-bar'),stage=document.getElementById('drawing-stage');
    let stopped=false,person='';
    const update=event=>{if(stopped)return;root.dataset.phase=event.phase;
      const text=event.phase==='received'?'Opening your first page':event.phase==='drawing'?'Illustrating your character'+person:'Uploading your photo'+person;
      stage.textContent=text;bar.setAttribute('aria-valuetext',text);
    };
    update({phase:'upload'});
    return{update,person(index,total){person=total>1?` (${index+1} of ${total})`:'';update({phase:'upload'});},stop(ok){stopped=true;root.dataset.phase=ok?'complete':'error';const text=ok?'Your first page is ready':'Preview paused';stage.textContent=text;bar.setAttribute('aria-valuetext',text);}};
  }
  window.cqPreviewProgress={request,start};
})();
