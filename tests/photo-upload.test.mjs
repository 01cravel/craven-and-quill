import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {File} from 'node:buffer';
const source=readFileSync(new URL('../dist/client/photo-upload.js',import.meta.url),'utf8');
const jpeg=[255,216,255,224,0,16];
function runtime({bitmapFails=false,imageFails=false,blobFails=false}={}){
  const calls={revoked:0,closed:0};
  const canvas={getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(blobFails?null:new Blob([jpeg],{type:'image/jpeg'}))};
  class Image{naturalWidth=4000;naturalHeight=3000;set src(value){if(value)queueMicrotask(()=>imageFails?this.onerror():this.onload());}}
  const context={window:{},File,Blob,Uint8Array,setTimeout,clearTimeout,Image,
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){calls.revoked++;}},
    createImageBitmap:async()=>{if(bitmapFails)throw Error('Unsupported');return{width:4000,height:3000,close(){calls.closed++;}};},
    document:{createElement:()=>canvas}};
  vm.runInNewContext(source,context);return{api:context.window.cqPhotoUpload,calls,canvas};
}
test('JPEG bytes with missing or incorrect MIME become a bounded JPEG upload',async()=>{
  const {api,canvas,calls}=runtime();
  for(const type of ['', 'application/octet-stream','image/heic']){
    const result=await api.prepare(new File([new Uint8Array(jpeg)],'phone-photo',{type}));
    assert.equal(result.type,'image/jpeg');assert.equal(result.name,'storybook-photo.jpg');
  }
  assert.equal(canvas.width,2048);assert.equal(canvas.height,1536);assert.equal(calls.closed,3);
});
test('HEIC uses displayed-image fallback when ImageBitmap cannot decode it',async()=>{
  const {api,calls}=runtime({bitmapFails:true});
  const file=new File([new Uint8Array([0,0,0,24]),'ftypheic',new Uint8Array(4),'mif1'],'phone.heic',{type:'image/heic'});
  assert.equal(await api.photoKind(file),'heic');assert.equal((await api.prepare(file)).type,'image/jpeg');assert.equal(calls.revoked,1);
});
test('unsupported HEIC provides a screenshot recovery and releases the URL',async()=>{
  const {api,calls}=runtime({bitmapFails:true,imageFails:true});
  const file=new File([new Uint8Array([0,0,0,24]),'ftypheic'],'phone.heic',{type:'image/heic'});
  await assert.rejects(api.prepare(file),/screenshot/);assert.equal(calls.revoked,1);
});
test('rejects renamed non-images, oversized and empty files before decoding',async()=>{
  const {api}=runtime();
  await assert.rejects(api.prepare(new File(['<svg/>'],'fake.jpg',{type:'image/jpeg'})),/photo rather than/);
  await assert.rejects(api.prepare({size:31*1024*1024}),/30 MB/);
  await assert.rejects(api.prepare({size:0}),/empty/);
});
test('failed JPEG encoding gives recovery rather than an invalid upload',async()=>{
  const {api,calls}=runtime({blobFails:true});
  await assert.rejects(api.prepare(new File([new Uint8Array(jpeg)],'photo.jpg')),/screenshot/);assert.equal(calls.closed,1);
});

test('unrecognised raster headers are decoded instead of rejected by a format list',async()=>{
  const {api}=runtime();
  for(const type of ['image/avif','image/heif','']){
    const file=new File(['newer raster container'],'iphone-photo',{type});
    assert.equal(await api.photoKind(file),null);
    assert.equal((await api.prepare(file)).type,'image/jpeg');
  }
});
test('undecodable non-image files cannot become an upload',async()=>{
  const {api}=runtime({bitmapFails:true,imageFails:true});
  await assert.rejects(api.prepare(new File(['not a picture'],'fake.jpg')),/cannot open/);
});
