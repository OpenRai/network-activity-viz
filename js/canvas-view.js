/* Canvas drawing, picking, exit effects, and playback loop for the four canvas candidates. */
'use strict';
const canvas = $('scene');
const ctx = canvas.getContext('2d');
const colors = Object.fromEntries(['ink','muted','line','send','receive','vote','bg','panel'].map(name => [name, getComputedStyle(document.body).getPropertyValue('--'+name).trim()]));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = motionPreference.matches;
let hits=[];

// Retain only visual exits. They never participate in counts, pairing, or picking.
const visualItems = new Map();
let visualFrame = 0, paintingExit = false, visualWidth = 0, visualHeight = 0;
function visualItem(key, x, y, color, paint, duration=1800) {
  if (!paintingExit) visualItems.set(key, {key,x,y,color,paint,duration,frame:visualFrame,exitAt:null});
  ctx.save();paint();ctx.restore();
}
function dissolveExits() {
  for (const [key,item] of visualItems) {
    if (item.frame === visualFrame) continue;
    if (item.exitAt === null) item.exitAt = state.time;
    const progress = Math.min(1,Math.max(0,(state.time-item.exitAt)/item.duration));
    if (progress >= 1) { visualItems.delete(key);continue; }
    const fade = (1-progress)*(1-progress);
    const count = hits.length;
    paintingExit = true;
    ctx.save();
    ctx.globalAlpha = fade;
    if (!motionPreference.matches) {
      ctx.translate(item.x,item.y-16*progress);
      ctx.scale(1+progress*.12,1+progress*.12);
      ctx.translate(-item.x,-item.y);
    }
    item.paint();
    ctx.restore();
    paintingExit = false;
    hits.length = count;
    if (motionPreference.matches) continue;
    // Stable hash seeds make the same disappearing object dissolve the same way.
    let seed=2166136261;
    for (const char of key) seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    ctx.save();ctx.fillStyle=item.color;
    for(let i=0;i<12;i++){
      const angle=random()*Math.PI*2,spread=8+random()*28;
      const px=item.x+Math.cos(angle)*spread*progress;
      const py=item.y+Math.sin(angle)*spread*progress-28*progress*progress;
      ctx.globalAlpha=Math.sin(Math.PI*progress)*fade*(.35+random()*.65);
      const size=(.6+random()*1.3)*(1-progress*.7);
      ctx.fillRect(px,py,size,size);
    }
    ctx.restore();
  }
}

function setup(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);hits=[];return {w:rect.width,h:rect.height}}
function text(label,x,y,color=colors.muted,size=11,align='left'){ctx.fillStyle=color;ctx.font=size+'px ui-monospace,monospace';ctx.textAlign=align;ctx.fillText(label,x,y);ctx.textAlign='left'}
function line(x1,y1,x2,y2,color,width=1,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([])}
function dot(x,y,r,color,glow=false){ctx.save();ctx.fillStyle=color;if(glow){ctx.shadowColor=color;ctx.shadowBlur=16}ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore()}
function mark(block, x, y, radius = 5, role = 'block') {
  let color = colors.vote;
  if (block.subtype === 'send') color = colors.send;
  else if (['receive', 'open'].includes(block.subtype)) color = colors.receive;
  function paint() {
    ctx.fillStyle = color;
    if (block.subtype === 'send') ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
    else dot(x, y, radius, color);
    if (state.selected === block.hash) {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();ctx.arc(x, y, radius+5, 0, Math.PI*2);ctx.stroke();
    }
    hits.push({x, y, r:Math.max(12, radius), block});
  }
  // Dispatch fades entire rows, so its block marks must not also fade independently.
  if (viewOptions.fadeMarks === false) paint();
  else visualItem(role+':'+block.hash, x, y, color, paint);
}
function empty(w,h,message){text(message,w/2,h/2,colors.muted,12,'center')}
canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const hit=hits.slice().reverse().find(p=>Math.hypot(x-p.x,y-p.y)<p.r);if(hit)inspect(hit.block)};
canvas.onmousemove=e=>{const rect=canvas.getBoundingClientRect();canvas.style.cursor=hits.some(p=>Math.hypot(e.clientX-rect.left-p.x,e.clientY-rect.top-p.y)<p.r)?'pointer':'default'};
function render(){
 const m=model();updatePanels(m);const {w,h}=setup();
 if(w!==visualWidth||h!==visualHeight){visualItems.clear();visualWidth=w;visualHeight=h;}
 visualFrame++;draw(m,w,h);dissolveExits();
}
if($('viewMode'))$('viewMode').onchange=()=>{visualItems.clear();render()};
let previous=performance.now(),painted=0;
function frame(now){if(state.playing){if(state.mode==='demo'||state.mode==='stress'){state.time+=Math.min(now-previous,150)*(state.mode==='stress'?30:1);advanceDemo();if(state.demoIndex===demo.length){state.playing=false;state.status='Simulation ended · select a node to restart'}}else state.time=now-state.started}previous=now;if(now-painted>30){render();painted=now}requestAnimationFrame(frame)}
function startVisualizer(){connectSelected();requestAnimationFrame(frame);}


