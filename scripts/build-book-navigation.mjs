import {readFile, writeFile} from 'node:fs/promises';

const client = new URL('../dist/client/', import.meta.url);
const template = (await readFile(new URL('book-navigation.html', import.meta.url), 'utf8')).trim();
const pages = [
  'index', 'personalised-childrens-books', 'personalised-books-for-adults', 'personalised-christmas-book',
  'personalised-birthday-book', 'example-books', 'examples/the-map-beneath-the-moon', 'examples/the-cake-that-quit',
  'examples/noah-and-the-little-cloud', 'examples/oliver-and-the-cake-that-wouldnt-wait', 'examples/the-last-christmas-lantern',
];
for (const name of pages) {
  const file = new URL(name + '.html', client);
  const original = await readFile(file, 'utf8');
  const header = /<header class="site-header">[\s\S]*?<\/header>/;
  if (!header.test(original)) throw Error('Missing public book header in ' + name);
  let html = original.replace(header, template);
  if (!html.includes('/book-navigation.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="/book-navigation.css?v=1">\n  <script src="/book-navigation.js?v=1" defer></script>\n</head>');
  if (html !== original) await writeFile(file, html);
}
