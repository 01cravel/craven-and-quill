// Local-only journey QA. Synthetic responses, no external calls, payments or printing.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist/client');
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname.startsWith('/api/')){
   const parts=[];for await(const part of req)parts.push(part);
   if(url.pathname==='/api/orders/catalog')return json({checkoutEnabled:true,products:[{id:'a5',pricePence:3999},{id:'a4',pricePence:4799}]});
   if(url.pathname==='/api/generate-story')return json({ok:true,story:{title:'The QA Garden Adventure',synopsis:'A fictional test story about a garden picnic.',spreads:Array.from({length:10},(_,i)=>({text:`Charlotte found a surprise in the garden. This is test page ${i+1}.`,image_scene:'A cheerful garden picnic.'}))}});
   if(url.pathname==='/api/preview-email')return json({ok:true});
   if(url.pathname==='/api/generate-character')return json({image:'data:image/jpeg;base64,'+(await readFile(root+'/assets/hero-child-photo.jpg')).toString('base64'),previewId:'local-qa-only'});
   return json({error:'Local QA only. Orders, payment and printing are disabled.'},409);
  }
  const path=resolve(root,'.'+(url.pathname==='/create'?'/create.html':url.pathname));
  if(!path.startsWith(root+'/'))return json({error:'Not found'},404);
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf'})[extname(path)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4327,'127.0.0.1',()=>console.log('Local mock journey only: http://127.0.0.1:4327/create'));
