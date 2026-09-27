import {readFileSync} from 'node:fs';
const notice=readFileSync(new URL('../dist/client/privacy.html',import.meta.url),'utf8');
if(notice.includes('LAUNCH_CONTACT_REQUIRED')){
  console.error('Publish blocked: replace the draft contact notice with Luke’s chosen working public contact address.');
  process.exitCode=1;
}
