(()=>{
const $=id=>document.getElementById(id);
const AMIN=-30,AMAX=9,BD=.125,H=312,W=160,LW=60,DW=80,UB=LW/H,VB=DW/W,CAMV=-58,HMAX=26,SA=1.2,K0=.55;
const PEAK_RISE_MS=900;
const EVENT_PULSE_SECONDS=.9;
const EVENT_CACHE_KEY='nano-send-mountains-events-v1',EVENT_CACHE_TTL=60*60*1000;
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
const cv=$('c'),cx=cv.getContext('2d'),ov=$('o'),ox=ov.getContext('2d');
let T=gallerySettings.memoryMs,Te=6e4,t0=Date.now(),Kc=K0,Kt=K0,ctr=LW/2,cnt={},lastMsg=0,mode='sqrt',ev=[],eventRise=[],markers=[],dm=4,feedClient=null,last=null,dpr=1,tx=0,simulation=null;
const soundFX=createSoundFX({profile:'alien'}),soundSet=$('soundSet');
try{const saved=localStorage.getItem('ag-mountains-sound-set');if([...soundSet.options].some(o=>o.value===saved))soundSet.value=saved}catch{}
soundFX.setSoundSet(soundSet.value);
soundSet.onchange=()=>{soundFX.setSoundSet(soundSet.value);try{localStorage.setItem('ag-mountains-sound-set',soundSet.value)}catch{}if($('snd').checked)soundFX.enable().then(()=>soundFX.play({frequency:440,volume:.12})).catch(()=>{})};
async function enableAudio(){if(!$('snd').checked)return;try{await soundFX.enable();$('audioState').textContent=''}catch{$('audioState').textContent='SoundFX is on · click or press a key to enable audio.'}}
$('snd').onchange=()=>{$('snd').checked?soundFX.enable().then(()=>{$('audioState').textContent='';soundFX.play({frequency:440,volume:.12})}).catch(()=>{$('audioState').textContent='SoundFX is on · click or press a key to enable audio.'}):soundFX.disable()};
addEventListener('pointerdown',enableAudio,{once:true});addEventListener('keydown',enableAudio,{once:true});enableAudio();
let w,h,img,buf,ybuf,bg,hor,camU=30,camH=18,camH0=18,lastB=0;
const g=new Float32Array(W*H),tm=new Float32Array(W*H),hd=new Float32Array(W*H),sh=new Float32Array(W*H);
const kern=s=>{const r=Math.ceil(s*3),k=[];let t=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*s*s));k.push(v);t+=v}return k.map(v=>v/t)};
const KA=kern(SA);
const q=x=>x>255?255:x<0?0:x, pk=(r,gg,b)=>(255<<24)|(b<<16)|(gg<<8)|r;
const pr=[],pg=[],pb=[];
(()=>{const S=[[0,8,8,44],[.1,26,22,100],[.28,24,120,170],[.45,47,196,170],[.62,246,199,68],[.8,255,106,60],[1,255,238,244]];
for(let i=0;i<256;i++){const t=i/255;let j=1;while(j<S.length-1&&S[j][0]<t)j++;const a=S[j-1],b=S[j],u=(t-a[0])/(b[0]-a[0]);
pr[i]=a[1]+(b[1]-a[1])*u;pg[i]=a[2]+(b[2]-a[2])*u;pb[i]=a[3]+(b[3]-a[3])*u}
const lc=$('lg').getContext('2d');for(let i=0;i<256;i++){lc.fillStyle=`rgb(${pr[i]|0},${pg[i]|0},${pb[i]|0})`;lc.fillRect(i,0,1,8)}})();

function size(){
dpr=Math.min(devicePixelRatio||1,2);w=480;h=Math.max(220,Math.round(480*innerHeight/innerWidth));
cv.width=w;cv.height=h;img=cx.createImageData(w,h);buf=new Uint32Array(img.data.buffer);ybuf=new Int32Array(w);
ov.width=Math.round(innerWidth*dpr);ov.height=Math.round(innerHeight*dpr);
hor=(h*.36)|0;
bg=new Uint32Array(h);
for(let y=0;y<h;y++){if(y<hor){const t=y/hor,u=t*t;bg[y]=pk((5+65*u)|0,(4+18*u)|0,(24+54*u)|0)}else{const t=Math.min(1,(y-hor)/(h-hor));bg[y]=pk((16-8*t)|0,8,(34-10*t)|0)}}
}

function build(now){
const bm=Te/W,KT=kern(Math.max(Te/40,3e3)/bm);g.fill(0);
for(let i=0;i<ev.length;i+=2){
const age=(now-ev[i])/bm,a=(ev[i+1]-AMIN)/BD;
if(age<0||age>=W-1||a<0||a>=H-1)continue;
const rise=Math.max(0,Math.min(1,(now-eventRise[i/2])/PEAK_RISE_MS)),v=age|0,b=a|0,fv=age-v,fa=a-b,o=v*H+b;
g[o]+=(1-fv)*(1-fa)*rise;g[o+1]+=(1-fv)*fa*rise;g[o+H]+=fv*(1-fa)*rise;g[o+H+1]+=fv*fa*rise}
const ra=KA.length>>1,rt=KT.length>>1;
for(let v=0;v<W;v++)for(let a=0;a<H;a++){let s=0,qq=0;for(let j=-ra;j<=ra;j++){const aa=a+j;if(aa<0||aa>=H)continue;const k=KA[j+ra];s+=g[v*H+aa]*k;qq+=k}tm[v*H+a]=s/qq}
let mx=0;const sc=6e4/bm/BD;
for(let v=0;v<W;v++)for(let a=0;a<H;a++){let s=0,qq=0;for(let j=-rt;j<=rt;j++){const vv=v+j;if(vv<0||vv>=W)continue;const k=KT[j+rt];s+=tm[vv*H+a]*k;qq+=k}const d=s/qq*sc;g[v*H+a]=d;if(d>mx)mx=d}
dm=Math.max(4,mx>dm?mx:dm+(mx-dm)*.15);
for(let i=0;i<W*H;i++){const x=Math.min(g[i]/dm,1);hd[i]=mode==='sqrt'?Math.sqrt(x):mode==='log'?Math.log1p(x*60)/Math.log1p(60):x}
for(let v=0;v<W;v++)for(let a=0;a<H;a++){const vp=hd[Math.min(v+1,W-1)*H+a],vn=hd[Math.max(v-1,0)*H+a],ap=hd[v*H+Math.min(a+1,H-1)],an=hd[v*H+Math.max(a-1,0)];
sh[v*H+a]=Math.max(.4,Math.min(1.4,.75+(vp-vn)*5+(an-ap)*2.4))}
}

function render(){
const K=Kc,f=w/(2*K),step=Te/4,bm=Te/W,hs=HMAX*K/K0;let lk=-1;
for(let y=0;y<h;y++)buf.fill(bg[y],y*w,y*w+w);
ybuf.fill(h);
for(let z=-CAMV-3;z<-CAMV+DW;z+=.35+z*.0035){
const vf=(z+CAMV)/VB,sc=f/z,left=camU-z*K,du=2*z*K/w,fog=Math.min(.6,Math.max(0,(z-55)/(DW+20))*.7);
let row=0;if(vf>=0){const k=Math.floor(vf*bm/step);if(k!==lk){row=1;lk=k}}
const vi=vf<0?0:vf>=W-1?W-1.001:vf,v0=vi|0,fv=vi-v0;
for(let i=0;i<w;i++){
const af=(left+i*du)/UB;let r,gg,b,hv=0;
if(vf>=0&&af>=0&&af<H-1){
const a0=af|0,fa=af-a0,o=v0*H+a0,w0=(1-fv)*(1-fa),w1=(1-fv)*fa,w2=fv*(1-fa),w3=fv*fa;
const hh=hd[o]*w0+hd[o+1]*w1+hd[o+H]*w2+hd[o+H+1]*w3,s=sh[o]*w0+sh[o+1]*w1+sh[o+H]*w2+sh[o+H+1]*w3;
hv=hh*hs;const ci=(hh*255)|0;r=pr[ci]*s;gg=pg[ci]*s;b=pb[ci]*s;
const la=AMIN+af*BD;if(Math.abs(la-Math.round(la))<z/2600){r+=40;gg+=40;b+=60}
}else{r=14;gg=12;b=44}
if(row){r+=36;gg+=36;b+=56}
r=r*(1-fog)+70*fog;gg=gg*(1-fog)+22*fog;b=b*(1-fog)+78*fog;
const y=(hor+(camH-hv)*sc)|0,yb=ybuf[i];
if(y<yb){const c=pk(q(r)|0,q(gg)|0,q(b)|0);for(let yy=y<0?0:y;yy<yb;yy++)buf[yy*w+i]=c;ybuf[i]=y<0?0:y}
}}
cx.putImageData(img,0,0)}

const lab=d=>d===-30?'1 raw':d>=-3&&d<=2?['0.001','0.01','0.1','1','10','100'][d+3]:d===3?'1k':d===4?'10k':d===5?'100k':'1e'+d;
const fd=ms=>ms>=6e4?Math.round(ms/6e3)/10+' min':Math.round(ms/1e3)+' s';
const fmt=x=>x<1e-12?String(+(x*1e30).toPrecision(3))+' raw':(x>=.001&&x<1e6?String(+x.toPrecision(4)):x.toExponential(2))+' XNO';
function overlay(now){
const K=Kc,f=w/(2*K),sx=ov.width/w,sy=ov.height/h,bm=Te/W;
const P=(u,vw,hg)=>{const z=vw-CAMV;return[(w/2+(u-camU)/z*f)*sx,(hor+(camH-hg)/z*f)*sy]};
ox.clearRect(0,0,ov.width,ov.height);
ox.font=`${12*dpr}px "Bahnschrift","DIN Alternate","Arial Narrow",sans-serif`;ox.fillStyle='#b4c0f0';ox.textAlign='center';
const pxd=(UB/BD)*f/-CAMV*sx,ms=pxd>150*dpr?[1,2,5]:[1],st=Math.max(1,Math.ceil(46*dpr/pxd));
for(let d=AMIN;d<=AMAX;d++)for(const m of ms){if((d-AMIN)%st)continue;const x0=d+Math.log10(m);if(x0>AMAX)continue;const[x,y]=P((x0-AMIN)/BD*UB,0,0);ox.fillStyle=m===1?'#b4c0f0':'#7f8ac0';ox.fillText(m===1?lab(d):String(+(m*10**d).toPrecision(1)),x,y+15*dpr)}
{const[,y]=P(LW/2,0,0);ox.fillStyle='#8f98c4';ox.fillText('amount sent, XNO, log scale',ov.width/2,y+32*dpr)}
ox.textAlign='right';ox.fillStyle='#b4c0f0';
for(let k=0;k<=4;k++){const age=k*Te/4,[x,y]=P(0,age/bm*VB,0);ox.fillText(k?'\u2212'+fd(age):'now',x-8*dpr,y+4*dpr)}
ox.globalCompositeOperation='lighter';
for(let j=ev.length-2;j>=0;j-=2){const a=now-ev[j];if(a>1400)break;const la=ev[j+1];if(la<AMIN||la>=AMAX)continue;
const[x,y]=P((la-AMIN)/BD*UB,0,0),rd=(10+a/1400*26)*dpr,gr=ox.createRadialGradient(x,y,0,x,y,rd),al=(1-a/1400)*.9;
gr.addColorStop(0,`rgba(255,238,200,${al})`);gr.addColorStop(1,'rgba(255,106,60,0)');ox.fillStyle=gr;ox.beginPath();ox.arc(x,y,rd,0,6.283);ox.fill()}
drawMarkers(now,P,bm,K);
ox.globalCompositeOperation='source-over'}
function drawMarkers(now,P,bm,K){
const hs=HMAX*K/K0;
for(let i=markers.length-1;i>=0;i--){const m=markers[i],age=now-m.at;if(age>Te)continue;
const a=(m.la-AMIN)/BD;if(a<0||a>=H-1)continue;const v=age/bm,vi=Math.min(W-1,Math.max(0,v|0)),ai=a|0;
const hh=hd[vi*H+ai]*(1-(a-ai))+hd[vi*H+ai+1]*(a-ai),[x,y]=P(a*UB,v*VB,hh*hs),fade=.08+.92*Math.exp(-age/Math.max(60000,T*.7));
if(x<0||x>ov.width||y<0||y>ov.height)continue;
ox.globalAlpha=fade;ox.shadowBlur=7*dpr;ox.shadowColor=m.subtype==='send'?'#ff9b58':'#53e5f0';
ox.strokeStyle=m.subtype==='send'?'#ffc078':'#69e9f1';ox.lineWidth=1.2*dpr;ox.beginPath();ox.arc(x,y,3.1*dpr,0,6.283);ox.stroke();
ox.fillStyle=ox.strokeStyle;ox.fillRect(x-1.2*dpr,y-1.2*dpr,2.4*dpr,2.4*dpr);ox.shadowBlur=0;
if(age<EVENT_PULSE_SECONDS*1000){const pulse=1-age/(EVENT_PULSE_SECONDS*1000);ox.globalAlpha=pulse*.65;ox.beginPath();ox.arc(x,y,(4+12*(1-pulse))*dpr,0,6.283);ox.stroke()}
}
ox.globalAlpha=1;
}

const dupS=new Set(),dupQ=[],sentHashes=new Set(),sentQueue=[];
function add(raw,hash,t,subtype='send',account='',silent=false,peakAt=Date.now()){
const x=Number(raw);if(!(x>0))return;const at=t||Date.now(),la=Math.log10(x)-30;
if(subtype==='send'){ev.push(at,la);eventRise.push(peakAt)}
markers.push({at,la,subtype,hash:String(hash||''),peakAt});last={x:x/1e30,hash:String(hash||'')};
if(markers.length>3000)markers.splice(0,1000);
if(!silent)soundFX.play({frequency:196*2**(Math.max(0,Math.min(1,(la+8)/13))*3),volume:.095,account,lfoDepth:.24});
}
function status(t,c){$('stt').textContent=t;$('dot').className=c||''}
function stop(){simulation=null;if(feedClient){feedClient.stop();feedClient=null}}
function resetStream(){ev=[];eventRise=[];markers=[];cnt={};lastMsg=0;last=null;t0=Date.now();dupS.clear();dupQ.length=0;sentHashes.clear();sentQueue.length=0}
let cachedEvents=[];
function readCache(){try{const value=JSON.parse(localStorage.getItem(EVENT_CACHE_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function restoreCache(){
const cached=readCache();cachedEvents=[];
const now=Date.now();for(const item of cached){if(!item||now-item.at<0||now-item.at>EVENT_CACHE_TTL||!['send','receive','open'].includes(item.subtype))continue;
cachedEvents.push(item);t0=Math.min(t0,item.at);
add(item.amount,item.hash,item.at,item.subtype,item.account,true,item.at);if(item.subtype==='send'&&item.hash){sentHashes.add(item.hash);sentQueue.push(item.hash)}}
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
const account=c.account||b.account||'';add(c.amount,c.hash,at,sub,account);
persistEvent({at,subtype:sub,amount:c.amount,hash:c.hash,account});
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
const cut=now-T;let i=0;while(i<ev.length&&ev[i]<cut)i+=2;if(i){ev=ev.slice(i);eventRise=eventRise.slice(i/2)}
let first=0;while(first<markers.length&&markers[first].at<cut)first++;if(first)markers=markers.slice(first);
let n=0,lo=0,hi=0,m1=0;const la=[];
for(let j=ev.length-2;j>=0;j-=2){const t=ev[j];if(t<now-Te)break;n++;const v=ev[j+1];if(v<AMIN)lo++;else if(v>=AMAX)hi++;else la.push(v);if(t>now-6e4)m1++}
if(la.length>=3){la.sort((a,b)=>a-b);const p=x=>la[Math.min(la.length-1,Math.floor(x*la.length))],a=p(.05),b=p(.95),hw=Math.max(2,(b-a)/2*1.4+.8);
ctr=((a+b)/2-AMIN)/BD*UB;Kt=Math.min(K0,Math.max(.06,hw*UB/BD/-CAMV))}else{ctr=LW/2;Kt=K0}
const bd=Object.entries(cnt).map(([k,v])=>v+' '+k).join(', ');
$('stats').textContent=`${n} sends in view, ${m1} in the last minute\nShowing ${fd(Te)} of the ${fd(T)} window`+(Te<T?', filling as data arrives':'')+
`\nStream: ${lastMsg?Math.round((now-lastMsg)/1e3)+' s since the last message':'no messages yet'}`+(bd?`\nConfirmations seen: ${bd}`:'')+
(lo+hi?`\n${lo} below 1e-10 and ${hi} above 100k XNO are off the chart`:'')+
`\nSmoothing: ${Math.round(Math.max(Te/40,3e3)/1e3)} s by ${(SA*BD).toFixed(2)} decades`+
(last?`\nLatest: ${fmt(last.x)} ${last.hash.slice(0,8)}`:'');
$('mx').textContent=`${Math.round(dm)} sends per minute per decade, ${mode}`}

$('hm').onchange=e=>{mode=e.target.value;build(Date.now())};
gallerySettings.onNodeChange(connect);
gallerySettings.onMemoryChange(()=>{T=gallerySettings.memoryMs;});
addEventListener('pointermove',e=>{tx=e.clientX/innerWidth-.5});
addEventListener('resize',size);
setInterval(()=>hud(Date.now()),500);
size();connect();
(function loop(){const now=Date.now();
advanceSimulation(performance.now());
Te=Math.min(T,Math.max(6e4,now-t0));
if(now-lastB>100){build(now);lastB=now}
Kc+=(Kt-Kc)*.04;const kr=Kc/K0;
camU+=(ctr+tx*.45*kr+(RM?0:Math.sin(now/9000)*.125*kr)-camU)*.06;
camH0=.5*h*-CAMV*2*Kc/w;camH=camH0+(RM?0:Math.sin(now*2*Math.PI/180000)*.8*kr);
render();overlay(now);requestAnimationFrame(loop)})();
})();
