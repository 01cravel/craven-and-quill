import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

// Exercise the generated migration and production SQL against SQLite, not string mocks.
export function testDb(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_storybook_launch_test.sql',import.meta.url),'utf8'));
  return {sqlite,prepare(sql){
    let args=[];
    // D1's ?1 bindings correspond to SQLite numbered parameters.
    const indexes=[];const statement=sqlite.prepare(sql.replace(/\?(\d+)/g,(_,index)=>{indexes.push(Number(index)-1);return '?';}));
    return {bind(...values){args=indexes.map(index=>values[index]);return this;},
      async first(){return statement.get(...args)||null;},
      async all(){return {results:statement.all(...args),success:true};},
      async run(){return {success:true,meta:statement.run(...args)};}};
  },async batch(statements){return Promise.all(statements.map(statement=>statement.all()));}};
}
