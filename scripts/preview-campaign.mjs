// Local-only QA: SQLite storage and a deliberately mocked drawing result. No email or AI calls.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import worker from '../dist/server/index.js';
import {beginPreview,finishPreview} from '../dist/server/campaign.js';
import {testDb} from '../tests/sqlite-d1.mjs';
const root=resolve('dist/client');const DB=testDb();let failNextSignup=true;
const env={DB,SIGNUPS_EXPORT_TOKEN:'local-test-only',ASSETS:{async fetch(request){
  const path=resolve(root,'.'+new URL(request.url).pathname);
  if(!path.startsWith(root+'/'))return new Response('Not found',{status:404});
  try{return new Response(await readFile(path),{headers:{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}};
createServer(async(req,res)=>{
  try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const headers=new Headers(req.headers);headers.set('CF-IPCountry','GB');
    const request=new Request('http://127.0.0.1:4318'+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    let response;
    if(req.url.startsWith('/api/generate-character')){
      const previewId=await beginPreview(env);await finishPreview(env,previewId,'succeeded');
      response=Response.json({image:'/assets/storybook.webp',previewId});
    }else if(req.url==='/api/launch-signup'&&failNextSignup){failNextSignup=false;response=Response.json({error:'Local test: save failed. Your email has not been saved. Please try again.'},{status:503});}
    else response=await worker.fetch(request,env);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Local test error');}
}).listen(4318,'127.0.0.1',()=>console.log('Local mocked campaign preview: http://127.0.0.1:4318'));
