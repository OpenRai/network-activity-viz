import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function harness(){
 let now=10000000;const storage=new Map(),window={};class Clock extends Date{static now(){return now}}
 vm.runInNewContext(readFileSync(new URL('../js/event-cache.js',import.meta.url),'utf8'),{window,Date:Clock,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>1,clearTimeout(){},addEventListener(){}});
 return {cache:window.nanoEventCache,advance:ms=>now+=ms,now:()=>now};
}
const packet=hash=>({topic:'confirmation',message:{hash,amount:'1',account:'nano_test',block:{subtype:'send'}}});
test('common event cache caps retained history at 600 blocks',()=>{
 const h=harness();for(let i=0;i<610;i++){h.cache.record(packet(i.toString(16)),h.now());h.advance(1)}
 const saved=h.cache.restore();expect(saved).toHaveLength(600);expect(saved[0].hash).toBe('A');
});
test('hash duplicates refresh last-seen TTL and restore elapsed time',()=>{
 const h=harness();expect(h.cache.record(packet('abc')).isNew).toBe(true);h.advance(3500000);
 expect(h.cache.record(packet('ABC')).isNew).toBe(false);h.advance(200000);
 expect(h.cache.restore()).toHaveLength(1);expect(h.cache.restore()[0].elapsedMs).toBe(200000);
 h.advance(3600001);expect(h.cache.restore()).toHaveLength(0);
});
