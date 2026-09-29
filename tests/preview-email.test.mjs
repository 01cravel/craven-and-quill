import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/client/create.js',import.meta.url),'utf8');
const gate=source.slice(source.indexOf('function validPreviewEmail(){'),source.indexOf("['#face-confirm','#photo-permission']"));
function setup(){const nodes={'#email':{value:'',validity:{valid:true}},'#second-person':{hidden:true},'#face-confirm':{checked:false},'#photo-permission':{checked:false},'#preview-email-wrap':{},'#create-preview':{}};const state={photos:[{}],photoChecks:[{pass:true}]};const ctx={state,$:id=>nodes[id]};vm.runInNewContext(gate,ctx);return{nodes,state,update:ctx.updatePhotoGate};}
test('email appears only after a checked photo and both confirmations; valid email enables preview',()=>{
 const {nodes,state,update}=setup();update();assert.equal(nodes['#preview-email-wrap'].hidden,true);assert.equal(nodes['#create-preview'].disabled,true);
 nodes['#face-confirm'].checked=true;update();assert.equal(nodes['#preview-email-wrap'].hidden,true);
 nodes['#photo-permission'].checked=true;update();assert.equal(nodes['#preview-email-wrap'].hidden,false);assert.equal(nodes['#create-preview'].disabled,true);
 for(const value of ['invalid','a@b','a b@example.com','@example.com']){nodes['#email'].value=value;update();assert.equal(nodes['#create-preview'].disabled,true);}
 nodes['#email'].value='person@example.com';update();assert.equal(nodes['#create-preview'].disabled,false);
 nodes['#email'].validity.valid=false;update();assert.equal(nodes['#create-preview'].disabled,true);nodes['#email'].validity.valid=true;
 nodes['#photo-permission'].checked=false;update();assert.equal(nodes['#preview-email-wrap'].hidden,true);assert.equal(nodes['#create-preview'].disabled,true);
 nodes['#photo-permission'].checked=true;state.photoChecks=[];update();assert.equal(nodes['#create-preview'].disabled,true);
 state.photoChecks=[{pass:false}];update();assert.equal(nodes['#preview-email-wrap'].hidden,true);
 state.photoChecks=[{pass:true}];nodes['#second-person'].hidden=false;update();assert.equal(nodes['#create-preview'].disabled,true);
 state.photos.push({});state.photoChecks.push({pass:true});update();assert.equal(nodes['#create-preview'].disabled,false);
 nodes['#email'].value='';update();assert.equal(nodes['#create-preview'].disabled,true);
});
