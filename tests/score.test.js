import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../score.html',import.meta.url),'utf8');
const drawSource=html.slice(html.indexOf('function draw(m,w,h){')).split('</script>')[0];
function renderScore(blocks,{width=1000,density=false,time=20000}={}){
 const hits=[];
 const state={time,accountOrder:new Map(blocks.map(b=>[b.account,0]))};
 const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
 const context=vm.createContext({state,ctx,hits,colors:{},$:()=>({value:density?'density':'blocks'}),line(){},text(){},empty(){},short:s=>s,visualItem:(key,x,y,color,paint)=>paint(),mark:block=>hits.push({block})});
 vm.runInContext(drawSource,context);
 context.draw({recent:blocks,byHash:new Map(blocks.map(b=>[b.hash,b]))},width,480);
 return hits.map(h=>h.block.hash);
}
function block(index,account='account-'+index){return {hash:'BLOCK_'+index,account,at:index*1000,subtype:'receive',source:'HISTORICAL_SEND_'+index}}
test('a thirteenth account remains visible after the first twelve lanes fill',()=>{
 const blocks=Array.from({length:13},(_,i)=>block(i));
 expect(renderScore(blocks)).toContain('BLOCK_12');
 expect(renderScore(blocks)).not.toContain('BLOCK_0');
});
test('mobile follows new activity after six lanes fill',()=>{
 const blocks=Array.from({length:7},(_,i)=>block(i));
 expect(renderScore(blocks,{width:390})).toContain('BLOCK_6');
});
test('density mode also includes the newest account',()=>{
 const blocks=Array.from({length:20},(_,i)=>block(i));
 expect(renderScore(blocks,{density:true})).toContain('BLOCK_19');
});
test('new activity on an old account brings it back into the displayed set',()=>{
 const blocks=Array.from({length:20},(_,i)=>block(i));blocks.push(block(20,'account-0'));
 const visible=renderScore(blocks,{time:21000});
 expect(visible).toContain('BLOCK_20');expect(visible).toContain('BLOCK_19');
});
