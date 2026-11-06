import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function settings(stored){
 const controls={replaceChildren(){}},label={firstChild:{textContent:''},after(){}};
 const node={value:'demo',replaceChildren(){},setAttribute(){},closest:s=>s==='label'?label:controls,addEventListener(){}};
 const memory={replaceChildren(){},setAttribute(){},addEventListener(){}};
 const localStorage={getItem:key=>key==='nano-gallery-node'?stored:null,setItem(){},removeItem(){}};
 const c={document:{querySelector:s=>s==='#feed'?node:null,createElement:s=>s==='select'?memory:{append(){}}},Option:function(label,value){this.value=value},localStorage,window:{}};
 vm.runInNewContext(readFileSync(new URL('../js/page-settings.js',import.meta.url),'utf8'),c);
 return node.value;
}
for(const stored of [null,'demo','stress','invalid'])test('startup uses a live node when saved choice is '+stored,()=>{
 expect(settings(stored)).toBe('wss://ws.nano.to');
});
test('a saved live repeater remains selectable',()=>{
 expect(settings('wss://node.somenano.com/repeater')).toBe('wss://node.somenano.com/repeater');
});
