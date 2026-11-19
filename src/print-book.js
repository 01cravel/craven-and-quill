import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {BOOK,PRODUCTS,requireThat} from './catalog.js';
// 1x512 dark-green fade (strongest at the foot), stretched over the lower 56% of the front cover.
const COVER_FADE_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAIACAYAAABD1gYFAAAAN0lEQVR42mPgk5FgYGJgYGCEEwxYWLSTGLVy1MpRK0ethLGI4JKuYwQZP+qZUc+MemY0rIjkAgDF0AUmQGsSpwAAAABJRU5ErkJggg==';
const mm=n=>n*72/25.4;
export async function printBook(order,read,fontBytes,logoBytes,coverLogoBytes=null){
 const spec=PRODUCTS[order.size],pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true});const logo=await pdf.embedPng(logoBytes),coverLogo=coverLogoBytes?await pdf.embedPng(coverLogoBytes):null;
 const W=mm(spec.widthMm),H=mm(spec.heightMm),M=mm(12),ink=rgb(.04,.22,.18),cream=rgb(.99,.97,.91),images=[];
 pdf.setTitle(order.story.title);pdf.setAuthor('Craven & Quill');
 const page=()=>{const p=pdf.addPage([W,H]);p.drawRectangle({x:0,y:0,width:W,height:H,color:cream});return p;};
 function lines(text,size,width){const out=[];for(const para of text.split('\n')){let line='';for(const word of para.split(/\s+/)){requireThat(font.widthOfTextAtSize(word,size)<=width,'A word is too long for this page. Edit the story before printing.');const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>width){out.push(line);line=word;}else line=next;}out.push(line);}return out;}
 function words(p,text,{size=spec.id==='a5'?14:19,y=H-M,center=false,color=ink}={}){const ls=lines(text,size,W-2*M);requireThat(y-ls.length*size*1.45>=mm(15),'Story text overflows this size. Shorten it before making a print file.');for(const line of ls){p.drawText(line,{x:center?(W-font.widthOfTextAtSize(line,size))/2:M,y,size,font,color});y-=size*1.45;}return y;}
 async function art(p,key,top=H-M,bottom=M,fullPage=false){const {bytes,type}=await read(key);const image=type==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=fullPage?Math.max(W/image.width,H/image.height):Math.min((W-M*2)/image.width,(top-bottom)/image.height,72/300);const w=image.width*scale,h=image.height*scale;p.drawImage(image,{x:(W-w)/2,y:fullPage?(H-h)/2:bottom+(top-bottom-h)/2,width:w,height:h});images.push({dpi:Math.floor(72/scale),widthPx:image.width,heightPx:image.height,fullPage,cropPercent:fullPage?Math.round((1-W*H/(w*h))*10000)/100:0});}
 function brand(p){const w=mm(12),h=w*logo.height/logo.width;p.drawImage(logo,{x:M,y:M,width:w,height:h});p.drawText('Craven & Quill',{x:M+w+mm(2),y:M+mm(3),size:spec.id==='a5'?8:11,font,color:ink});}
 // Front cover in the same design as the example books: full-page art, a dark fade at the foot,
 // "A personalised story for …" and the title (no reading-age tag), all inside the board wrap margin.
 const cover=page();await art(cover,order.art.cover,H,0,true);
 const white=rgb(1,1,1),fadeTop=H*.56;
 // One see-through image for the fade. Stacked strips showed hairline stripes in PDF viewers and some printers.
 cover.drawImage(await pdf.embedPng(Uint8Array.from(atob(COVER_FADE_PNG),c=>c.charCodeAt(0))),{x:0,y:0,width:W,height:fadeTop});
 const coverText=(text,size,y,opacity=1)=>cover.drawText(text,{x:(W-font.widthOfTextAtSize(text,size))/2,y,size,font,color:white,opacity});
 const titleSize=spec.id==='a5'?30:42,forSize=spec.id==='a5'?10:14;
 // Craven & Quill logo (white and gold) at the foot of the front cover, title block above it.
 let y=mm(20);if(coverLogo){const lw=mm(spec.id==='a5'?16:22),lh=lw*coverLogo.height/coverLogo.width;cover.drawImage(coverLogo,{x:(W-lw)/2,y:mm(11),width:lw,height:lh});y=mm(11)+lh+mm(7);}

 // Balance the title: the narrowest width that keeps the same number of lines, so no lone last word.
 let titleWidth=W-2*M-mm(6);const titleCount=lines(order.story.title,titleSize,titleWidth).length;
 while(titleCount>1&&titleWidth>mm(40)&&lines(order.story.title,titleSize,titleWidth-mm(2)).length===titleCount)titleWidth-=mm(2);
 const titleLines=lines(order.story.title,titleSize,titleWidth).reverse();
 for(const line of titleLines){coverText(line,titleSize,y);y+=titleSize*1.08;}
 coverText('A personalised story for '+order.names,forSize,y+mm(1),.9);
 requireThat(y+forSize+mm(1)<=fadeTop,'The title is too long for the cover. Shorten it before printing.');
 // One opening page (title, who it is for, who it is from), vertically centred as a single block.
 // It replaced three near-empty pages (title, dedication, "Let the story begin") on 19 Nov 2026.
 const opening=page(),giftSize=spec.id==='a5'?13:18;
 const openParts=[{text:order.story.title,size:spec.id==='a5'?22:30,gap:mm(16)},{text:'A story just for',size:giftSize},{text:order.names,size:spec.id==='a5'?23:32},...(order.senderName?[{text:'Given with love by '+order.senderName,size:giftSize}]:[]),...(order.dedication?[{text:order.dedication,size:giftSize}]:[])];
 const openGap=mm(5),openHeight=openParts.reduce((h,p,i)=>h+lines(p.text,p.size,W-2*M).length*p.size*1.45+(i<openParts.length-1?(p.gap||openGap):0),0);
 let openY=H/2+openHeight/2-openParts[0].size;
 for(const part of openParts){openY=words(opening,part.text,{size:part.size,y:openY,center:true})-(part.gap||openGap);}
 // Interior page 2 is left, so art on the left faces its matching text on the right.
 // Words pages carry the book title at the top and a page number at the foot, like the site preview.
 // Numbering counts the opening page as 1, so the first words page (PDF page 4) is page 3.
 const muted=rgb(.45,.52,.49),headSize=spec.id==='a5'?8:10,folioSize=spec.id==='a5'?8:10;
 for(let i=0;i<BOOK.spreads;i++){await art(page(),order.art.scenes[i],H,0,true);const textPage=page(),size=spec.id==='a5'?14:19,count=lines(order.story.spreads[i].text,size,W-M*2).length;words(textPage,order.story.spreads[i].text,{size,y:Math.min(H-mm(30),H/2+(count-1)*size*1.45/2-size*.35)});
  const head=lines(order.story.title,headSize,W-2*M-mm(20))[0];textPage.drawText(head,{x:(W-font.widthOfTextAtSize(head,headSize))/2,y:H-mm(16),size:headSize,font,color:muted});
  const folio=String(3+i*2);textPage.drawText(folio,{x:(W-font.widthOfTextAtSize(folio,folioSize))/2,y:mm(12),size:folioSize,font,color:muted});}
 words(page(),'The End',{size:spec.id==='a5'?26:34,y:H*.55,center:true});
 // Back cover: brand green, a framed portrait of the child (art.back) when drawn, then "Made especially for …",
 // "With love from …", and the logo and web address at the foot. (Summary blurb removed 19 Nov 2026, owner's call.)
 const back=pdf.addPage([W,H]),green=rgb(.06,.2,.16),light=rgb(.99,.97,.91),soft=rgb(.85,.82,.74);back.drawRectangle({x:0,y:0,width:W,height:H,color:green});
 const madeSize=spec.id==='a5'?13:18,fromSize=spec.id==='a5'?10:13,site='cravenandquill.com',siteSize=spec.id==='a5'?8:10;
 const centre=(t,size,y,color)=>back.drawText(t,{x:(W-font.widthOfTextAtSize(t,size))/2,y,size,font,color});
 let textTop=H*.42;
 if(order.art.back){const {bytes,type}=await read(order.art.back);const image=type==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
  // A see-through PNG is a cut-out of the child: it sits straight on the green, larger, with no frame (owner's call, 19 Nov 2026).
  // A JPEG (older books, or if the cut-out drawing failed) keeps the cream frame.
  const cut=type==='image/png',fw=W*(cut?.68:.56),fh=fw*image.height/image.width,fx=(W-fw)/2,fy=H-mm(spec.id==='a5'?(cut?16:22):(cut?20:30))-fh,border=cut?0:mm(2.5);
  if(!cut)back.drawRectangle({x:fx-border,y:fy-border,width:fw+2*border,height:fh+2*border,color:light});back.drawImage(image,{x:fx,y:fy,width:fw,height:fh});
  images.push({dpi:Math.round(image.width/(fw/72)),widthPx:image.width,heightPx:image.height,fullPage:false,cropPercent:0});textTop=fy-border-mm(cut?8:14);}
 centre('Made especially for '+order.names,madeSize,textTop,light);
 if(order.senderName)centre('With love from '+order.senderName,fromSize,textTop-madeSize*1.9,soft);
 centre(site,siteSize,mm(14),soft);
 if(coverLogo){const lw=mm(spec.id==='a5'?14:18),lh=lw*coverLogo.height/coverLogo.width;back.drawImage(coverLogo,{x:(W-lw)/2,y:mm(14)+siteSize+mm(4),width:lw,height:lh});}
 requireThat(pdf.getPageCount()===BOOK.pdfPages,'Unexpected print page count.');
 return {bytes:await pdf.save(),preflight:{pageCount:BOOK.pdfPages,interiorPages:BOOK.interiorPages,widthMm:spec.widthMm,heightMm:spec.heightMm,safeMm:12,fontsEmbedded:true,images,allImages300dpi:images.every(x=>x.dpi>=300),pdfX4:false,notes:['The cover and story illustrations fill the page; proportional centre-cropping may trim edges. Check the cover title sits clear of the board wrap and every page before approval.','Effective image resolution is reported at its printed size; low-resolution artwork must be replaced.','These are existing trim-size proof pages; supplier bleed requirements still require print review.','PDF/X-4 certification is not performed. Human inspection of every page remains required.']}};
}
export async function validatePdf(bytes,spec){const pdf=await PDFDocument.load(bytes);requireThat(pdf.getPageCount()===BOOK.pdfPages,`Use a ${BOOK.pdfPages}-page PDF, including front and back covers.`);requireThat(pdf.getPages().every(p=>Math.abs(p.getWidth()-mm(spec.widthMm))<1&&Math.abs(p.getHeight()-mm(spec.heightMm))<1),'PDF page dimensions do not match the selected book size.');return {pageCount:BOOK.pdfPages,widthMm:spec.widthMm,heightMm:spec.heightMm};}
export async function makeSpine(widthMm,heightMm){const pdf=await PDFDocument.create();pdf.addPage([mm(widthMm),mm(heightMm)]).drawRectangle({x:0,y:0,width:mm(widthMm),height:mm(heightMm),color:rgb(.04,.22,.18)});return pdf.save();}
