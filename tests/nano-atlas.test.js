import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../nano-atlas.html',import.meta.url),'utf8');
const script=html.slice(html.indexOf("const VIEW = 'atlas';")).split('</script>')[0];
function draw(blocks,width=1200){
 const labels=[],marks=[],hits=[];
 const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const c=vm.createContext({ctx,hits,state:{time:20000},reducedMotion:true,colors:{},logAmount:raw=>Math.log10(Number(raw))-30,short:x=>x,text:(label,x,y)=>labels.push({label,x,y}),mark:(block,x,y)=>marks.push({block,x,y}),dot(){},line(){},empty(){}});
 vm.runInContext(script,c);c.draw({blocks,transfers:blocks.filter(b=>b.subtype==='send').map(send=>({send}))},width,800);
 return {labels,marks,hits};
}
const send={hash:'SEND',account:'alice',destination:'bob',subtype:'send',raw:'1000000000000000000000000000000',at:1000};
test('Atlas includes both ends of sends and exposes clickable address bounds',()=>{
 const r=draw([send]);expect(r.labels.map(x=>x.label)).toEqual(expect.arrayContaining(['alice','bob']));
 const addresses=r.hits.filter(x=>x.account);expect(addresses).toHaveLength(2);
 for(const hit of addresses){expect(hit.right).toBeGreaterThan(hit.left);expect(hit.bottom).toBeGreaterThan(hit.top)}
 expect(r.marks.some(x=>x.block.hash==='SEND')).toBe(true);
 for(const p of [...r.labels,...r.marks]){expect(Number.isFinite(p.x)).toBe(true);expect(Number.isFinite(p.y)).toBe(true)}
});
test('Atlas keeps account chains bounded to the latest eight blocks',()=>{
 const r=draw(Array.from({length:20},(_,i)=>({...send,hash:String(i),at:i*1000})));
 expect(r.marks).toHaveLength(8);expect(r.marks.map(x=>x.block.hash)).toEqual(['12','13','14','15','16','17','18','19']);
});
test('mobile Atlas selects the most recent accounts within its limit',()=>{
 const r=draw(Array.from({length:40},(_,i)=>({...send,account:'account'+i,destination:null,at:i*1000})),390);
 expect(r.labels).toHaveLength(28);expect(r.labels.some(x=>x.label==='account39')).toBe(true);expect(r.labels.some(x=>x.label==='account0')).toBe(false);
});
