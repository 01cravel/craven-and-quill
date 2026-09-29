import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/client/preview-progress.js',import.meta.url),'utf8');
function setup(){
 const xhrs=[],nodes={},rows=Array.from({length:3},()=>({classList:{toggle(){},add(){},remove(){}}}));let cleared=0;
 class XHR{constructor(){this.upload={};xhrs.push(this);}open(){}setRequestHeader(){}send(){}}
 const node=()=>({dataset:{},style:{setProperty(){}},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}});
 for(const id of ['drawing-progress','drawing-bar','drawing-stage','drawing-note','drawing-time'])nodes[id]=node();
 const context={window:{},XMLHttpRequest:XHR,Date,setInterval:()=>1,clearInterval:()=>cleared++,document:{getElementById:id=>nodes[id],querySelectorAll:()=>rows}};
 vm.runInNewContext(source,context);return{api:context.window.cqPreviewProgress,xhrs,nodes,cleared:()=>cleared};
}
test('reports upload bytes then waits without claiming drawing percentage',async()=>{
 const {api,xhrs,nodes,cleared}=setup();const progress=api.start();const result=api.request({},progress.update);const xhr=xhrs[0];
 xhr.upload.onprogress({lengthComputable:true,loaded:5,total:10});assert.equal(nodes['drawing-bar'].attrs['aria-valuenow'],'50');
 xhr.upload.onload();assert.equal(nodes['drawing-progress'].dataset.phase,'drawing');assert.equal(nodes['drawing-bar'].attrs['aria-valuenow'],undefined);
 xhr.status=200;xhr.responseText=JSON.stringify({image:'data:image/jpeg;base64,test',previewId:'receipt'});xhr.onload();
 assert.equal((await result).previewId,'receipt');assert.equal(nodes['drawing-progress'].dataset.phase,'received');progress.stop(true);assert.equal(cleared(),1);
});
test('server refusals, disconnection and timeout reject instead of reporting completion',async()=>{
 for(const mode of ['http','network','timeout']){
  const {api,xhrs,nodes,cleared}=setup();const progress=api.start();const promise=api.request({},progress.update);const xhr=xhrs[0];
  if(mode==='http'){xhr.status=422;xhr.responseText=JSON.stringify({error:'Different photo needed',code:'character_blocked'});xhr.onload();}
  else if(mode==='network')xhr.onerror();else xhr.ontimeout();
  await assert.rejects(promise);progress.stop(false);assert.equal(nodes['drawing-progress'].dataset.phase,'error');assert.equal(cleared(),1);
 }
});
