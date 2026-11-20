'use strict';
importScripts('netloom-visibility.js','netloom-painter.js?v=canvas-scale-1');
let painter,scene;
self.onmessage=({data})=>{
 try {
  if(data.type==='init'){painter=createNetloomPainter(data.canvas);painter.resize(data.dpr);self.postMessage({type:'ready'});return}
  if(data.scene){
   const previous=new Map((scene?.cells||[]).map(cell=>[cell.m.hash,cell.m.lastPaintY]));scene=data.scene;
   for(const cell of scene.cells)if(previous.has(cell.m.hash))cell.m.lastPaintY=previous.get(cell.m.hash);
  }
  const metrics=painter.paint(scene,data.frame);self.postMessage({type:'painted',metrics});
 }catch(error){self.postMessage({type:'error',error:String(error)})}
};
