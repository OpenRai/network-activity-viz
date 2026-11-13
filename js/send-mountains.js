(()=>{
const $=id=>document.getElementById(id);
const EVENT_CACHE_KEY='nano-send-mountains-events-v1',EVENT_CACHE_TTL=60*60*1000;
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
const cv=$('c'),cx=cv.getContext('2d'),ov=$('o'),ox=ov.getContext('2d');
let T=gallerySettings.memoryMs,Te=6e4,t0=Date.now(),cnt={},lastMsg=0,mode='sqrt',ev=[],markers=[],feedClient=null,last=null,dpr=1,tx=0,simulation=null;
const soundFX=createSoundFX({profile:'alien',onStatus:message=>{$('audioState').textContent=message}}),soundSet=$('soundSet');
try{const saved=localStorage.getItem('ag-mountains-sound-set');if([...soundSet.options].some(o=>o.value===saved))soundSet.value=saved}catch{}
soundFX.setSoundSet(soundSet.value);
soundSet.onchange=()=>{soundFX.setSoundSet(soundSet.value);try{localStorage.setItem('ag-mountains-sound-set',soundSet.value)}catch{}if($('snd').checked)soundFX.enable().then(()=>soundFX.play({frequency:440,volume:.12})).catch(()=>{})};
$('snd').onchange=()=>{if(!$('snd').checked){soundFX.disable();return}soundFX.enable().then(()=>soundFX.play({frequency:440,volume:.12})).catch(()=>{$('audioState').textContent='Audio paused · turn sound off and on to retry.'})};
let lastB=0,boardWindow=60000,rangeLow=null,rangeHigh=null,drift=0,vignette,w,h,board,boardContext,glow,glowContext;
const PLANE_W=1600,PLANE_H=1000;
function size(){
 dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
 cv.width=PLANE_W;cv.height=PLANE_H;
 Object.assign(cv.style,{width:PLANE_W+'px',height:PLANE_H+'px',inset:'0 auto auto 0',transformOrigin:'0 0',willChange:'transform',imageRendering:'auto'});
 ov.width=Math.round(w*dpr);ov.height=Math.round(h*dpr);
 ox.setTransform(dpr,0,0,dpr,0,0);
 board=cv;boardContext=cx;
 if(!glow){glow=document.createElement('canvas');glow.width=400;glow.height=250;glowContext=glow.getContext('2d');glowContext.scale(.25,.25);}
 vignette=ox.createRadialGradient(w*.56,h*.48,Math.min(w,h)*.12,w*.55,h*.5,Math.max(w,h)*.58);
 vignette.addColorStop(0,'rgba(0,2,14,0)');vignette.addColorStop(.6,'rgba(0,2,14,.18)');vignette.addColorStop(1,'rgba(0,2,14,.98)');
 lastB=0;overlay(Date.now());
 const legend=$('lg').getContext('2d'),gradient=legend.createLinearGradient(0,0,256,0);
 for(const [at,color] of [[0,'#063356'],[.45,'#00c9f1'],[.75,'#ffae26'],[1,'#ff422b']])gradient.addColorStop(at,color);
 legend.fillStyle=gradient;legend.fillRect(0,0,256,8);
}
function hashCode(value){let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;return hash}
function build(now){
 const c=boardContext,l=glowContext;c.clearRect(0,0,PLANE_W,PLANE_H);l.clearRect(0,0,PLANE_W,PLANE_H);
 c.fillStyle='#020b20';c.fillRect(0,0,PLANE_W,PLANE_H);
 // The quiet grid is scaffolding; only actual observations supply data marks.
 c.lineWidth=.6;
 for(let row=0;row<44;row++){const y=30+row*22;c.strokeStyle=row%5?'#08233b':'#104059';c.beginPath();c.moveTo(0,y);c.lineTo(PLANE_W,y);c.stroke()}
 for(let col=0;col<64;col++){const x=col*26;c.strokeStyle=col%8?'#071a32':'#123149';c.beginPath();c.moveTo(x,0);c.lineTo(x,PLANE_H);c.stroke()}
 const visible=markers.filter(m=>now-m.at<=Te).slice(-1400);
 const amounts=visible.map(m=>m.la).sort((a,b)=>a-b);
 const targetLow=amounts.length?Math.floor(amounts[Math.floor(amounts.length*.03)])-1:-5;
 const targetHigh=amounts.length?Math.max(targetLow+5,Math.ceil(amounts[Math.floor(amounts.length*.97)])+1):5;
 const blend=1-Math.exp(-Math.min(100,now-lastB)/800);
 rangeLow=rangeLow===null?targetLow:rangeLow+(targetLow-rangeLow)*blend;
 rangeHigh=rangeHigh===null?targetHigh:rangeHigh+(targetHigh-rangeHigh)*blend;
 const low=rangeLow,high=rangeHigh;
 const cells=[];
 for(const m of visible){
  const seed=hashCode(m.hash||String(m.at)),age=now-m.at;
  const x=60+(1-age/Te)*1460,y=50+Math.max(0,Math.min(1,(m.la-low)/(high-low)))*870;
  const cell={m,seed,x,y,width:9+seed%29,height:7+(seed>>>8)%9,age};cells.push(cell);
 }
 const receives=new Map(cells.filter(cell=>cell.m.subtype!=='send'&&cell.m.source).map(cell=>[cell.m.source,cell]));
 c.lineWidth=.8;
 for(const cell of cells){
  const {m,x,y,seed,age}=cell;if(m.subtype!=='send')continue;
  const destination=receives.get(m.hash);
  // Unpaired marks terminate locally; only observed source references join blocks.
  const end=destination||{x:Math.min(1550,x+45+seed%160),y:y+((seed>>>4)%7-3)*22};
  c.strokeStyle=destination?'rgba(255,133,28,.85)':'rgba(230,98,22,.42)';c.beginPath();c.moveTo(x,y);c.lineTo(x+18,y);c.lineTo(x+18,end.y);c.lineTo(end.x,end.y);c.stroke();
  if(seed%4===0){c.strokeStyle='rgba(255,173,37,.42)';c.strokeRect(x+12,y-5,24+seed%75,10);}
 }
 c.font='9px monospace';c.textBaseline='middle';
 for(const {m,x,y,seed,width,height,age} of cells){
  const warm=m.subtype==='send',color=warm?(seed%7<2?(seed%3?'#ffb52b':'#ff482e'):(seed%9===0?'#d531b6':'#1687c6')):'#04d6ed';
  const intensity=Math.max(.1,1-age/Te);
  const fade=mode==='linear'?intensity:mode==='log'?Math.log1p(intensity*9)/Math.log(10):Math.sqrt(intensity);
  c.globalAlpha=fade;c.fillStyle=color;if(warm&&seed%11===0){c.beginPath();c.arc(x+width/2,y,height*.8,0,Math.PI*2);c.fill()}else c.fillRect(x,y-height/2,width,height);
  c.fillStyle=warm?'#ffc76b':'#2580a2';
  const amount=fmt(10**m.la),identifier=m.hash.slice(-12).toUpperCase();
  c.globalAlpha=fade*.55;if(seed%2===0)c.fillText(identifier+' '+amount,x-110,y+2);c.fillStyle='#174965';
  if(seed%3===0)c.fillText(m.account.slice(-18),x-110,y+11);
  if(seed%5===0){c.fillStyle='#b3f7ff';c.fillRect(x+2,y-height/2,Math.max(3,width*.4),1)}
  l.globalAlpha=fade*(warm?.8:.45);l.fillStyle=color;l.fillRect(x-2,y-height/2-2,width+4,height+4);
  if(!RM&&age<900){const pulse=1-age/900;l.globalAlpha=pulse;l.fillStyle='#d6fbff';l.fillRect(x-5,y-height/2-5,width+10,height+10)}
 }
 c.globalAlpha=l.globalAlpha=1;
 c.font='11px monospace';c.fillStyle='#408099';
 for(let i=0;i<=6;i++){c.fillText(i===6?'NOW':'−'+fd(Te*(1-i/6)),60+i*240,970)}
 for(let i=0;i<=8;i++){c.fillText(fmt(10**(low+(high-low)*i/8)),8,50+i*108)}
 // Bake bloom at quarter resolution; the display loop only composites one texture.
 c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.5;c.drawImage(glow,0,0,PLANE_W,PLANE_H);c.restore();
 boardWindow=Te;
}
const fd=ms=>ms>=6e4?Math.round(ms/6e3)/10+' min':Math.round(ms/1e3)+' s';
const fmt=x=>x<1e-12?String(+(x*1e30).toPrecision(3))+' raw':(x>=.001&&x<1e6?String(+x.toPrecision(4)):x.toExponential(2))+' XNO';
function render(){
 const scale=Math.min(w/1450,h/850)*1.05;
 drift+=((RM?0:tx*12)-drift)*.12;
 // Animate the cached plane on the compositor, without repainting the viewport.
 const elapsed=Math.max(0,Date.now()-lastB),ratio=boardWindow/Te;
 const shift=1520*(1-ratio)-elapsed/Te*1460;
 const a=scale*.91,b=-scale*.27,c=scale*.48,d=scale*.59;
 cv.style.transform=`matrix(${a*ratio},${b*ratio},${c},${d},${w*.56+drift-a*800-c*500+a*shift},${h*.49-b*800-d*500+b*shift})`;
}
function overlay(now){
 ox.clearRect(0,0,w,h);ox.fillStyle=vignette;ox.fillRect(0,0,w,h);ox.font='10px monospace';ox.fillStyle='#598195';ox.textAlign='right';
 ox.fillText('CONFIRMED BLOCKS / AMOUNT × OBSERVER TIME',w-30,h-110);
 ox.fillStyle='#285568';ox.fillText('CYAN / RECEIVE     AMBER / SEND     TRACES / OBSERVED SOURCE',w-30,h-92);
 if(!markers.length){ox.fillStyle='#71bbd1';ox.textAlign='center';ox.fillText('WAITING FOR CONFIRMED BLOCKS',w*.58,h*.48)}
}

const dupS=new Set(),dupQ=[],sentHashes=new Set(),sentQueue=[];
function add(raw,hash,t,subtype='send',account='',silent=false,peakAt=Date.now(),source=''){
const x=Number(raw);if(!(x>0))return;const at=t||Date.now(),la=Math.log10(x)-30;
if(subtype==='send')ev.push(at,la);
markers.push({at,la,subtype,hash:String(hash||''),account,source,peakAt});last={x:x/1e30,hash:String(hash||'')};
if(markers.length>3000)markers.splice(0,1000);
if(!silent)soundFX.play({frequency:196*2**(Math.max(0,Math.min(1,(la+8)/13))*3),volume:.095,account,lfoDepth:.24});
}
function status(t,c){$('stt').textContent=t;$('dot').className=c||''}
function stop(){simulation=null;if(feedClient){feedClient.stop();feedClient=null}}
function resetStream(){ev=[];markers=[];cnt={};lastMsg=0;last=null;t0=Date.now();rangeLow=rangeHigh=null;lastB=0;dupS.clear();dupQ.length=0;sentHashes.clear();sentQueue.length=0}
let cachedEvents=[];
function readCache(){try{const value=JSON.parse(localStorage.getItem(EVENT_CACHE_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function restoreCache(){
const cached=readCache();cachedEvents=[];
const now=Date.now();for(const item of cached){if(!item||now-item.at<0||now-item.at>EVENT_CACHE_TTL||!['send','receive','open'].includes(item.subtype))continue;
cachedEvents.push(item);t0=Math.min(t0,item.at);
add(item.amount,item.hash,item.at,item.subtype,item.account,true,item.at,item.source||'');if(item.subtype==='send'&&item.hash){sentHashes.add(item.hash);sentQueue.push(item.hash)}}
}
let cacheTimer=0;
function flushCache(){cacheTimer=0;try{localStorage.setItem(EVENT_CACHE_KEY,JSON.stringify(cachedEvents))}catch{}}
function persistEvent(item){if(simulation)return;
cachedEvents=cachedEvents.filter(e=>Date.now()-e.at<=EVENT_CACHE_TTL);cachedEvents.push(item);if(cachedEvents.length>3000)cachedEvents=cachedEvents.slice(-3000);
if(!cacheTimer)cacheTimer=setTimeout(flushCache,500)}
addEventListener('pagehide',flushCache);
function handleConfirmation(packet,at=Date.now()){
if(packet.topic!=='confirmation'||!packet.message)return;
const c=packet.message;if(c.hash){if(dupS.has(c.hash))return;dupS.add(c.hash);dupQ.push(c.hash);if(dupQ.length>5000)dupS.delete(dupQ.shift())}
const b=parseNanoBlock(c.block)||{},sub=b.subtype||'other';lastMsg=at;cnt[sub]=(cnt[sub]||0)+1;
if(sub==='send'&&c.hash){sentHashes.add(c.hash);sentQueue.push(c.hash);if(sentQueue.length>5000)sentHashes.delete(sentQueue.shift())}
if(!['send','receive','open'].includes(sub))return;
const account=c.account||b.account||'';add(c.amount,c.hash,at,sub,account,false,Date.now(),b.link||'');
persistEvent({at,subtype:sub,amount:c.amount,hash:c.hash,account,source:b.link||''});
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
$('mx').textContent='confirmed block activity'}

$('hm').onchange=e=>{mode=e.target.value;build(Date.now())};
gallerySettings.onNodeChange(connect);
gallerySettings.onMemoryChange(()=>{T=gallerySettings.memoryMs;});
addEventListener('pointermove',e=>{tx=e.clientX/innerWidth-.5});
addEventListener('resize',size);
setInterval(()=>{hud(Date.now());overlay(Date.now())},500);
size();connect();
(function loop(){const now=Date.now();
advanceSimulation(performance.now());
Te=Math.min(T,Math.max(3000,now-(markers[0]?.at||t0)));
if(now-lastB>=100){build(now);lastB=now}
render();requestAnimationFrame(loop)})();
})();
