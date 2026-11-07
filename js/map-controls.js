'use strict';
function createMapControls(surface, camera, viewport) {
  const pointers = new Map();
  let manual = false, blockedUntil = 0, lastTap = null, lastTwoTap = null, tapGroup = null;
  let defaultScale = camera.s, wheelTimer, returning = false;
  surface.style.touchAction = 'none';
  function point(event) {
    const rect = surface.getBoundingClientRect(), view = viewport();
    return {x:(event.clientX-rect.left)*view.width/rect.width, y:(event.clientY-rect.top)*view.height/rect.height};
  }
  function moveView(from, to, factor = 1) {
    const view = viewport(), requested = Math.min(24, camera.s*factor);
    const scale = requested < defaultScale
      ? defaultScale*(1-.15*Math.tanh((defaultScale-requested)/(defaultScale*.15))) : requested;
    camera.x += (from.x-view.cx)/camera.s - (to.x-view.cx)/scale;
    camera.y += (from.y-view.cy)/camera.s - (to.y-view.cy)/scale;
    camera.s = scale;
    manual = true;
    returning = false;
    blockedUntil = performance.now()+400;
  }
  function reset() { clearTimeout(wheelTimer); manual = false; returning = true; lastTap = null; blockedUntil = performance.now()+400; }
  surface.addEventListener('wheel', event => {
    event.preventDefault();
    const p = point(event), unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport().height : 1;
    moveView(p, p, Math.exp(-Math.max(-300, Math.min(300, event.deltaY*unit))*.003));
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { if (camera.s < defaultScale) reset(); }, 180);
  }, {passive:false});
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = point(event);
    pointers.set(event.pointerId, {p, start:p, at:performance.now(), moved:false});
    if (event.pointerType === 'touch') {
      if (!pointers.size || !tapGroup || performance.now()-tapGroup.at>250) tapGroup={at:performance.now(),count:0,moved:false,x:p.x,y:p.y};
      tapGroup.count++;
      if (tapGroup.count>2) tapGroup.moved=true;
    }
    surface.setPointerCapture(event.pointerId);
    if (pointers.size > 1) for (const pointer of pointers.values()) pointer.moved = true;
  });
  surface.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const next = point(event), previous = pointer.p;
    if (Math.hypot(next.x-pointer.start.x, next.y-pointer.start.y)>5) pointer.moved = true;
    if (pointer.moved && tapGroup) tapGroup.moved=true;
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1].p;
      const before = Math.hypot(previous.x-other.x, previous.y-other.y);
      const after = Math.hypot(next.x-other.x, next.y-other.y);
      moveView({x:(previous.x+other.x)/2,y:(previous.y+other.y)/2},
        {x:(next.x+other.x)/2,y:(next.y+other.y)/2}, after/Math.max(1,before));
    } else if (pointers.size === 1 && pointer.moved) moveView(previous, next);
    pointer.p = next;
  });
  function release(event) {
    const pointer = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (!pointers.size && tapGroup) {
      const now=performance.now();
      if (event.type==='pointerup'&&tapGroup.count===2&&!tapGroup.moved&&now-tapGroup.at<350) {
        if (lastTwoTap&&now-lastTwoTap.at<400&&Math.hypot(tapGroup.x-lastTwoTap.x,tapGroup.y-lastTwoTap.y)<45) { reset();lastTwoTap=null; }
        else lastTwoTap={at:now,x:tapGroup.x,y:tapGroup.y};
      }
      tapGroup=null;
    }
    if (!pointers.size && camera.s < defaultScale) reset();
    if (!pointer || event.type !== 'pointerup') return;
    const now = performance.now();
    if (pointer.moved) { blockedUntil = now+400; lastTap = null; return; }
    if (event.pointerType !== 'touch' || now-pointer.at>300 || pointer.moved || lastTwoTap?.at===now) return;
    if (lastTap && now-lastTap.at<350 && Math.hypot(pointer.p.x-lastTap.x,pointer.p.y-lastTap.y)<35) reset();
    else lastTap = {...pointer.p,at:now};
  }
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);
  surface.addEventListener('lostpointercapture', release);
  surface.addEventListener('dblclick', reset);
  return {isManual:()=>manual, isGesture:()=>performance.now()<blockedUntil,
    springing:()=>returning,
    setDefaultScale(scale) { defaultScale = scale; if (Math.abs(camera.s-scale)<scale*.001) returning = false; }};
}
