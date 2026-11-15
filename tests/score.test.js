import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../eventsky.html',import.meta.url),'utf8');
const drawSource=html.slice(html.indexOf('function draw(m,w,h){')).split('</script>')[0];
function renderEventsky(blocks,{width=1000,time=20000,windowMs=60000,transfers=[]}={}){
 const hits=[],radii=[];
 const state={time,windowMs};
 const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
 const context=vm.createContext({state,ctx,hits,colors:{send:'amber',receive:'mint',line:'line',muted:'muted'},logAmount:raw=>Math.log10(Number(raw))-30,line(){},text(){},empty(){},short:s=>s,visualItem:(key,x,y,color,paint)=>paint(),mark:(block,x,y,radius)=>{hits.push({block});radii.push(radius)},dot(){}});
 vm.runInContext(drawSource,context);
 context.draw({blocks,transfers,byHash:new Map(blocks.map(b=>[b.hash,b]))},width,640);
 return {hashes:hits.map(h=>h.block.hash),radii};
}
function block(index,account='account-'+index,raw='1000000000000000000000000000000'){return {hash:'BLOCK_'+index,account,at:index*1000,raw,subtype:'receive',source:'HISTORICAL_SEND_'+index}}
test('the account lanes prioritize the most recently active accounts',()=>{
 const blocks=Array.from({length:13},(_,i)=>block(i));
 const visible=renderEventsky(blocks).hashes;
 expect(visible).toContain('BLOCK_12');
 expect(visible).not.toContain('BLOCK_0');
});
test('mobile view keeps the newest activity in its visible lanes',()=>{
 const blocks=Array.from({length:12},(_,i)=>block(i));
 const visible=renderEventsky(blocks,{width:390}).hashes;
 expect(visible).toContain('BLOCK_11');
 expect(visible).not.toContain('BLOCK_0');
});
test('amount changes event mark size',()=>{
 const blocks=[block(0,'small','1000000000000000000000000000000'),block(1,'large','100000000000000000000000000000000')];
 const visible=renderEventsky(blocks);
 expect(visible.radii[1]).toBeGreaterThan(visible.radii[0]);
});
test('lanes respect the selected replay window',()=>{
 const blocks=[block(0,'old'),block(55,'recent')];
 const visible=renderEventsky(blocks,{time:60000,windowMs:10000}).hashes;
 expect(visible).toContain('BLOCK_55');expect(visible).not.toContain('BLOCK_0');
});
