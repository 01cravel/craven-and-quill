// Keep the mobile app shell inside the visible area above the software keyboard.
// Do not disable zoom or force document scrolling while the user is editing.
(()=>{
 const mobile=matchMedia('(max-width:780px)'),viewport=window.visualViewport;
 const root=document.documentElement,panel=document.querySelector('.step-panel');
 if(!panel)return;
 let frame=0;
 function keepFieldVisible(){
  const field=document.activeElement;
  if(!field?.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select')||!panel.contains(field))return;
  const bounds=panel.getBoundingClientRect(),rect=field.getBoundingClientRect();
  const actions=document.querySelector('.step.active .step-actions');
  const reserve=actions?Math.min(actions.getBoundingClientRect().height,90):0;
  const top=bounds.top+16,bottom=bounds.bottom-reserve-16;
  if(rect.top<top)panel.scrollTop+=rect.top-top;
  else if(rect.bottom>bottom)panel.scrollTop+=Math.min(rect.bottom-bottom,Math.max(0,rect.top-top));
 }
 function sync(){
  frame=0;
  if(!mobile.matches){root.style.removeProperty('--app-height');root.style.removeProperty('--app-top');return;}
  // Leave pinch zoom under the browser's control.
  if(viewport&&Math.abs(viewport.scale-1)>.05)return;
  root.style.setProperty('--app-height',`${viewport?.height||window.innerHeight}px`);
  root.style.setProperty('--app-top',`${viewport?.offsetTop||0}px`);
  keepFieldVisible();
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
 viewport?.addEventListener('resize',schedule);
 viewport?.addEventListener('scroll',schedule);
 window.addEventListener('resize',schedule);
 window.addEventListener('pageshow',schedule);
 mobile.addEventListener('change',schedule);
 document.addEventListener('focusin',schedule);
 document.addEventListener('focusout',schedule);
 sync();
})();
