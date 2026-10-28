import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/client/create.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function storyBasis(){'),source.indexOf('function draftValid('));
function brief(mode,mood,details,idea){const ctx={state:{storyMode:mode,mood,details,names:'Jamie',secondName:'',age:'teen-adult'},$:()=>({value:idea})};vm.runInNewContext(fn,ctx);return JSON.parse(ctx.storyBasis());}
test('invented route sends interests as the source of the plot, not a stock premise',()=>{
 const b=brief('invent','funny','Football and fish and chips','A stale custom plot');
 assert.equal(b.details,'Football and fish and chips');assert.equal(b.mood,'funny');assert.match(b.idea,/one or two strongest details/);assert.ok(!b.idea.includes('stale'));
});
test('customer plot stays intact independently of selected tone',()=>{
 for(const tone of ['funny','adventure','classic']){const b=brief('plot',tone,'','Scores the winning goal at Wembley');assert.equal(b.idea,'Scores the winning goal at Wembley');assert.equal(b.mood,tone);}
});
