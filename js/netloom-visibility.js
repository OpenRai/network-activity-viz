'use strict';
function createNetloomVisibility(matrix,width,height) {
  const [a,b,c,d,e,f]=matrix,det=a*d-b*c;
  const project=(x,y)=>({x:a*x+c*y+e,y:b*x+d*y+f});
  const inverse=(x,y)=>({x:(d*(x-e)-c*(y-f))/det,y:(a*(y-f)-b*(x-e))/det});
  const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>inverse(x,y));
  const bounds={left:Math.min(...corners.map(p=>p.x))-12,right:Math.max(...corners.map(p=>p.x))+12,top:Math.min(...corners.map(p=>p.y))-12,bottom:Math.max(...corners.map(p=>p.y))+12};
  const intersects=(x,y,w,h)=>!Number.isFinite(det)||Math.abs(det)<1e-8||x+w>=bounds.left&&x<=bounds.right&&y+h>=bounds.top&&y<=bounds.bottom;
  const columns=Math.ceil(width/12),rows=Math.ceil(height/12),occupied=new Uint8Array(columns*rows);
  function label(x,y,w,h) {
    if(h*Math.hypot(c,d)<6||!intersects(x,y,w,h))return false;
    const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>project(x,y));
    const left=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))/12)),right=Math.min(columns-1,Math.floor(Math.max(...points.map(p=>p.x))/12));
    const top=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))/12)),bottom=Math.min(rows-1,Math.floor(Math.max(...points.map(p=>p.y))/12));
    if(left>right||top>bottom)return false;
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++)if(occupied[row*columns+col])return false;
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++)occupied[row*columns+col]=1;
    return true;
  }
  return {intersects,label,bounds};
}
