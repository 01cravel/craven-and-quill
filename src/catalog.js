export const CATALOG_VERSION='2026-10-25-offer';
export const PRODUCTS={
  a5:{id:'a5',label:'A5 hardback',widthMm:148,heightMm:210,sku:'BOOK-FE-A5-P-HARD-G',pricePence:3999,regularPricePence:4999,discountPercent:20,estimatedSupplierPence:1506},
  a4:{id:'a4',label:'A4 hardback',widthMm:210,heightMm:297,sku:'BOOK-FE-A4-P-HARD-G',pricePence:4799,regularPricePence:5999,discountPercent:20,estimatedSupplierPence:1676},
};
// Owner-only test price: the code itself is never stored, only its SHA-256.
export const OWNER_TEST={codeHash:'4494c8d03100dff3c9560ca54ada85bc13cacb7852092bb59fbc8166b0578cdb',email:'cravenluke@gmail.com',pricePence:200,expiresAt:'2026-12-01T00:00:00Z'};
export const BOOK={pdfPages:28,interiorPages:26,spreads:10,paper:'200gsm gloss',cover:'Matte hardback',safeMm:10};
export function catalogue(enabled=false){return {version:CATALOG_VERSION,products:Object.values(PRODUCTS).map(({estimatedSupplierPence,...p})=>p),book:BOOK,currency:'GBP',shippingPence:0,country:'GB',includes:['UK standard delivery','Digital PDF','Human print review'],checkoutEnabled:enabled,proofPreparationDays:7,delivery:'First complete illustrated proof within 7 calendar days of payment. Usually 7–12 working days after final proof approval. An estimate, not a guaranteed arrival date.'};}
export class OrderError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function requireThat(ok,message,status=400){if(!ok)throw new OrderError(message,status);}
export const sha=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(v=>v.toString(16).padStart(2,'0')).join('');
export function safeText(value,max=200){return typeof value==='string'?value.replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,max):'';}
export function recipient(value){const v=value||{};const address=v.address||{};const result={name:safeText(v.name,100),address:{line1:safeText(address.line1),line2:safeText(address.line2),townOrCity:safeText(address.townOrCity,100),stateOrCounty:safeText(address.stateOrCounty,100),postalOrZipCode:safeText(address.postalOrZipCode,12).toUpperCase(),countryCode:'GB'}};requireThat(result.name&&result.address.line1&&result.address.townOrCity&&/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(result.address.postalOrZipCode),'Add a recipient name and complete UK delivery address.');requireThat(!address.countryCode||address.countryCode==='GB','UK delivery only during this pilot.');return result;}
export function checkoutReady(env){return env.ORDERS_ENABLED==='true'&&(env.PAYMENT_PROVIDER==='ziina'?(!!env.ZIINA_ACCESS_TOKEN&&!!env.ZIINA_ACCOUNT_ID&&!!env.ZIINA_WEBHOOK_SECRET&&['test','live'].includes(env.ZIINA_MODE)):(/^sk_(live|test)_/.test(env.STRIPE_SECRET_KEY||'')&&!!env.STRIPE_WEBHOOK_SECRET))&&!!env.PRODIGI_API_KEY&&!!env.RESEND_API_KEY&&!!env.ORDER_EMAIL_FROM;}
