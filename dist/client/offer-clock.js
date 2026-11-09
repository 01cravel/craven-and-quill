// Counts down to the next midnight in UK time. The offer line resets each day.
(()=>{
  const clocks=[...document.querySelectorAll('[data-offer-clock]')];
  if(!clocks.length)return;
  const london=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const pad=n=>String(n).padStart(2,'0');
  function secondsLeft(now=new Date()){
    const parts=Object.fromEntries(london.formatToParts(now).map(p=>[p.type,p.value]));
    const done=Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
    return Math.max(1,86400-done);
  }
  function tick(){
    const left=secondsLeft();
    const text=`${pad(Math.floor(left/3600))}:${pad(Math.floor(left%3600/60))}:${pad(left%60)}`;
    for(const clock of clocks){const time=clock.querySelector('time');if(time)time.textContent=text;}
  }
  tick();setInterval(tick,1000);
})();
