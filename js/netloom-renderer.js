'use strict';
const netloomRenderWorkerURL=new URL('netloom-render-worker.js?v=hdr-4',document.currentScript.src);
function createNetloomRenderer(initialCanvas,{replace,metrics}) {
 let canvas=initialCanvas,worker=null,painter=null,transferred=false,stopped=false,ready=false,busy=false,latest=null,lastFrame=null,sentScene=null,timeout=null;
 let dpr=Math.min(devicePixelRatio||1,2);
 const useWorker=typeof Worker!=='undefined'&&typeof canvas.transferControlToOffscreen==='function'&&location.protocol!=='file:'
  // Worker rendering remains opt-in: Chromium profiling showed frame throttling.
  && new URLSearchParams(location.search).get('offscreen')==='1';
 function resetCanvas(){if(transferred){const next=canvas.cloneNode(false);canvas.replaceWith(next);canvas=next;transferred=false;replace(next)}}
 function mainFrame(frame){const result=painter.paint(frame.scene,frame);metrics({...result,thread:'main'})}
 function fallback(error){
  clearTimeout(timeout);if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate()}worker=null;ready=false;busy=false;sentScene=null;
  resetCanvas();painter=createNetloomPainter(canvas);painter.resize(dpr);
  if(error)globalThis.netloomPerf?.event('renderWorkerError',{message:String(error)});
  latest=null;if(lastFrame)mainFrame(lastFrame);
 }
 function send(){
  if(!worker||!ready||busy||!latest||stopped)return;
  const frame=latest;latest=null;busy=true;const {scene,...payload}=frame;
  const message={type:'paint',frame:payload};if(scene!==sentScene){message.scene=scene;sentScene=scene}
  const requested=performance.now(),target=worker;
  target.requested=requested;
  clearTimeout(timeout);timeout=setTimeout(()=>fallback(new Error('Render worker timed out')),2000);
  try{target.postMessage(message)}catch(error){fallback(error)}
 }
 function init(){
  if(!useWorker){fallback();return}
  try{
   canvas.width=Math.round(1600*dpr);canvas.height=Math.round(1000*dpr);
   const target=new Worker(netloomRenderWorkerURL);worker=target;
   const plane=canvas.transferControlToOffscreen();transferred=true;
   target.onmessage=({data})=>{
    if(worker!==target||stopped)return;
    clearTimeout(timeout);
    if(data.type==='error'){fallback(new Error(data.error));return}
    if(data.type==='ready')ready=true;
    else if(data.type==='painted'){busy=false;metrics({...data.metrics,thread:'worker',latency:performance.now()-target.requested})}
    send();
   };
   target.onerror=event=>{if(worker===target)fallback(new Error(event.message||'Render worker failed'))};
   timeout=setTimeout(()=>fallback(new Error('Render initialization timed out')),2000);
   target.postMessage({type:'init',canvas:plane,dpr},[plane]);
  }catch(error){fallback(error)}
 }
 init();
 return {
  resize(value){dpr=value;painter?.resize(dpr)},
  paint(frame){lastFrame=frame;if(stopped)return;if(painter){mainFrame(frame);return}if(latest)globalThis.netloomPerf?.event('renderFrameCoalesced');latest=frame;send()},
  dispose(){stopped=true;clearTimeout(timeout);if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate()}worker=null;latest=null;ready=false;busy=false;sentScene=null},
  resume(){if(!stopped)return;stopped=false;resetCanvas();painter=null;init();if(lastFrame)this.paint(lastFrame)},
  diagnostics(){return {mode:worker?'worker':'main',stopped,busy,queued:latest?1:0}},
 };
}
