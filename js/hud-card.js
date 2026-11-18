// Native disclosure keeps touch and keyboard interaction consistent on both views.
(() => {
  const card = document.getElementById('hud');
  card.open = card.dataset?.startCollapsed === undefined && !matchMedia('(max-width: 700px)').matches;
  const style = document.createElement('style');
  style.textContent = `
    #hud-shell { position:absolute;z-index:10;top:max(10px,env(safe-area-inset-top));
      left:max(10px,env(safe-area-inset-left));width:min(300px,calc(100% - 20px)); }
    #hud { max-height:calc(100dvh - 100px);overflow-y:auto; }
    #hud > summary { display:flex;align-items:center;gap:9px;padding-right:80px;
      min-height:44px;cursor:pointer;list-style:none;touch-action:manipulation; }
    #hud > summary::-webkit-details-marker { display:none; }
    #hud > summary h1 { margin:0; }
    #hud > summary::before { content:'▸';font:42px/1 system-ui;color:var(--cyan);width:25px;flex:none;text-align:center; }
    #hud[open] > summary::before { content:'▾'; }
    #hud[open] > summary { margin-bottom:8px; }
    #hud > summary:focus-visible { outline:2px solid var(--cyan);outline-offset:3px; }
    #hud select { min-width:0;max-width:100%; }
    #quickSound { position:absolute;top:13px;right:15px;width:72px;min-height:44px;
      display:flex;align-items:center;justify-content:center;gap:4px;
      touch-action:manipulation;cursor:pointer;background:transparent;color:var(--dim);border-color:transparent; }
    #quickSound .sound-symbol { font-size:19px;line-height:1; }
    #quickSound:hover { border-color:var(--line); }
    #quickSound[aria-pressed="true"] { color:#5df0cc;background:rgba(93,240,204,.08); }
  `;
  document.head.append(style);
})();

function bindHudSound(soundFX) {
  const toggle = document.getElementById('snd');
  const status = document.getElementById('audioState');
  const button = document.createElement('button');
  button.id = 'quickSound';
  button.type = 'button';
  button.setAttribute('aria-describedby', status.id);
  const icon = document.createElement('span');
  icon.className = 'sound-symbol';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '♫';
  button.append(icon, 'Sound');
  document.getElementById('hud-shell').append(button);

  const sync = () => button.setAttribute('aria-pressed', String(toggle.checked));
  sync();
  toggle.addEventListener('input', sync);
  button.addEventListener('click', () => toggle.click());
  toggle.addEventListener('change', async () => {
    if (!toggle.checked) {
      soundFX.disable();
      status.textContent = '';
      return;
    }
    try {
      await soundFX.enable();
      if (toggle.checked) soundFX.play({frequency:440, volume:.12});
    } catch {
      if (toggle.checked) status.textContent = 'Audio paused · turn sound off and on to retry.';
    }
  });
}
