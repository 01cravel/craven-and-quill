import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const names=['01-first-follow-up.html','01-first-follow-up.txt','02-10-percent-off.html','02-10-percent-off.txt'];
const content=await Promise.all(names.map(name=>readFile(`marketing/follow-up-emails/${name}`,'utf8')));
await writeFile('src/followup-templates.generated.js',content.map((value,index)=>`export const template${index+1}=${JSON.stringify(value)};`).join('\n')+'\n');
await build({entryPoints:['src/orders.js'],outfile:'dist/server/orders.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:false});
