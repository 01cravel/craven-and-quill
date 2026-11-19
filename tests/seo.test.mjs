import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import worker from '../dist/server/index.js';

const origin = 'https://cravenandquill.com';
const assets = new URL('../dist/client/', import.meta.url);
const read = file => readFileSync(new URL(file, assets), 'utf8');
const locations = file => Array.from(read(file).matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]);

test('robots advertises a sitemap of public pages that name themselves as the preferred URL', () => {
  const urls = locations('sitemap.xml');
  assert.ok(read('robots.txt').includes('Sitemap: ' + origin + '/sitemap.xml'));
  assert.equal(new Set(urls).size, urls.length);
  for (const path of ['/', '/personalised-birthday-book', '/examples/the-map-beneath-the-moon']) {
    assert.ok(urls.includes(origin + path));
  }
  for (const url of locations('colouring-books/sitemap.xml')) assert.ok(urls.includes(url));
  for (const url of urls) {
    const {pathname, origin: host, search, hash} = new URL(url);
    assert.equal(host, origin);
    assert.equal(search + hash, '');
    assert.doesNotMatch(pathname, /\.html$|^\/(orders?|analytics|api|owner-login|test-book)(?:\/|$)/);
    const file = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '.html');
    const page = read(file);
    const canonical = page.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    assert.equal(canonical?.[1], url, file);
    assert.doesNotMatch(page, /name="robots"[^>]*noindex/i);
  }
});

test('the old personalised address permanently redirects while preserving campaign information', async () => {
  for (const path of ['/personalised', '/personalised.html','/personalised/']) {
    const request = new Request(origin + path + '?utm_source=google&gclid=example');
    const response = await worker.fetch(request, {ASSETS:{}});
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), origin + '/?utm_source=google&gclid=example');
  }
});
