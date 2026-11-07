'use strict';
// Edge-relative particles follow moving accounts and disperse with their receive.
function createStardustWake({random=Math.random,reducedMotion=false,maxWakes=160,makeCanvas=()=>document.createElement('canvas')}={}) {
  const STEP=.012, FADE_OUT=1200, wakes=[], byHash=new Map();
  const DUST=[[255,244,232],[250,214,120],[150,200,255],[222,160,255]], TINT=[[255,255,255],[110,226,240],[140,100,255]];
  const clamp=(v,a,b)=>v<a?a:v>b?b:v, ease=u=>u*u*(3-2*u), gauss=()=>(random()+random()+random()-1.5)*1.15;
  let live=0, glow=null, star=null, PX=0, PY=0;
  function inverse(e){let a=0,b=1;for(let i=0;i<12;i++){const m=(a+b)/2;if(ease(m)<e)a=m;else b=m}return(a+b)/2}
  function sprite(rays,[r,g,b]){
    const n=rays?32:16,h=n/2,c=makeCanvas();c.width=c.height=n;
    const x=c.getContext('2d'),gr=x.createRadialGradient(h,h,0,h,h,h);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.2,`rgba(${r},${g},${b},.8)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
    x.fillStyle=gr;x.fillRect(0,0,n,n);
    if(rays){x.globalCompositeOperation='lighter';for(const vertical of [false,true]){
      const lg=vertical?x.createLinearGradient(h,0,h,n):x.createLinearGradient(0,h,n,h);
      lg.addColorStop(0,`rgba(${r},${g},${b},0)`);lg.addColorStop(.5,'rgba(255,255,255,1)');lg.addColorStop(1,`rgba(${r},${g},${b},0)`);
      x.fillStyle=lg;if(vertical)x.fillRect(h-.6,0,1.2,n);else x.fillRect(0,h-.6,n,1.2)}}
    return c;
  }
  function touch(w,p){p.tt=reducedMotion?w.rt0:w.rt0+w.rdu*inverse(clamp(p.p,0,1))+random()*90}
  function launch(s,d,t0,du,hash){
    const w={s,d,t0,du,hash,dust:[],k:0,emitting:true,kill:-1,dens:clamp(1.2-live/maxWakes,.3,1),g:null,f:1};
    wakes.push(w);live++;if(hash)byHash.set(hash,w);
    if(live>maxWakes){const old=wakes.find(o=>o.kill<0);if(old){old.kill=t0;old.emitting=false;live--}}
    return w;
  }
  function disperse(hash,t0,du){const w=hash&&byHash.get(hash);if(!w||w.rt0!==undefined||w.kill>=0)return false;w.rt0=t0;w.rdu=du;for(const p of w.dust)touch(w,p);return true}
  function emit(w,pn){
    const u=clamp((pn-w.t0)/w.du,0,1),last=Math.floor(1/STEP);
    while(w.k<=last&&w.k*STEP<=u){const uk=w.k++*STEP;
      for(let n=random()<.45?2:1;n>0;n--){if(random()>w.dens)continue;const r=random(),p={p:ease(uk)+(random()-.5)*.004,a:(random()-.5)*.006,off:gauss()*.9,vk:gauss()*5.5,al:(random()-.5)*5,
        bt:w.t0+uk*w.du,life:40e3+random()*40e3,z:.6+random()*.9,c:r<.45?0:r<.65?1:r<.9?2:3,m:random()<.09,tw:random()*6.28,
        tt:Infinity,ga:random()*6.28,gs:10+random()*26,gl:900+random()*1600,gw:.03+random()*.04,gp:random()*6.28,st:random()<.35};
        w.dust.push(p);if(w.rt0!==undefined)touch(w,p)}}
    if(w.k>last)w.emitting=false;
  }
  function update(pn){for(let i=wakes.length-1;i>=0;i--){const w=wakes[i];if(w.emitting)emit(w,pn);let n=0;
    for(const p of w.dust)if(!(pn-p.bt>p.life||pn-p.tt>p.gl||(w.kill>=0&&pn-w.kill>FADE_OUT)))w.dust[n++]=p;
    w.dust.length=n;if(!w.emitting&&!n){wakes.splice(i,1);if(w.kill<0)live--;if(byHash.get(w.hash)===w)byHash.delete(w.hash)}}}
  function place(w,p,pn,k){const G=w.g,age=(pn-p.bt)/1000,e=reducedMotion?0:1-Math.exp(-age/6),side=(p.off+p.vk*e)*k,along=p.p+p.a+p.al*e*k/G.len;
    PX=G.sx+G.dx*along-G.uy*side;PY=G.sy+G.dy*along+G.ux*side}
  function alpha(w,p,pn){const ms=pn-p.bt,slow=1-(ms/p.life)**2,twinkle=reducedMotion?1:.8+.2*Math.sin(pn*.0035+p.tw*9);
    return clamp(ms/120,0,1)*(.16+.7*Math.exp(-ms/1600))*slow*twinkle*w.f}
  function glitter(ctx,w,p,pn,k,sizeScale,brightness){const t=pn-p.tt;if(t>p.gl)return;const q=t/p.gl;place(w,p,pn,k);
    if(!reducedMotion){const G=w.g,r=p.gs*(1-Math.exp(-t/320))*k,vx=Math.cos(p.ga)+.6,vy=Math.sin(p.ga);PX+=(G.ux*vx-G.uy*vy)*r;PY+=(G.uy*vx+G.ux*vy)*r}
    const sp=reducedMotion?1:Math.max(0,Math.sin(t*p.gw+p.gp))**5,flash=Math.max(0,1-t/90),I=Math.min(1,Math.max(.22+.78*sp,flash))*(1-q)**1.5*w.f,ci=q<.2?0:q<.6?1:2,z=(p.st?10:5)*(.6+.8*I)*(1-q*.4)*sizeScale;
    if(I<.01)return;ctx.globalAlpha=Math.min(1,I*brightness);ctx.drawImage((p.st&&(sp>.5||flash>0)?star:glow)[ci],PX-z/2,PY-z/2,z,z)}
  function draw(ctx,pn,X,Y,k,sizeScale=1,brightness=1){if(!wakes.length)return;if(!glow){glow=TINT.map(c=>sprite(false,c));star=TINT.map(c=>sprite(true,c))}
    for(const w of wakes){const sx=X(w.s.x),sy=Y(w.s.y),dx=X(w.d.x)-sx,dy=Y(w.d.y)-sy,len=Math.hypot(dx,dy)||1;w.g={sx,sy,dx,dy,ux:dx/len,uy:dy/len,len};w.f=w.kill<0?1:clamp(1-(pn-w.kill)/FADE_OUT,0,1)}
    ctx.globalCompositeOperation='lighter';
    for(let c=0;c<4;c++){ctx.fillStyle=`rgb(${DUST[c]})`;for(const w of wakes)for(const p of w.dust){if(p.c!==c||p.m||pn>=p.tt)continue;const a=alpha(w,p,pn);if(a<.01)continue;place(w,p,pn,k);ctx.globalAlpha=Math.min(1,a*brightness);const z=p.z*sizeScale;ctx.fillRect(PX-z/2,PY-z/2,z,z)}}
    for(const w of wakes)for(const p of w.dust){if(pn>=p.tt){glitter(ctx,w,p,pn,k,sizeScale,brightness);continue}if(!p.m)continue;
      const a=alpha(w,p,pn)*(reducedMotion?.7:.55+.45*Math.sin(pn*.006+p.tw*9));if(a<.02)continue;const z=(3+p.z*2)*sizeScale;place(w,p,pn,k);ctx.globalAlpha=Math.min(1,a*brightness);ctx.drawImage(glow[0],PX-z/2,PY-z/2,z,z)}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  function clear(){wakes.length=0;byHash.clear();live=0}
  function stats(){let dust=0,touched=0;for(const w of wakes)for(const p of w.dust){dust++;if(p.tt<Infinity)touched++}return{wakes:wakes.length,live,dust,touched}}
  return {launch,disperse,update,draw,clear,stats};
}
