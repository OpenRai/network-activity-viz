import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../js/netloom-visibility.js',import.meta.url),'utf8'),c);
test('culling keeps crossing paths while excluding distant marks',()=>{
 const v=c.createNetloomVisibility([1,0,0,1,-100,-100],400,300);
 expect(v.intersects(0,0,600,150)).toBe(true);expect(v.intersects(700,700,10,10)).toBe(false);
 expect(v.intersects(90,90,20,20)).toBe(true);
});
test('label occupancy rejects overlaps but permits separate labels and hides unreadably small fonts',()=>{
 const v=c.createNetloomVisibility([1,0,0,1,0,0],400,300);
 expect(v.label(40,40,80,9)).toBe(true);expect(v.label(50,40,80,9)).toBe(false);expect(v.label(200,100,80,9)).toBe(true);
 expect(c.createNetloomVisibility([.3,0,0,.3,0,0],400,300).label(50,50,80,9)).toBe(false);
});
