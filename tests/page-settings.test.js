import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function settings(stored,{page='netloom.html',storage=new Map(),existingMemory=false}={}){
 const controls={replaceChildren(){}},label={firstChild:{textContent:''},after(){}};
 const node={value:'demo',replaceChildren(){},setAttribute(){},closest:s=>s==='label'?label:controls,addEventListener(){}};
 const memory=Object.assign(new EventTarget(),{replaceChildren(){},setAttribute(){}});
 const localStorage={getItem:key=>key==='nano-gallery-node'?stored:storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const c={document:{querySelector:s=>s==='#feed'?node:s==='#win'&&existingMemory?memory:null,createElement:s=>s==='select'?memory:{append(){}}},Option:function(label,value){this.value=value},localStorage,location:{pathname:'/'+page},window:{}};
 vm.runInNewContext(readFileSync(new URL('../js/page-settings.js',import.meta.url),'utf8'),c);
 return {node:node.value,memory,api:c.window.gallerySettings};
}
for(const stored of [null,'demo','stress','invalid'])test('startup uses a live node when saved choice is '+stored,()=>{
 expect(settings(stored).node).toBe('wss://node.somenano.com/repeater');
});
test('a saved live repeater remains selectable',()=>{
 expect(settings('wss://node.somenano.com/repeater').node).toBe('wss://node.somenano.com/repeater');
});

test('each page restores its own Memory choice without changing the shared cache',()=>{
 const cacheKey='nano-gallery-confirmed-events-v1',storage=new Map([[cacheKey,'cached confirmations']]);
 const choices=[['starmap.html','10'],['netloom.html','60'],['nano-atlas.html','10'],['eventsky.html','30']];
 for(const [page,value] of choices){
  const options={page,storage,existingMemory:page==='starmap.html'};
  const {memory,api}=settings(null,options);
  expect(api.memoryMs).toBe(30*60000);
  let changed;
  api.onMemoryChange(()=>{changed=api.memoryMs});
  memory.value=value;
  memory.dispatchEvent(new Event('change'));
  expect(changed).toBe(Number(value)*60000);
  expect(settings(null,options).memory.value).toBe(value);
 }
 expect(storage.size).toBe(5);
 expect(storage.get(cacheKey)).toBe('cached confirmations');
});
