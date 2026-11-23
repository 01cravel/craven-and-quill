import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/client/create.js',import.meta.url),'utf8');
const gate=source.slice(source.indexOf('function validPreviewEmail(){'),source.indexOf("$('#photo-permission').addEventListener('change',updatePhotoGate)"));
function setup(){const nodes={'#email':{value:'',validity:{valid:true}},'#second-person':{hidden:true},'#photo-permission':{checked:false},'#preview-email-wrap':{},'#photo-continue':{},'#extra-photo-wrap':{},'#extra-photos':{},'.extra-photo-label':{}};const state={photos:[{}],photoChecks:[{pass:true}]};const ctx={state,$:id=>nodes[id]};vm.runInNewContext(gate,ctx);return{nodes,state,update:ctx.updatePhotoGate,validEmail:ctx.validPreviewEmail};}
test('photo step needs checked photos and permission, independently of the later email step',()=>{
 const {nodes,state,update}=setup();update();assert.equal(nodes['#photo-continue'].disabled,true);
 nodes['#photo-permission'].checked=true;update();assert.equal(nodes['#photo-continue'].disabled,false);
 nodes['#photo-permission'].checked=false;update();assert.equal(nodes['#photo-continue'].disabled,true);
 nodes['#photo-permission'].checked=true;state.photoChecks=[];update();assert.equal(nodes['#photo-continue'].disabled,true);
 state.photoChecks=[{pass:false}];update();assert.equal(nodes['#photo-continue'].disabled,true);
 state.photoChecks=[{pass:true}];update();assert.equal(nodes['#photo-continue'].disabled,false);
 state.photos.push({},{});state.photoChecks.push({pass:true},{pass:true});update();assert.equal(nodes['#photo-continue'].disabled,false);assert.equal(nodes['#extra-photos'].disabled,true);
 state.photos.push({});state.photoChecks.push({pass:true});update();assert.equal(nodes['#photo-continue'].disabled,true);
});
test('separate email validation still rejects missing and malformed addresses',()=>{
 const {nodes,validEmail}=setup();
 for(const value of ['', 'invalid','a@b','a b@example.com','@example.com']){nodes['#email'].value=value;assert.equal(validEmail(),false);}
 nodes['#email'].value='person@example.com';assert.equal(validEmail(),true);
 nodes['#email'].validity.valid=false;assert.equal(validEmail(),false);
});

test('email is saved before their book shows, and re-linked once the character exists',async()=>{
 const fn=source.slice(source.indexOf('async function capturePreviewEmail('),source.indexOf('function previewReady(){'));
 let payload;
 const ctx={crypto:{randomUUID:()=>'11111111-2222-4333-8444-555555555555'},state:{previewId:'receipt-id'},$:id=>({value:id==='#email'?'Person@Example.com':''}),AbortSignal,window:{cqMeasurement:{context:()=>({source:'meta'})}},fetch:async(url,options)=>{assert.equal(url,'/api/preview-email');payload=JSON.parse(options.body);return{ok:true,json:async()=>({ok:true})};}};
 vm.runInNewContext(fn,ctx);await ctx.capturePreviewEmail();assert.equal(payload.email,'person@example.com');assert.equal(payload.source,'meta');assert.equal(payload.previewId,'receipt-id');assert.equal(ctx.state.emailNeedsLink,false);
 let leadId;ctx.window.cqMeasurement.savedLead=id=>{leadId=id;};await ctx.capturePreviewEmail();assert.equal(leadId,'11111111-2222-4333-8444-555555555555','Meta hears about the saved book');
 leadId=null;await ctx.capturePreviewEmail(true);assert.equal(leadId,null,'re-linking does not count a second signup');
 ctx.state.previewId=null;await ctx.capturePreviewEmail();assert.equal(ctx.state.emailNeedsLink,true,'no character yet, so link it later');
 ctx.fetch=async()=>({ok:false,json:async()=>({error:'Save failed'})});await assert.rejects(ctx.capturePreviewEmail(),/Save failed/);
 const prepare=source.slice(source.indexOf('async function preparePreview(){'),source.indexOf('for(let index=0;index<10;'));
 assert.equal(prepare.includes('await capturePreviewEmail'),false,'drawing does not wait for an email');
 assert.ok(prepare.includes('void sendPreviewLink();'),'the link email goes once the character exists');
 const pay=source.slice(source.indexOf("$('#join-launch').addEventListener"),source.indexOf("void loadOrderCatalog();"));
 assert.ok(pay.indexOf('await saveEmailOnce()')>0&&pay.indexOf('await saveEmailOnce()')<pay.indexOf("fetch('/api/orders'"),'email is saved before the order');
 assert.match(source,/const order=\[1,9,2,5,13,11\]/);
});

test('multiple references create one character, not one character per photo',async()=>{
 const fn=source.slice(source.indexOf('async function renderStoryArt(){'),source.indexOf('async function capturePreviewEmail('));
 const nodes={'#preview-image':{},'#preview-image-second':{},'#preview-art':{classList:{toggle(){}}}};
 const photos=[{name:'front'},{name:'side'},{name:'smile'}];let calls=0;
 const ctx={state:{photos,names:'Leo',secondName:'',characterImages:[]},$:id=>nodes[id],drawingProgress:null,requestCharacter:async(files,name)=>{calls++;assert.equal(files.length,3);assert.equal(name,'Leo');return 'one-character';}};
 vm.runInNewContext(fn,ctx);await ctx.renderStoryArt();assert.equal(calls,1);assert.equal(ctx.state.characterImages.length,1);assert.equal(nodes['#preview-image-second'].hidden,true);
 await ctx.renderStoryArt();assert.equal(calls,1,'cached character is reused');
});

test('the photo page asks for an email before drawing, and the link is emailed once per character',async()=>{
 const html=readFileSync(new URL('../dist/client/create.html',import.meta.url),'utf8');
 const photo=html.slice(html.indexOf('data-step="2"'),html.indexOf('data-step="9"'));
 assert.ok(photo.includes('id="early-email"')&&photo.indexOf('id="early-email"')<photo.indexOf('id="photo-continue"'),'email box sits above Continue on the photo page');
 assert.equal(html.includes('id="save-email"'),false,'the old box on the character page is gone');
 assert.match(source,/Add your email so we can send you their character\./);
 const fn=source.slice(source.indexOf('async function sendPreviewLink(){'),source.indexOf("$('#email').addEventListener('blur'"));
 const line={textContent:'',hidden:true};let captures=[],sent=0;
 const ctx={state:{previewId:'p1',emailNeedsLink:true},savedEmail:'a@example.com',$:id=>id==='#email'?{value:'A@example.com'}:line,validPreviewEmail:()=>true,recordQuote(){},
  capturePreviewEmail:async relink=>{captures.push(relink);ctx.state.emailNeedsLink=false;},window:{cqEmailDraft:async()=>{sent++;return true;}}};
 vm.runInNewContext('let savedEmail="a@example.com";'+fn+';this.sendPreviewLink=sendPreviewLink;',ctx);
 await ctx.sendPreviewLink();assert.deepEqual(captures,[true],'the early email is tied to the new character without a second signup');assert.equal(sent,1);
 assert.equal(line.hidden,false);assert.match(line.textContent,/a@example\.com/);
 await ctx.sendPreviewLink();assert.equal(sent,1,'never emailed twice for the same character');
 ctx.state.previewId='p2';await ctx.sendPreviewLink();assert.equal(sent,2);assert.deepEqual(captures,[true],'already saved, so no extra save');
});
