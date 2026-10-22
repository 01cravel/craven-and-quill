import {build} from 'esbuild';
await build({entryPoints:['src/orders.js'],outfile:'dist/server/orders.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:false});
