// Native disclosure keeps touch and keyboard interaction consistent on both views.
(() => {
  const card = document.getElementById('hud');
  card.open = !matchMedia('(max-width: 700px)').matches;
  const style = document.createElement('style');
  style.textContent = `
    #hud { z-index:10;max-height:calc(100dvh - 100px);overflow-y:auto; }
    #hud > summary { display:flex;align-items:center;justify-content:space-between;
      gap:12px;min-height:44px;cursor:pointer;list-style:none;touch-action:manipulation; }
    #hud > summary::-webkit-details-marker { display:none; }
    #hud > summary h1 { margin:0; }
    #hud > summary::after { content:'+';font:24px/1 system-ui;color:var(--cyan); }
    #hud[open] > summary::after { content:'−'; }
    #hud[open] > summary { margin-bottom:8px; }
    #hud > summary:focus-visible { outline:2px solid var(--cyan);outline-offset:3px; }
    #hud select { min-width:0;max-width:100%; }
  `;
  document.head.append(style);
})();
