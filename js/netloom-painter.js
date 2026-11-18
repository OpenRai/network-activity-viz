'use strict';
// Identical painter used on the main thread and in the render worker.
function createNetloomPainter(canvas) {
 const PLANE_W=1600,PLANE_H=1000,boardContext=canvas.getContext('2d');
 if(!boardContext)throw new Error('2D rendering unavailable');
 let grid,glow,glowContext,density=0;
 const makeCanvas=(w,h)=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c};
function paintGrid(c){
 c.fillStyle='#020b20';c.fillRect(0,0,PLANE_W,PLANE_H);c.lineWidth=.6;
 for(let row=0;row<44;row++){const y=30+row*22;c.strokeStyle=row%5?'#08233b':'#104059';c.beginPath();c.moveTo(0,y);c.lineTo(PLANE_W,y);c.stroke()}
 for(let col=0;col<64;col++){const x=col*26;c.strokeStyle=col%8?'#071a32':'#123149';c.beginPath();c.moveTo(x,0);c.lineTo(x,PLANE_H);c.stroke()}
}
const fd=ms=>ms>=6e4?Math.round(ms/6e3)/10+' min':Math.round(ms/1e3)+' s';
const fmt=x=>x<1e-12?String(+(x*1e30).toPrecision(3))+' raw':'Ӿ'+(x>=.001&&x<1e6?String(+x.toPrecision(4)):x.toExponential(2));

 function resize(dpr){
  if(density===dpr)return;density=dpr;canvas.width=Math.round(PLANE_W*dpr);canvas.height=Math.round(PLANE_H*dpr);
  boardContext.setTransform(dpr,0,0,dpr,0,0);
  grid=makeCanvas(canvas.width,canvas.height);const gc=grid.getContext('2d');gc.setTransform(dpr,0,0,dpr,0,0);paintGrid(gc);
  if(!glow){glow=makeCanvas(400,250);glowContext=glow.getContext('2d');glowContext.scale(.25,.25)}
 }
 function paint(scene,frame){
  const started=performance.now(),metrics={};
  const mode=frame.mode||'sqrt';
  const {now,windowMs:Te,viewport:[w,h],matrix:viewMatrix,options:{smoothScene,cullScene,useGridCache},reducedMotion:RM}=frame;
  resize(frame.dpr);

 const c=boardContext,l=glowContext;c.clearRect(0,0,PLANE_W,PLANE_H);l.clearRect(0,0,PLANE_W,PLANE_H);
 if(useGridCache)c.drawImage(grid,0,0,PLANE_W,PLANE_H);else paintGrid(c);
 const {cells,receives}=scene;
 const visibility=createNetloomVisibility(viewMatrix,w,h);let marksDrawn=0,labelsDrawn=0;
 const labels=[];
 const progress=smoothScene?Math.max(0,Math.min(1,(now-scene.at)/100)):1;
 let maxStep=0;
 for(const cell of cells){
  const previous=cell.m.lastPaintY??cell.fromY;
  cell.age=now-cell.m.at;cell.x=60+(1-cell.age/Te)*1460;
  cell.y=cell.fromY+(cell.targetY-cell.fromY)*progress;
  maxStep=Math.max(maxStep,Math.abs(cell.y-previous));cell.m.lastPaintY=cell.y;
 }
 metrics.bandStepPixels=maxStep;

 c.lineWidth=.8;
 for(const cell of cells){
  const {m,x,y,seed,age}=cell;if(m.subtype!=='send')continue;
  const destination=receives.get(m.hash);
  // Unpaired marks terminate locally; only observed source references join blocks.
  const end=destination||{x:Math.min(1550,x+45+seed%160),y:y+((seed>>>4)%7-3)*22};
  if(cullScene&&!visibility.intersects(Math.min(x,end.x)-2,Math.min(y,end.y)-6,Math.max(x+115,end.x)-Math.min(x,end.x)+4,Math.abs(end.y-y)+12))continue;
  c.strokeStyle=destination?'rgba(255,133,28,.85)':'rgba(230,98,22,.42)';c.beginPath();c.moveTo(x,y);c.lineTo(x+18,y);c.lineTo(x+18,end.y);c.lineTo(end.x,end.y);c.stroke();
  if(seed%4===0){c.strokeStyle='rgba(255,173,37,.42)';c.strokeRect(x+12,y-5,24+seed%75,10);}
 }
 c.font='9px monospace';c.textBaseline='middle';
 for(const {m,style,x,y,seed,width,height,age} of cells){
  const warm=m.subtype==='send',color=warm?(seed%7<2?(seed%3?'#ffb52b':'#ff482e'):(seed%9===0?'#d531b6':'#1687c6')):'#04d6ed';
  const intensity=Math.max(.1,1-age/Te);
  const fade=mode==='linear'?intensity:mode==='log'?Math.log1p(intensity*9)/Math.log(10):Math.sqrt(intensity);
  const visible=!cullScene||visibility.intersects(x-5,y-height/2-5,width+10,height+10);
  if(visible){marksDrawn++;
  c.globalAlpha=fade;c.fillStyle=color;if(warm&&seed%11===0){c.beginPath();c.arc(x+width/2,y,height*.8,0,Math.PI*2);c.fill()}else c.fillRect(x,y-height/2,width,height);
  if(seed%5===0){c.fillStyle='#b3f7ff';c.fillRect(x+2,y-height/2,Math.max(3,width*.4),1)}
  l.globalAlpha=fade*(warm?.8:.45);l.fillStyle=color;l.fillRect(x-2,y-height/2-2,width+4,height+4);
  if(!RM&&age<900){const pulse=1-age/900;l.globalAlpha=pulse;l.fillStyle='#d6fbff';l.fillRect(x-5,y-height/2-5,width+10,height+10)}
  }
  labels.push({style,x,y,seed,fade,warm});
 }
 for(const {style,x,y,seed,fade,warm} of (cullScene?labels.reverse():labels)){
  c.globalAlpha=fade*.55;c.fillStyle=warm?'#ffc76b':'#2580a2';
  if(seed%2===0&&(!cullScene||visibility.label(x-110,y-5,style.caption.length*5.4,9))){c.fillText(style.caption,x-110,y+2);labelsDrawn++}
  c.fillStyle='#174965';
  if(seed%3===0&&(!cullScene||visibility.label(x-110,y+4,style.accountLabel.length*5.4,9))){c.fillText(style.accountLabel,x-110,y+11);labelsDrawn++}
 }
 metrics.marksDrawn=marksDrawn;metrics.labelsDrawn=labelsDrawn;
 c.globalAlpha=l.globalAlpha=1;
 c.font='11px monospace';c.fillStyle='#408099';
 for(let i=0;i<=6;i++){c.fillText(i===6?'NOW':'−'+fd(Te*(1-i/6)),60+i*240,970)}
 for(let i=0;i<=8;i++){c.fillText(fmt(10**(scene.previousTicks[i]+(scene.ticks[i]-scene.previousTicks[i])*progress)),8,50+i*108)}
 // Bake bloom at quarter resolution; the display loop only composites one texture.
 c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.5;c.drawImage(glow,0,0,PLANE_W,PLANE_H);c.restore();


  metrics.duration=performance.now()-started;return metrics;
 }
 return {resize,paint};
}
