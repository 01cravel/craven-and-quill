import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ageRule} from '../src/catalog.js';

test('every drawn page states the reader age so a child never drifts into an adult', () => {
  assert.match(ageRule('3-5'), /aged 3 to 5.*never older.*adult/);
  assert.match(ageRule('9-12'), /aged 9 to 12/);
  assert.match(ageRule('teen-adult'), /never make them look younger or older/);
  assert.equal(ageRule('anything else'), '');
  assert.match(readFileSync(new URL('../dist/client/create.js', import.meta.url), 'utf8'), /\/api\/preview-page[\s\S]{0,300}age:state\.age/);
  assert.match(readFileSync(new URL('../dist/server/index.js', import.meta.url), 'utf8'), /\$\{ageLine\}Warm hand-painted/);
  assert.match(readFileSync(new URL('../src/orders.js', import.meta.url), 'utf8'), /\$\{ageRule\(o\.data\.age\)\}Consistent/);
});
