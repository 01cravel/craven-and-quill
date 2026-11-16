import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {testDb} from './sqlite-d1.mjs';

test('a saved preview repaints each old page once using the approved portrait regardless of reader age',async t=>{
  const DB=testDb(),id=crypto.randomUUID();
  DB.sqlite.prepare("INSERT INTO preview_receipts(id,status,created_at) VALUES (?,'succeeded',?)").run(id,new Date().toISOString());
  DB.sqlite.exec('CREATE TABLE preview_pages(preview_id TEXT,page INTEGER,status TEXT,created_at TEXT,PRIMARY KEY(preview_id,page))');
  const scenes=['Jonny playing football','Jonny under the tree','Jonny finds the ball'];
  const ref=Buffer.from('approved Jonny portrait'),ages=['3-5','9-12','teen-adult'];
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,{body})=>{
    assert.equal(url,'https://api.openai.com/v1/images/edits');
    assert.deepEqual(Buffer.from(await body.get('image[]').arrayBuffer()),ref);
    const prompt=body.get('prompt');
    assert.ok(prompt.includes(scenes[calls]));
    assert.match(prompt,/adult stays an adult, a child stays a child/i);
    assert.match(prompt,/references determine appearance/i);
    assert.doesNotMatch(prompt,/aged 3 to 5|aged 9 to 12|never a teenager or adult/i);
    calls++;
    return Response.json({data:[{b64_json:'cGFnZQ=='}]});
  });
  const draw=page=>worker.fetch(new Request('https://example.test/api/preview-page/reference-1',{method:'POST',body:JSON.stringify({previewId:id,page,scene:scenes[page],age:ages[page],characters:['data:image/jpeg;base64,'+ref.toString('base64')]})}),{DB,OPENAI_API_KEY:'test'});
  for(let page=0;page<3;page++){
    DB.sqlite.prepare("INSERT INTO preview_pages VALUES (?,?,'done','old')").run(id,page);
    assert.equal((await draw(page)).status,200);
    assert.equal((await draw(page)).status,409);
  }
  assert.equal(calls,3);
});
