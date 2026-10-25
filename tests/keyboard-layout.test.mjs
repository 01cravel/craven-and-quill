import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/client/keyboard-layout.js',import.meta.url),'utf8');
function setup(){
 const values={},events={},jobs=[];
 const viewport={height:740,offsetTop:0,scale:1,addEventListener:(name,fn)=>events['viewport:'+name]=fn};
 const mobile={matches:true,addEventListener:(name,fn)=>events['media:'+name]=fn};
 const panel={scrollTop:0,contains:()=>true,getBoundingClientRect:()=>({top:80,bottom:viewport.height})};
 const field={matches:()=>true,getBoundingClientRect:()=>({top:230,bottom:280})};
 const document={activeElement:field,documentElement:{style:{setProperty:(k,v)=>values[k]=v,removeProperty:k=>delete values[k]}},querySelector:s=>s==='.step-panel'?panel:{getBoundingClientRect:()=>({height:64})},addEventListener:(name,fn)=>events[name]=fn};
 const window={visualViewport:viewport,innerHeight:740,addEventListener:(name,fn)=>events['window:'+name]=fn};
 vm.runInNewContext(source,{window,document,matchMedia:()=>mobile,requestAnimationFrame:fn=>{jobs.push(fn);return jobs.length;}});
 const fire=name=>{events[name]();while(jobs.length)jobs.shift()();};
 return{values,viewport,mobile,panel,field,fire};
}
test('keyboard resize fits shell and only scrolls obscured field into view',()=>{
 const x=setup();assert.equal(x.values['--app-height'],'740px');assert.equal(x.panel.scrollTop,0);
 x.viewport.height=350;x.viewport.offsetTop=120;x.fire('viewport:resize');
 assert.equal(x.values['--app-height'],'350px');assert.equal(x.values['--app-top'],'120px');assert.equal(x.panel.scrollTop,10);
 x.viewport.height=740;x.viewport.offsetTop=0;x.fire('viewport:resize');assert.equal(x.values['--app-top'],'0px');assert.equal(x.panel.scrollTop,10);
});
test('pinch zoom is not fought and desktop clears mobile sizing',()=>{
 const x=setup();x.viewport.scale=2;x.viewport.height=200;x.fire('viewport:resize');assert.equal(x.values['--app-height'],'740px');
 x.mobile.matches=false;x.fire('media:change');assert.equal(x.values['--app-height'],undefined);assert.equal(x.values['--app-top'],undefined);
});
test('tall text fields remain usable without repeatedly scrolling to their bottom',()=>{
 const x=setup();x.viewport.height=350;x.field.getBoundingClientRect=()=>({top:110,bottom:510});x.fire('focusin');assert.equal(x.panel.scrollTop,14);
});
