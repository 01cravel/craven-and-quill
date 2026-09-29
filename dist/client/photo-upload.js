// Convert supported raster photos locally. Only the resulting JPEG is uploaded.
(()=>{
  const fallback='Open this photo and take a screenshot, then upload the screenshot instead.';
  async function photoKind(file){
    const b=new Uint8Array(await file.slice(0,64).arrayBuffer());
    if(b[0]===255&&b[1]===216&&b[2]===255)return'jpeg';
    if([137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n))return'png';
    const text=String.fromCharCode(...b);
    if(text.slice(0,4)==='RIFF'&&text.slice(8,12)==='WEBP')return'webp';
    if(text.slice(4,8)==='ftyp'&&/heic|heix|hevc|hevx|mif1|msf1/.test(text.slice(8)))return'heic';
    return null;
  }
  async function decode(file){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(file);}catch{}
    }
    // Safari can display some iPhone formats even when ImageBitmap cannot.
    const url=URL.createObjectURL(file);
    try{return await new Promise((resolve,reject)=>{
      const image=new Image();
      const timer=setTimeout(()=>{image.src='';reject(new Error('Photo reading timed out. '+fallback));},15000);
      image.onload=()=>{clearTimeout(timer);resolve(image);};
      image.onerror=()=>{clearTimeout(timer);reject(new Error('Your browser cannot open this photo. '+fallback));};
      image.src=url;
    });}finally{URL.revokeObjectURL(url);}
  }
  async function prepare(file){
    if(!file.size)throw new Error('This photo is empty. Choose another photo.');
    if(file.size>30*1024*1024)throw new Error('This photo is too large. Choose one under 30 MB, or upload a screenshot.');
    // Let the browser decode raster formats, including AVIF and newer HEIF variants.
    // Header recognition is a hint, never a reason to reject a displayable photo.
    const head=await file.slice(0,4096).text();
    if(/<svg[\s/>]|<!doctype\s+html|<html[\s>]/i.test(head)||file.type==='image/svg+xml')throw new Error('Choose a photo rather than a vector image or document. '+fallback);
    const image=await decode(file);
    try{
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
      if(!width||!height)throw new Error('This photo could not be read. '+fallback);
      const scale=Math.min(1,2048/Math.max(width,height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const context=canvas.getContext('2d');if(!context)throw new Error('Photo preparation is unavailable. Try reopening this page in Safari or Chrome.');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
      if(!blob||blob.type!=='image/jpeg'||blob.size>8*1024*1024)throw new Error('This photo could not be prepared. '+fallback);
      return new File([blob],'storybook-photo.jpg',{type:'image/jpeg'});
    }finally{image.close?.();}
  }
  window.cqPhotoUpload={prepare,decode,photoKind};
})();
