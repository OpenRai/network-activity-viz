import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup(search="?offscreen=1"){
 const workers=[],replacements=[],results=[];
 const canvas=()=>({width:0,height:0,transferControlToOffscreen(){this.transferred=true;return{}},cloneNode(){return canvas()},replaceWith(next){this.replacement=next}});
 class Worker{constructor(){this.messages=[];workers.push(this)}postMessage(x){this.messages.push(x)}terminate(){this.terminated=true}emit(x){this.onmessage?.({data:x})}}
 const c=vm.createContext({URL,URLSearchParams,Worker,document:{currentScript:{src:'http://localhost/js/netloom-renderer.js'}},location:{protocol:'http:',search},devicePixelRatio:1,setTimeout,clearTimeout,performance,createNetloomPainter:()=>({resize(){},paint(){return {duration:1,marksDrawn:1,labelsDrawn:1,bandStepPixels:0}}})});
 vm.runInContext(readFileSync(new URL('../js/netloom-renderer.js',import.meta.url),'utf8'),c);
 return {renderer:c.createNetloomRenderer(canvas(),{replace:x=>replacements.push(x),metrics:x=>results.push(x)}),workers,replacements,results};
}
const frame=(now,scene={cells:[]})=>({now,scene,windowMs:60000,viewport:[400,300],matrix:[1,0,0,1,0,0],dpr:1,options:{}});
test('render worker has one in-flight frame and coalesces queued frames',()=>{
 const {renderer,workers}=setup(),w=workers[0];renderer.paint(frame(1));w.emit({type:'ready'});
 renderer.paint(frame(2));renderer.paint(frame(3));expect(renderer.diagnostics().queued).toBe(1);expect(w.messages).toHaveLength(2);
 w.emit({type:'painted',metrics:{duration:1}});expect(w.messages).toHaveLength(3);expect(w.messages[2].frame.now).toBe(3);renderer.dispose();expect(w.terminated).toBe(true);
});
test('worker failure replaces the transferred canvas and resumes main-thread drawing',()=>{
 const {renderer,workers,replacements,results}=setup(),w=workers[0];renderer.paint(frame(1));w.emit({type:'ready'});const late=w.onmessage;w.onerror({message:'unsupported'});
 expect(replacements).toHaveLength(1);expect(renderer.diagnostics().mode).toBe('main');expect(results.at(-1).thread).toBe('main');
 late({data:{type:'ready'}});renderer.paint(frame(2));expect(results.at(-1).thread).toBe('main');renderer.dispose();
});
test('page restore recreates the renderer with a fresh transferable canvas',()=>{
 const {renderer,workers,replacements}=setup();renderer.dispose();renderer.resume();expect(workers).toHaveLength(2);expect(replacements).toHaveLength(1);expect(renderer.diagnostics().stopped).toBe(false);renderer.dispose();
});

test('main-thread painting stays the default after worker frame-delivery regression',()=>{
 const {renderer,workers,results}=setup('');renderer.paint(frame(1));expect(workers).toHaveLength(0);expect(results.at(-1).thread).toBe('main');renderer.dispose();
});

test('painter restores canvas scaling after the backing context resets', () => {
 const clearScales = [];
 class Canvas {
  context = {
   scaleX: 1,
   setTransform(x) { this.scaleX = x; },
   clearRect() { clearScales.push(this.scaleX); },
   fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
   drawImage() {}, fillText() {}, save() {}, restore() {},
  };
  getContext() { return this.context; }
 }
 const context = vm.createContext({OffscreenCanvas: Canvas, performance, createNetloomVisibility: () => ({})});
 vm.runInContext(readFileSync(new URL('../js/netloom-painter.js', import.meta.url), 'utf8'), context);
 const canvas = new Canvas();
 const painter = context.createNetloomPainter(canvas);
 const scene = {cells: [], ticks: Array(9).fill(0), previousTicks: Array(9).fill(0)};
 const view = {...frame(1, scene), dpr: 2, options: {useGridCache: true}};
 painter.paint(scene, view);
 canvas.context.setTransform(1, 0, 0, 1, 0, 0);
 painter.paint(scene, view);
 expect(clearScales).toEqual([2, .25, 2, .25]);
});
