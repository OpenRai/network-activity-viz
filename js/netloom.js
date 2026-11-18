(()=>{
const $=id=>document.getElementById(id);
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
let cv=$('c');const ov=$('o'),ox=ov.getContext('2d');
const renderer=createNetloomRenderer(cv,{replace:canvas=>{cv=canvas},metrics:metrics=>{if(!globalThis.netloomPerf)return;for(const key of ['bandStepPixels','marksDrawn','labelsDrawn'])netloomPerf.record(key,metrics[key]);netloomPerf.record('canvasBuild',metrics.duration);netloomPerf.record(metrics.thread==='worker'?'workerPaint':'mainPaint',metrics.duration);if(metrics.latency!==undefined)netloomPerf.record('renderLatency',metrics.latency);netloomPerf.event('canvasPaint')}});
let T=gallerySettings.memoryMs,Te=6e4,t0=Date.now(),cnt={},lastMsg=0,mode='sqrt',ev=[],markers=[],feedClient=null,last=null,dpr=1,tx=0,simulation=null;
const soundFX=createSoundFX({profile:'cyber',onStatus:message=>{$('audioState').textContent=message}}),soundSet=$('soundSet');
globalThis.netloomSoundFX=soundFX;
const soundVolume=$('soundVolume'),soundVolumeValue=$('soundVolumeValue');
try{const saved=localStorage.getItem('netloom-sound-volume');if(saved!==null&&Number.isFinite(Number(saved)))soundVolume.value=saved}catch{}
soundFX.setVolumeMultiplier(Number(soundVolume.value)/100);soundVolumeValue.textContent=soundVolume.value+'%';
soundVolume.oninput=()=>{soundVolumeValue.textContent=soundVolume.value+'%';soundFX.setVolumeMultiplier(Number(soundVolume.value)/100);try{localStorage.setItem('netloom-sound-volume',soundVolume.value)}catch{}};
try{const saved=localStorage.getItem('netloom-sound-set');if([...soundSet.options].some(o=>o.value===saved))soundSet.value=saved}catch{}
soundFX.setSoundSet(soundSet.value);
soundSet.onchange=()=>{soundFX.setSoundSet(soundSet.value);try{localStorage.setItem('netloom-sound-set',soundSet.value)}catch{}if($('snd').checked)soundFX.enable().then(()=>soundFX.play({frequency:440,volume:.12})).catch(()=>{})};
bindHudSound(soundFX);
let lastB=0,boardWindow=60000,rangeLow=null,rangeHigh=null,bandWeights=new Map(),drift=0,vignette,w,h,camera={x:0,y:0,s:1},cameraControls;
const PLANE_W=1600,PLANE_H=1000;
const smoothScene=!RM&&!(globalThis.netloomPerf&&new URLSearchParams(location.search).get('smoothScene')==='0');
let lastCameraTime=performance.now();
const timeCamera=!(globalThis.netloomPerf&&new URLSearchParams(location.search).get('cameraTime')==='0');
let framing, spectrum;
let scene=null,lastLayoutAt=0,viewMatrix=[1,0,0,1,0,0];
const cullScene=!(globalThis.netloomPerf&&new URLSearchParams(location.search).get('cullScene')==='0');
const useLabelCache=!(globalThis.netloomPerf&&new URLSearchParams(location.search).get('labelCache')==='0');
function markerStyle(m){
 const seed=hashCode(m.hash||String(m.at));
 return {seed,caption:m.hash.slice(-12).toUpperCase()+' '+fmt(10**m.la),accountLabel:m.account.slice(-18)};
}
const useGridCache=!(globalThis.netloomPerf&&new URLSearchParams(location.search).get('gridCache')==='0');
function size(){
 const oldW=w||innerWidth,oldH=h||innerHeight;dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
 framing=netloomDefaultFraming(w,h);
 if(cameraControls){camera.x+=(w-oldW)/2;camera.y+=(h-oldH)/2}else{camera={x:w/2,y:h/2,s:1};cameraControls=createMapControls(ov,camera,()=>({width:w,height:h,cx:w/2,cy:h/2}))}
 renderer.resize(dpr);
 Object.assign(cv.style,{width:PLANE_W+'px',height:PLANE_H+'px',inset:'0 auto auto 0',transformOrigin:'0 0',willChange:'transform',imageRendering:'auto'});
 ov.width=Math.round(w*dpr);ov.height=Math.round(h*dpr);
 ox.setTransform(dpr,0,0,dpr,0,0);
 vignette=ox.createRadialGradient(w*.56,h*.48,Math.min(w,h)*.12,w*.55,h*.5,Math.max(w,h)*.58);
 vignette.addColorStop(0,'rgba(0,2,14,0)');vignette.addColorStop(.6,'rgba(0,2,14,.18)');vignette.addColorStop(1,'rgba(0,2,14,.98)');
 const right=w-24,width=Math.min(220,Math.max(1,w-48));
 const gradient=ox.createLinearGradient(right-width,0,right,0);
 gradient.addColorStop(0,'#063356');gradient.addColorStop(.45,'#00c9f1');
 gradient.addColorStop(.75,'#ffae26');gradient.addColorStop(1,'#ff422b');
 spectrum={right,width,gradient};
 lastB=0;overlay(Date.now());
}
function hashCode(value){let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;return hash}
function prepareScene(now){
 const visible=markers.filter(m=>now-m.at<=Te).slice(-1400);
 const amounts=visible.map(m=>m.la).sort((a,b)=>a-b);
 const targetLow=amounts.length?Math.floor(amounts[Math.floor(amounts.length*.03)])-1:-5;
 const targetHigh=amounts.length?Math.max(targetLow+5,Math.ceil(amounts[Math.floor(amounts.length*.97)])+1):5;
 const blend=1-Math.exp(-Math.min(100,now-lastLayoutAt)/800);
 rangeLow=rangeLow===null?targetLow:rangeLow+(targetLow-rangeLow)*blend;
 rangeHigh=rangeHigh===null?targetHigh:rangeHigh+(targetHigh-rangeHigh)*blend;
 const low=rangeLow,high=rangeHigh;
 const bandSize=.25,bandCounts=new Map();for(const amount of amounts){const band=Math.floor(amount/bandSize);bandCounts.set(band,(bandCounts.get(band)||0)+1)}
 const maxBandCount=Math.max(1,...bandCounts.values()),firstBand=Math.floor(low/bandSize),lastBand=Math.ceil(high/bandSize),bands=[];
 for(let band=firstBand;band<lastBand;band++){
  const from=Math.max(low,band*bandSize),to=Math.min(high,(band+1)*bandSize),target=1+2*Math.sqrt((bandCounts.get(band)||0)/maxBandCount),previous=bandWeights.get(band)??1,weight=previous+(target-previous)*blend;
  bandWeights.set(band,weight);if(to>from)bands.push({from,to,weight});
 }
 for(const band of [...bandWeights.keys()])if(band<firstBand-2||band>lastBand+2)bandWeights.delete(band);
 const bandSpace=bands.reduce((sum,band)=>sum+(band.to-band.from)/bandSize*band.weight,0);
 const amountY=value=>{let position=0;value=Math.max(low,Math.min(high,value));for(const band of bands){if(value>=band.to){position+=(band.to-band.from)/bandSize*band.weight;continue}if(value>band.from)position+=(value-band.from)/bandSize*band.weight;break}return 50+position/bandSpace*870};
 const amountAtY=ratio=>{let distance=Math.max(0,Math.min(1,ratio))*bandSpace;for(const band of bands){const segment=(band.to-band.from)/bandSize*band.weight;if(distance<=segment)return band.from+distance/ band.weight*bandSize;distance-=segment}return high};
 const cells=[];
 for(const m of visible){
  const style=useLabelCache?(m.style??=markerStyle(m)):markerStyle(m),seed=style.seed,age=now-m.at;
  const x=60+(1-age/Te)*1460,y=amountY(m.la);
  const fromY=m.layoutY??y;m.layoutY=y;
  const cell={m,seed,style,x,y,fromY,targetY:y,width:9+seed%29,height:7+(seed>>>8)%9,age};cells.push(cell);
 }
 const receives=new Map(cells.filter(cell=>cell.m.subtype!=='send'&&cell.m.source).map(cell=>[cell.m.source,cell]));
 const ticks=Array.from({length:9},(_,i)=>amountAtY(i/8));
 scene={cells,receives,ticks,previousTicks:scene?.ticks??ticks,at:now};
 lastLayoutAt=now;
}
function build(now){
 renderer.paint({scene,now,mode,windowMs:Te,viewport:[w,h],matrix:viewMatrix,dpr,reducedMotion:RM,options:{smoothScene,cullScene,useGridCache}});
}

const fd=ms=>ms>=6e4?Math.round(ms/6e3)/10+' min':Math.round(ms/1e3)+' s';
const fmt=x=>x<1e-12?String(+(x*1e30).toPrecision(3))+' raw':'Ӿ'+(x>=.001&&x<1e6?String(+x.toPrecision(4)):x.toExponential(2));
function render(){
 const pn=performance.now(),ease=RM?1:timeCamera?netloomCameraEase(pn-lastCameraTime):.12;lastCameraTime=pn;
 const {scale,focusY,anchorX,anchorY}=framing;
 drift+=((RM||cameraControls.isGesture()?0:tx*12)-drift)*ease;
 // Animate the cached plane on the compositor, without repainting the viewport.
 const elapsed=Math.max(0,Math.min(Te,Date.now()-lastB)),ratio=boardWindow/Te;
 const a=scale*.91,b=-scale*.27,c=scale*.48,d=scale*.59;
 const focusX=1520+elapsed/Te*1460;
 if(cameraControls.springing()){
  camera.x+=(w/2-camera.x)*ease;camera.y+=(h/2-camera.y)*ease;camera.s+=(1-camera.s)*ease;
  if(Math.abs(camera.x-w/2)<.05&&Math.abs(camera.y-h/2)<.05&&Math.abs(camera.s-1)<.0005){camera.x=w/2;camera.y=h/2;camera.s=1;cameraControls.setDefaultScale(1)}
 }
 const translateX=anchorX+drift-a*ratio*focusX-c*focusY,translateY=anchorY-b*ratio*focusX-d*focusY;
 viewMatrix=[a*ratio*camera.s,b*ratio*camera.s,c*camera.s,d*camera.s,w/2+(translateX-camera.x)*camera.s,h/2+(translateY-camera.y)*camera.s];
 cv.style.transform=`matrix(${a*ratio*camera.s},${b*ratio*camera.s},${c*camera.s},${d*camera.s},${w/2+(translateX-camera.x)*camera.s},${h/2+(translateY-camera.y)*camera.s})`;
}
function overlay(now){
 ox.clearRect(0,0,w,h);ox.fillStyle=vignette;ox.fillRect(0,0,w,h);ox.font='10px monospace';ox.fillStyle='#598195';ox.textAlign='right';
 const {right,width,gradient}=spectrum;
 ox.fillText(new Date(now).toISOString().replace(/\.\d{3}Z$/,'Z'),right,h-128);
 ox.fillText('CONFIRMED BLOCKS / AMOUNT × OBSERVER TIME',right,h-111,w-48);
 ox.fillStyle=gradient;ox.fillRect(right-width,h-104,width,4);
 ox.fillStyle='#285568';ox.fillText('LINKED TRACES / OBSERVED SOURCE',right,h-87,w-48);
 if(!markers.length){ox.fillStyle='#71bbd1';ox.textAlign='center';ox.fillText('WAITING FOR CONFIRMED BLOCKS',w*.58,h*.48)}
}

const dupS=new Set(),dupQ=[],sentHashes=new Set(),sentQueue=[];
function add(raw,hash,t,subtype='send',account='',silent=false,peakAt=Date.now(),source=''){
const x=Number(raw);if(!(x>0))return;const at=t||Date.now(),la=Math.log10(x)-30;
if(subtype==='send')ev.push(at,la);
markers.push({at,la,subtype,hash:String(hash||''),account,source,peakAt});last={x:x/1e30,hash:String(hash||'')};
if(markers.length>3000)markers.splice(0,1000);
if(!silent){const amountPitch=Math.max(0,Math.min(1,(la+8)/13));const pitchPosition=soundSet.value==='neonPulse'?1-amountPitch:amountPitch;soundFX.play({frequency:196*2**(pitchPosition*3),volume:.095,account,lfoDepth:.24,amount:x/1e30,subtype,at,hash});}
}
function status(t,c){$('stt').textContent=t;$('dot').className=c||''}
function stop(){simulation=null;if(feedClient){feedClient.stop();feedClient=null}}
function resetStream(){ev=[];markers=[];cnt={};lastMsg=0;last=null;t0=Date.now();rangeLow=rangeHigh=null;lastB=0;scene=null;lastLayoutAt=0;bandWeights.clear();dupS.clear();dupQ.length=0;sentHashes.clear();sentQueue.length=0}
function restoreCache(){
for(const event of globalThis.nanoEventCache?.restore()||[]){const item=event.message,block=parseNanoBlock(item.block)||{},sub=block.subtype||'other';if(!['send','receive','open'].includes(sub))continue;
const at=event.lastSeenAt,hash=event.hash;t0=Math.min(t0,at);dupS.add(hash);dupQ.push(hash);
add(item.amount,hash,at,sub,item.account,true,at,(block.link||'').toUpperCase());if(sub==='send'){sentHashes.add(hash);sentQueue.push(hash)}}
}
function handleConfirmation(packet,at=Date.now(),replay=false){
if(packet.topic!=='confirmation'||!packet.message)return;
const c=packet.message,hash=typeof c.hash==='string'?c.hash.toUpperCase():'';if(hash){if(!replay&&!simulation)globalThis.nanoEventCache?.record(packet,at);if(dupS.has(hash))return;dupS.add(hash);dupQ.push(hash);if(dupQ.length>5000)dupS.delete(dupQ.shift())}
const b=parseNanoBlock(c.block)||{},sub=b.subtype||'other';lastMsg=at;cnt[sub]=(cnt[sub]||0)+1;
if(sub==='send'&&hash){sentHashes.add(hash);sentQueue.push(hash);if(sentQueue.length>5000)sentHashes.delete(sentQueue.shift())}
if(!['send','receive','open'].includes(sub))return;
const account=c.account||b.account||'',source=typeof b.link==='string'?b.link.toUpperCase():'';add(c.amount,hash,at,sub,account,replay,replay?at:Date.now(),source);
}
function startSimulation(stress){stop();resetStream();const data=stress?createStressDemo():createStressDemo({transfers:240,duration:120000});
simulation={...data,index:0,start:performance.now(),scale:stress?30:1};status(stress?'STRESS TEST · fictional transfers':'SIMULATED DATA','sim')}
function advanceSimulation(now){if(!simulation)return;const elapsed=(now-simulation.start)*simulation.scale;
while(simulation.index<simulation.events.length&&simulation.events[simulation.index].at<=elapsed){const item=simulation.events[simulation.index++];handleConfirmation({topic:'confirmation',message:item.message},Date.now()-(elapsed-item.at)/simulation.scale)}}
function connect(){
stop();resetStream();restoreCache();const selected=$('feed').value;if(selected==='demo'||selected==='stress'){resetStream();startSimulation(selected==='stress');return}
let endpoint;try{endpoint=new URL(selected);if(!['ws:','wss:'].includes(endpoint.protocol))throw new Error('protocol')}catch{status('Choose a valid Nano node.');return}
status('Connecting to '+endpoint.host+'…');
feedClient=createNanoFeed(endpoint.href,{
onPacket:packet=>handleConfirmation(packet),
onStatus:text=>status(text,text.startsWith('Connecting')||text.includes('reconnecting')?'':'on'),
onGap:()=>{}
});
}
function hud(now){
const cut=now-T;let i=0;while(i<ev.length&&ev[i]<cut)i+=2;if(i){ev=ev.slice(i);}
let first=0;while(first<markers.length&&markers[first].at<cut)first++;if(first)markers=markers.slice(first);
let n=0,m1=0;
for(let j=ev.length-2;j>=0;j-=2){const t=ev[j];if(t<now-Te)break;n++;if(t>now-6e4)m1++}
const bd=Object.entries(cnt).map(([k,v])=>v+' '+k).join(', ');
$('stats').textContent=`${n} sends in view, ${m1} in the last minute\nShowing ${fd(Te)} of the ${fd(T)} window`+(Te<T?', filling as data arrives':'')+
`\nStream: ${lastMsg?Math.round((now-lastMsg)/1e3)+' s since the last message':'no messages yet'}`+(bd?`\nConfirmations seen: ${bd}`:'')+

`\nTiles: confirmed blocks · traces: source references`+
(last?`\nLatest: ${fmt(last.x)} ${last.hash.slice(0,8)}`:'');
}

gallerySettings.onNodeChange(connect);
gallerySettings.onMemoryChange(()=>{T=gallerySettings.memoryMs;});
addEventListener('pointermove',e=>{if(!cameraControls.isGesture())tx=e.clientX/innerWidth-.5});
addEventListener('resize',size);
addEventListener('pagehide',()=>renderer.dispose());addEventListener('pageshow',()=>renderer.resume());
setInterval(()=>{hud(Date.now());overlay(Date.now())},500);
if(globalThis.netloomPerf)netloomPerf.attach({state:()=>({markers:markers.length,canvas:[cv.width,cv.height],camera:{...camera},renderer:renderer.diagnostics(),audio:soundFX.diagnostics?.()}),start:({rate=5,seconds=30,audio=true,draw=true,history=0}={})=>{stop();resetStream();if(history){const historical=createStressDemo({seed:20261104,transfers:Math.ceil(history),duration:600000});for(const item of historical.events.slice(0,history)){item.message.hash='F'+item.message.hash.slice(1);if(item.message.block.subtype==='receive')item.message.block.link='F'+item.message.block.link.slice(1);handleConfirmation({topic:'confirmation',message:item.message},Date.now()-600000+item.at,true)}}const data=createStressDemo({seed:20261105,transfers:Math.ceil(rate*seconds),duration:seconds*1000+8000});simulation={...data,index:0,start:performance.now(),scale:1};globalThis.netloomPerfDraw=draw;if(audio)soundFX.enable();else soundFX.disable();}});
size();connect();
(function loop(){const now=Date.now();
advanceSimulation(performance.now());
Te=Math.min(T,Math.max(3000,now-(markers[0]?.at||t0)));
if(!scene||now-lastLayoutAt>=100){if(globalThis.netloomPerf)netloomPerf.measure('layout',()=>prepareScene(now));else prepareScene(now)}
const paintDue=now-lastB>=(smoothScene?1000/30-1:100);
if(paintDue){lastB=now;boardWindow=Te}
if(globalThis.netloomPerf)netloomPerf.measure("camera",render);else render();
if(paintDue){if(globalThis.netloomPerf){if(globalThis.netloomPerfDraw!==false)netloomPerf.measure('paintDispatch',()=>build(now))}else build(now)}
requestAnimationFrame(loop)})();
})();
