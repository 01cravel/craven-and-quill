import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/client/preview-progress.js',import.meta.url),'utf8');
function setup(){
 const xhrs=[],nodes={};let now=0,tick,cleared=0;
 class XHR{constructor(){this.upload={};xhrs.push(this);}open(){}setRequestHeader(){}send(){}}
 const node=()=>({dataset:{},style:{setProperty(k,v){this[k]=v;}},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}});
 for(const id of ['drawing-progress','drawing-bar','drawing-stage','drawing-note'])nodes[id]=node();
 const context={window:{},Date:{now:()=>now},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>cleared++,XMLHttpRequest:XHR,document:{getElementById:id=>nodes[id]}};
 vm.runInNewContext(source,context);return{api:context.window.cqPreviewProgress,xhrs,nodes,advance:seconds=>{now+=seconds*1000;tick();},cleared:()=>cleared};
}
test('moves through real request stages without a timer or drawing percentage',async()=>{
 const {api,xhrs,nodes}=setup();const progress=api.start();const result=api.request({},progress.update);const xhr=xhrs[0];
 xhr.upload.onprogress({lengthComputable:true,loaded:5,total:10});assert.equal(nodes['drawing-bar'].attrs['aria-valuenow'],undefined);
 xhr.upload.onload();assert.equal(nodes['drawing-progress'].dataset.phase,'drawing');assert.equal(nodes['drawing-bar'].attrs['aria-valuenow'],undefined);
 xhr.status=200;xhr.responseText=JSON.stringify({image:'data:image/jpeg;base64,test',previewId:'receipt'});xhr.onload();
 assert.equal((await result).previewId,'receipt');assert.equal(nodes['drawing-progress'].dataset.phase,'received');progress.stop(true);assert.equal(nodes['drawing-progress'].dataset.phase,'complete');progress.update({phase:'drawing'});assert.equal(nodes['drawing-progress'].dataset.phase,'complete');
});
test('server refusals, disconnection and timeout reject instead of reporting completion',async()=>{
 for(const mode of ['http','network','timeout']){
  const {api,xhrs,nodes}=setup();const progress=api.start();const promise=api.request({},progress.update);const xhr=xhrs[0];
  if(mode==='http'){xhr.status=422;xhr.responseText=JSON.stringify({error:'Different photo needed',code:'character_blocked'});xhr.onload();}
  else if(mode==='network')xhr.onerror();else xhr.ontimeout();
  await assert.rejects(promise);progress.stop(false);assert.equal(nodes['drawing-progress'].dataset.phase,'error');assert.equal(nodes['drawing-bar'].attrs['aria-valuenow'],undefined);
 }
});

test('estimated fill advances without reversing and only completes on success',()=>{
 const {api,nodes,advance,cleared}=setup();const p=api.start();p.person(0,2);p.update({phase:'drawing'});
 const width=()=>parseFloat(nodes['drawing-progress'].style['--progress']);const initial=width();advance(30);assert.ok(width()>initial);advance(180);assert.ok(width()<54);
 p.update({phase:'received'});const first=width();p.person(1,2);p.update({phase:'drawing'});assert.ok(width()>=first);advance(200);assert.ok(width()<90);
 p.update({phase:'received'});assert.equal(width(),90);p.stop(true);assert.equal(width(),100);assert.equal(cleared(),1);
});
