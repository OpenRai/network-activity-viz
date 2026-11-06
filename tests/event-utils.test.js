import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/event-utils.js',import.meta.url),'utf8');
test('bounded recordings retain the newest entries',()=>{
 const c=vm.createContext({});vm.runInContext(source,c);
 const items=[];for(let i=0;i<6;i++)c.appendBounded(items,{hash:String(i)},3);
 expect(items.map(x=>x.hash)).toEqual(['3','4','5']);
});
test('block parsing preserves objects and accepts serialized blocks',()=>{
 const c=vm.createContext({});vm.runInContext(source,c);
 const block={subtype:'receive',link:'OLDER_SEND'};
 expect(c.parseNanoBlock(block)).toBe(block);
 expect(c.parseNanoBlock(JSON.stringify(block))).toEqual(block);
 expect(c.parseNanoBlock('broken JSON')).toBeNull();
});
test('JSON downloads preserve the supplied schema and release their object URL',()=>{
 const clicked=[],revoked=[],timers=[];
 let blob;
 const c=vm.createContext({Blob,URL:{createObjectURL:b=>{blob=b;return 'blob:test'},revokeObjectURL:u=>revoked.push(u)},document:{createElement:()=>({click(){clicked.push({href:this.href,name:this.download})}})},setTimeout:(fn,delay)=>timers.push({fn,delay})});
 vm.runInContext(source,c);
 c.downloadJSON({schema:3,events:[{hash:'BLOCK'}]},'events.json');
 expect(clicked).toEqual([{href:'blob:test',name:'events.json'}]);
 expect(blob.type.split(';')[0]).toBe('application/json');expect(timers[0].delay).toBe(1000);
 timers[0].fn();expect(revoked).toEqual(['blob:test']);
 return blob.text().then(text=>expect(JSON.parse(text)).toEqual({schema:3,events:[{hash:'BLOCK'}]}));
});
