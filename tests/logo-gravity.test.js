import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const gravity=readFileSync(new URL('../js/logo-gravity.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../starmap.html',import.meta.url),'utf8');
const layout=html.slice(html.indexOf('function layout(){'),html.indexOf('function prune('));
export function settleLogo(count=49){
 const points=Array.from({length:count},(_,i)=>({x:Math.sin(i*12.3)*220,y:Math.cos(i*7.1)*180,vx:0,vy:0}));
 const nodes=new Map(points.map((p,i)=>[i,p])),edges=new Map();
 points.forEach((p,i)=>edges.set(i,{s:p,d:points[(i+17)%count],ts:[1,2]}));
 // Include a service hub whose real links cross several wells.
 for(let i=1;i<count;i++)edges.set('hub'+i,{s:points[0],d:points[i],ts:[1]});
 const c=vm.createContext({nodes,edges,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
 vm.runInContext(gravity+'\n'+layout,c);
 vm.runInContext('for(let i=0;i<1800;i++)layout()',c);
 const assignments=vm.runInContext('[...nodes.values()].map(p=>nanoLogoAssignments.get(p))',c);
 const wells=vm.runInContext('nanoLogoWells',c),unit=Math.max(85,Math.sqrt(count/7)*24);
 const groups=wells.map((_,i)=>points.filter((p,j)=>assignments[j]===i));
 const centres=groups.map(group=>({x:group.reduce((s,p)=>s+p.x,0)/group.length,y:group.reduce((s,p)=>s+p.y,0)/group.length}));
 const boundaries=vm.runInContext('[...nodes.values()].map(p=>({inside:nanoLogoIsInner(p),distance:closestLogoPoint(p,nanoLogoField.wells).distance,assigned:nanoLogoAssignments.has(p)}))',c);
 return {points,edges:[...edges.values()],groups,centres,wells,unit,boundaries};
}
for(const count of [49,140])test(`${count} linked accounts retain the logo's broad regions`,()=>{
 const {points,centres,wells,unit,boundaries}=settleLogo(count);
 const cx=points.reduce((s,p)=>s+p.x,0)/count,cy=points.reduce((s,p)=>s+p.y,0)/count;
 // Soft density basins permit movement along a stroke and into its fuzzy edges.
 const tolerance=.8;
 for(let i=0;i<wells.length;i++)expect(Math.hypot(centres[i].x-cx-wells[i][0]*unit,centres[i].y-cy-wells[i][1]*unit)).toBeLessThan(unit*tolerance);
 expect(points.every(p=>Number.isFinite(p.x+p.y))).toBe(true);
 expect(boundaries.some(b=>!b.inside)).toBe(true);
 for(const b of boundaries){
   expect(b.assigned).toBe(b.inside);
 }
});
test('gravity changes acceleration without projecting account positions or velocities',()=>{
 const points=Array.from({length:30},(_,i)=>({a:'account-'+i,x:i*20-300,y:Math.sin(i)*200,vx:1,vy:-2,fx:0,fy:0}));
 const c=vm.createContext({points});vm.runInContext(gravity,c);
 const before=points.map(({x,y,vx,vy})=>({x,y,vx,vy}));
 vm.runInContext('applyNanoLogoGravity(points)',c);
 expect(points.map(({x,y,vx,vy})=>({x,y,vx,vy}))).toEqual(before);
 expect(points.every(p=>Number.isFinite(p.fx+p.fy)&&Math.hypot(p.fx,p.fy)<=1.4)).toBe(true);
 expect(Math.abs(points.reduce((sum,p)=>sum+p.fx,0))).toBeLessThan(1e-9);
 expect(Math.abs(points.reduce((sum,p)=>sum+p.fy,0))).toBeLessThan(1e-9);
});
test('quiet zone repulsion has a smooth falloff instead of a collision edge',()=>{
 const c=vm.createContext({});vm.runInContext(gravity,c);
 const field={cx:0,cy:0,unit:100};
 const near=c.nanoLogoQuietForce({x:-100,y:70},field);
 const far=c.nanoLogoQuietForce({x:-900,y:900},field);
 expect(near.fx).toBeGreaterThan(0);expect(near.fy).toBeGreaterThan(0);
 expect(Math.hypot(far.fx,far.fy)).toBeLessThan(1e-12);
 const a=c.nanoLogoQuietForce({x:-90,y:70},field),b=c.nanoLogoQuietForce({x:-89.99,y:70},field);
 expect(Math.hypot(a.fx-b.fx,a.fy-b.fy)).toBeLessThan(.001);
});
test('tips have less capacity and outer targets cover all four quadrants',()=>{
 const c=vm.createContext({});vm.runInContext(gravity,c);
 const caps=c.nanoLogoCapacities(700);
 expect(caps[0]).toBeLessThan(caps[2]);expect(caps[6]).toBeLessThan(caps[5]);
 const quadrants=new Set();
 for(let i=0;i<100;i++){
   const t=c.logoTraits({a:'nano_stress_'+String(i).padStart(3,'0')});
   if(!t.inner)quadrants.add(`${Math.sign(t.skyX)},${Math.sign(t.skyY)}`);
 }
 expect(quadrants.size).toBe(4);
});
