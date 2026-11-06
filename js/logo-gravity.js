'use strict';
// Seven node centres traced from the Nano Foundation mark. These are layout
// ornaments, not representative weight, account location, or transfer edges.
// Third coordinate estimates silhouette area, including connecting necks.
const nanoLogoWells = [[-3,1,.65],[-2,0,1.16],[-1,-1,1.32],[0,0,1.16],[1,1,1.16],[2,0,1.32],[3,-1,.65]];
const nanoLogoAssignments = new Map();
const nanoLogoTraits = new WeakMap();
let nanoLogoField=null;
let nanoLogoAspect=1.3;
function setNanoLogoViewport(width,height){nanoLogoAspect=Math.max(.6,width/Math.max(1,height))}
function logoTraits(point){
  if(!nanoLogoTraits.has(point)){
    let hash=2166136261;
    for(const ch of point.a||`${point.x},${point.y}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
    const inner=hash%5!==0;
    const random=()=>((hash=(Math.imul(hash,1664525)+1013904223)>>>0)/4294967296);
    const scatter=()=>(random()+random()+random()-1.5)*.34;
    const quadrant=(hash>>>5)%4;
    nanoLogoTraits.set(point,{inner,x:scatter(),y:scatter(),
      skyX:(quadrant%2?1:-1)*(.35+random()*.65),
      skyY:(quadrant<2?-1:1)*(.35+random()*.65)});
  }
  return nanoLogoTraits.get(point);
}
function nanoLogoIsInner(point){return logoTraits(point).inner}
function closestLogoPoint(point,wells){
  let closest=wells[0],best=Infinity;
  for(let i=1;i<wells.length;i++){
    const a=wells[i-1],b=wells[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));
    const q={x:a.x+t*dx,y:a.y+t*dy},distance=(point.x-q.x)**2+(point.y-q.y)**2;
    if(distance<best){closest=q;best=distance}
  }
  return {x:closest.x,y:closest.y,distance:Math.sqrt(best)};
}
// Gaussian hills make the two gaps quiet without producing a hard silhouette.
// Forces vanish gradually; accounts can cross these regions under link tension.
function nanoLogoQuietForce(point,field){
  let fx=0,fy=0;
  for(const [x,y] of [[-1.15,.6],[1.15,-.6]]){
    const dx=(point.x-field.cx)/field.unit-x,dy=(point.y-field.cy)/field.unit-y;
    const sx=.78,sy=.62,density=Math.exp(-.5*((dx/sx)**2+(dy/sy)**2));
    fx+=dx/(sx*sx)*density*.85;
    fy+=dy/(sy*sy)*density*.85;
  }
  return {fx,fy};
}
function nanoLogoEdgeOpacity(source,destination){
  if(!nanoLogoField)return 1;
  const softness=nanoLogoField.unit*.7;
  const visibility=p=>.18+.82*Math.exp(-.5*(closestLogoPoint(p,nanoLogoField.wells).distance/softness)**2);
  const sameWell=nanoLogoAssignments.has(source)&&nanoLogoAssignments.get(source)===nanoLogoAssignments.get(destination);
  return (sameWell?1:.26)*Math.sqrt(visibility(source)*visibility(destination));
}
function nanoLogoCapacities(count){
  const total=nanoLogoWells.reduce((sum,w)=>sum+w[2],0);
  const shares=nanoLogoWells.map(w=>count*w[2]/total),caps=shares.map(Math.floor);
  const order=shares.map((s,i)=>({i,r:s-caps[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);
  const remaining=count-caps.reduce((sum,n)=>sum+n,0);
  for(let i=0;i<remaining;i++)caps[order[i].i]++;
  return caps;
}
function applyNanoLogoGravity(points) {
  const active=new Set(points);
  for(const p of nanoLogoAssignments.keys())if(!active.has(p)||!nanoLogoIsInner(p))nanoLogoAssignments.delete(p);
  if (points.length < 3){nanoLogoAssignments.clear();nanoLogoField=null;return}
  const cx=points.reduce((sum,p)=>sum+p.x,0)/points.length;
  const cy=points.reduce((sum,p)=>sum+p.y,0)/points.length;
  // Account count sets spacing, rather than the moving cloud's bounding box.
  // Leave room for larger populations to form seven separate groups.
  const unit=Math.max(85,Math.sqrt(points.length/7)*24);
  const wells=nanoLogoWells.map(([x,y])=>({x:cx+x*unit,y:cy+y*unit}));
  nanoLogoField={wells,unit,cx,cy};
  assignNanoLogoWells(points.filter(nanoLogoIsInner),wells);
  // More accounts should suggest the silhouette through a diffuse star cloud,
  // rather than compressing an ever larger population into seven bright knots.
  const densitySoftening=Math.min(1,Math.sqrt(35/points.length));
  const forces=[];let sumX=0,sumY=0;
  for(const p of points){
    const traits=logoTraits(p),index=nanoLogoAssignments.get(p),well=traits.inner?wells[index]:p;
    const tip=index===0||index===6;
    const spread=tip?1.35:1,weight=tip?.7:1;
    let fx=traits.inner?(well.x+traits.x*unit*spread-p.x)*.012*weight:0;
    let fy=traits.inner?(well.y+traits.y*unit*spread-p.y)*.012*weight:0;
    if(!traits.inner){
      // A sparse account sky fills the rectangle, rather than parking every
      // outlier at the logo's repulsive ridge. Targets remain soft and stable.
      const halfWidth=unit*4.1,halfHeight=halfWidth/nanoLogoAspect;
      fx+=(cx+traits.skyX*halfWidth-p.x)*.003;
      fy+=(cy+traits.skyY*halfHeight-p.y)*.003;
      // Outer accounts feel a broad repulsive ridge, never well attraction.
      // No projection or collisions: occasional strays remain possible.
      const nearest=closestLogoPoint(p,wells),reach=unit*.8;
      const falloff=Math.exp(-.5*(nearest.distance/reach)**2)*.009;
      fx+=(p.x-nearest.x)*falloff;fy+=(p.y-nearest.y)*falloff;
    }
    const quiet=nanoLogoQuietForce(p,nanoLogoField);
    fx=(fx+quiet.fx)*densitySoftening;fy=(fy+quiet.fy)*densitySoftening;
    const limit=Math.min(1,.7*densitySoftening/(Math.hypot(fx,fy)||1));fx*=limit;fy*=limit;
    forces.push({fx,fy});sumX+=fx;sumY+=fy;
  }
  // Remove net force so the ornamental field cannot drag the cluster away.
  points.forEach((p,i)=>{p.fx+=forces[i].fx-sumX/points.length;p.fy+=forces[i].fy-sumY/points.length});
}

function assignNanoLogoWells(points,wells){
  const distance=(p,i)=>(p.x-wells[i].x)**2+(p.y-wells[i].y)**2;
  const capacities=nanoLogoCapacities(points.length),groups=wells.map(()=>[]);
  for(const [p,i] of nanoLogoAssignments)groups[i].push(p);
  groups.forEach((group,i)=>{
    if(group.length<=capacities[i])return;
    group.sort((a,b)=>distance(a,i)-distance(b,i));
    for(const p of group.splice(capacities[i]))nanoLogoAssignments.delete(p);
  });
  const free=capacities.map((n,i)=>n-groups[i].length);
  for(const p of points)if(!nanoLogoAssignments.has(p)){
    let selected=-1,best=Infinity;
    for(let i=0;i<wells.length;i++)if(free[i]>0&&distance(p,i)<best){selected=i;best=distance(p,i)}
    nanoLogoAssignments.set(p,selected);free[selected]--;
  }
}
