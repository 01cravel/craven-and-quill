import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {BOOK,PRODUCTS,requireThat} from './catalog.js';
const mm=n=>n*72/25.4;
export async function printBook(order,read,fontBytes,logoBytes){
 const spec=PRODUCTS[order.size],pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true});const logo=await pdf.embedPng(logoBytes);
 const W=mm(spec.widthMm),H=mm(spec.heightMm),M=mm(12),ink=rgb(.04,.22,.18),cream=rgb(.99,.97,.91),images=[];
 pdf.setTitle(order.story.title);pdf.setAuthor('Craven & Quill');
 const page=()=>{const p=pdf.addPage([W,H]);p.drawRectangle({x:0,y:0,width:W,height:H,color:cream});return p;};
 function lines(text,size,width){const out=[];for(const para of text.split('\n')){let line='';for(const word of para.split(/\s+/)){requireThat(font.widthOfTextAtSize(word,size)<=width,'A word is too long for this page. Edit the story before printing.');const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>width){out.push(line);line=word;}else line=next;}out.push(line);}return out;}
 function words(p,text,{size=spec.id==='a5'?14:19,y=H-M,center=false}={}){const ls=lines(text,size,W-2*M);requireThat(y-ls.length*size*1.45>=mm(15),'Story text overflows this size. Shorten it before making a print file.');for(const line of ls){p.drawText(line,{x:center?(W-font.widthOfTextAtSize(line,size))/2:M,y,size,font,color:ink});y-=size*1.45;}return y;}
 async function art(p,key,top=H-M,bottom=M,fullPage=false){const {bytes,type}=await read(key);const image=type==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=fullPage?Math.max(W/image.width,H/image.height):Math.min((W-M*2)/image.width,(top-bottom)/image.height,72/300);const w=image.width*scale,h=image.height*scale;p.drawImage(image,{x:(W-w)/2,y:fullPage?(H-h)/2:bottom+(top-bottom-h)/2,width:w,height:h});images.push({dpi:Math.floor(72/scale),widthPx:image.width,heightPx:image.height,fullPage,cropPercent:fullPage?Math.round((1-W*H/(w*h))*10000)/100:0});}
 function brand(p){const w=mm(12),h=w*logo.height/logo.width;p.drawImage(logo,{x:M,y:M,width:w,height:h});p.drawText('Craven & Quill',{x:M+w+mm(2),y:M+mm(3),size:spec.id==='a5'?8:11,font,color:ink});}
 // Front cover in the same design as the example books: full-page art, a dark fade at the foot,
 // "A personalised story for …", the title and a reading-age tag, all inside the board wrap margin.
 const cover=page();await art(cover,order.art.cover,H,0,true);
 const shade=rgb(14/255,28/255,24/255),white=rgb(1,1,1),fadeTop=H*.56,bands=160,band=fadeTop/bands;
 // Bands do not overlap, so the fade stays smooth instead of striped.
 for(let i=0;i<bands;i++){const t=(i+.5)/bands,opacity=t<.55?.9-(.35*t/.55):.55*(1-(t-.55)/.45);cover.drawRectangle({x:0,y:i*band,width:W,height:band,color:shade,opacity});}
 const coverText=(text,size,y,opacity=1)=>cover.drawText(text,{x:(W-font.widthOfTextAtSize(text,size))/2,y,size,font,color:white,opacity});
 const ages={'3-5':'age 3–5','6-8':'age 6–8','9-12':'age 9–12','teen-adult':'an adult'},tagText=ages[order.age]?'Written for '+ages[order.age]:'',tagSize=spec.id==='a5'?8:11,titleSize=spec.id==='a5'?30:42,forSize=spec.id==='a5'?10:14;
 let y=mm(20);
 if(tagText){const tw=font.widthOfTextAtSize(tagText,tagSize)+tagSize*2.2,th=tagSize*2.1,r=th/2;cover.drawSvgPath(`M ${r} 0 H ${tw-r} A ${r} ${r} 0 0 1 ${tw} ${r} A ${r} ${r} 0 0 1 ${tw-r} ${th} H ${r} A ${r} ${r} 0 0 1 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,{x:(W-tw)/2,y:y+th,color:white,opacity:.18});coverText(tagText,tagSize,y+th/2-tagSize*.34);y+=th+mm(5);}
 // Balance the title: the narrowest width that keeps the same number of lines, so no lone last word.
 let titleWidth=W-2*M-mm(6);const titleCount=lines(order.story.title,titleSize,titleWidth).length;
 while(titleCount>1&&titleWidth>mm(40)&&lines(order.story.title,titleSize,titleWidth-mm(2)).length===titleCount)titleWidth-=mm(2);
 const titleLines=lines(order.story.title,titleSize,titleWidth).reverse();
 for(const line of titleLines){coverText(line,titleSize,y);y+=titleSize*1.08;}
 coverText('A personalised story for '+order.names,forSize,y+mm(1),.9);
 requireThat(y+forSize+mm(1)<=fadeTop,'The title is too long for the cover. Shorten it before printing.');
 const title=page();words(title,order.story.title,{size:spec.id==='a5'?22:30,y:H*.69,center:true});words(title,'A story for '+order.names,{y:H*.40,center:true});
 const dedication=page();
 const giftSize=spec.id==='a5'?13:18;
 const giftParts=[{text:'A story just for',size:giftSize},{text:order.names,size:spec.id==='a5'?23:32},...(order.senderName?[{text:'Given with love by '+order.senderName,size:giftSize}]:[]),...(order.dedication?[{text:order.dedication,size:giftSize}]:[])];
 const giftGap=mm(6),giftHeight=giftParts.reduce((h,p)=>h+lines(p.text,p.size,W-2*M).length*p.size*1.45,0)+(giftParts.length-1)*giftGap;
 let giftY=H/2+giftHeight/2-giftSize;
 for(const part of giftParts){giftY=words(dedication,part.text,{size:part.size,y:giftY,center:true})-giftGap;}
 const opening=page();words(opening,'Let the story begin',{y:H*.55,center:true});
 // Interior page 4 is left, so art on the left faces its matching text on the right.
 for(let i=0;i<BOOK.spreads;i++){await art(page(),order.art.scenes[i],H,0,true);const textPage=page(),size=spec.id==='a5'?14:19,count=lines(order.story.spreads[i].text,size,W-M*2).length;words(textPage,order.story.spreads[i].text,{size,y:Math.min(H-mm(30),H/2+(count-1)*size*1.45/2-size*.35)});}
 words(page(),'The End',{size:spec.id==='a5'?26:34,y:H*.55,center:true});
 const keepsake=page();words(keepsake,'One story. Entirely theirs.',{y:H*.60,center:true});brand(keepsake);
 const end=page();words(end,'Made especially for '+order.names,{y:H*.60,center:true});brand(end);
 const back=page();words(back,order.story.synopsis,{y:H*.70});brand(back);
 requireThat(pdf.getPageCount()===BOOK.pdfPages,'Unexpected print page count.');
 return {bytes:await pdf.save(),preflight:{pageCount:BOOK.pdfPages,interiorPages:BOOK.interiorPages,widthMm:spec.widthMm,heightMm:spec.heightMm,safeMm:12,fontsEmbedded:true,images,allImages300dpi:images.every(x=>x.dpi>=300),pdfX4:false,notes:['The cover and story illustrations fill the page; proportional centre-cropping may trim edges. Check the cover title sits clear of the board wrap and every page before approval.','Effective image resolution is reported at its printed size; low-resolution artwork must be replaced.','These are existing trim-size proof pages; supplier bleed requirements still require print review.','PDF/X-4 certification is not performed. Human inspection of every page remains required.']}};
}
export async function validatePdf(bytes,spec){const pdf=await PDFDocument.load(bytes);requireThat(pdf.getPageCount()===BOOK.pdfPages,`Use a ${BOOK.pdfPages}-page PDF, including front and back covers.`);requireThat(pdf.getPages().every(p=>Math.abs(p.getWidth()-mm(spec.widthMm))<1&&Math.abs(p.getHeight()-mm(spec.heightMm))<1),'PDF page dimensions do not match the selected book size.');return {pageCount:BOOK.pdfPages,widthMm:spec.widthMm,heightMm:spec.heightMm};}
export async function makeSpine(widthMm,heightMm){const pdf=await PDFDocument.create();pdf.addPage([mm(widthMm),mm(heightMm)]).drawRectangle({x:0,y:0,width:mm(widthMm),height:mm(heightMm),color:rgb(.04,.22,.18)});return pdf.save();}
