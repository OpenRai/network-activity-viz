import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/stress-demo.js',import.meta.url),'utf8'),c);
test('stress fixture repeats 1,000 transfers over five minutes across 100 accounts',()=>{
 const a=c.createStressDemo(),b=c.createStressDemo();
 expect(JSON.stringify(a)).toBe(JSON.stringify(b));
 const sends=a.events.filter(e=>e.message.block.subtype==='send');
 expect(sends.length).toBe(1000);
 expect(new Set(sends.flatMap(e=>[e.message.account,e.message.block.link_as_account])).size).toBe(100);
 expect(a.events.every((e,i)=>e.at>=0&&e.at<=300000&&(!i||e.at>=a.events[i-1].at))).toBe(true);
 const counts=new Map();for(const e of sends)counts.set(e.message.account,(counts.get(e.message.account)||0)+1);
 expect([...counts.values()].sort((a,b)=>b-a).slice(0,10).reduce((a,b)=>a+b,0)).toBeGreaterThan(500);
 const hashes=new Set(sends.map(e=>e.message.hash));
 expect(a.events.filter(e=>e.message.block.subtype==='receive').every(e=>hashes.has(e.message.block.link))).toBe(true);
});
