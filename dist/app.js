const dataLayer=window.dataLayer=window.dataLayer||[];
const track=(event,details={})=>dataLayer.push({event,...details});
track('page_view',{page_title:document.title,page_type:'personalised_book_landing'});

const menuButton=document.querySelector('.menu-button');
const navigation=document.querySelector('#site-nav');
menuButton.addEventListener('click',()=>{const open=navigation.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));});
navigation.addEventListener('click',()=>{navigation.classList.remove('open');menuButton.setAttribute('aria-expanded','false');});

document.querySelectorAll('a[href="create.html"]').forEach(link=>link.addEventListener('click',()=>track('create_preview_clicked',{label:link.textContent.trim()})));
document.querySelectorAll('.faq-list details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)track('faq_opened',{question:detail.querySelector('summary').textContent.replace('+','').trim()});}));
