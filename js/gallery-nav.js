(() => {
  const pages = [
    { href: 'starmap.html', name: 'Starmap', detail: 'Account galaxy' },
    { href: 'nano-atlas.html', name: 'Nano Atlas', detail: 'Live account network' },
    { href: 'eventsky.html', name: 'Eventsky', detail: 'Events through time' },
    { href: 'send-mountains.html', name: 'Send mountains', detail: 'Amount landscape' }
  ];
  const current = location.pathname.split('/').pop() || 'index.html';
  const style = document.createElement('style');
  style.textContent = `
    body { padding-bottom: 76px !important; }
    nav[aria-label="Visualizer candidates"] { display:none; }
    #gallery-nav { position:fixed;z-index:1000;left:0;right:0;bottom:0;min-height:60px;
      display:flex;justify-content:center;align-items:center;gap:clamp(10px,3vw,40px);padding:8px 18px calc(8px + env(safe-area-inset-bottom));
      background:linear-gradient(180deg,rgba(5,9,21,.38),rgba(5,9,21,.92));border-top:1px solid rgba(140,178,207,.17);backdrop-filter:blur(13px); }
    #gallery-nav a { display:flex;flex-direction:row;align-items:center;gap:9px;min-width:0;padding:9px 3px;
      border:0;border-radius:0;color:rgba(207,222,236,.62);text-align:center;text-decoration:none;
      font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;transition:color .18s; }
    #gallery-nav a small { color:inherit;font:inherit;opacity:.58; }
    #gallery-nav a:hover { color:#ecf6ff; }
    #gallery-nav a[aria-current="page"] { color:#eafaff; }
    #gallery-nav a[aria-current="page"]::before { content:"";width:5px;height:5px;border-radius:50%;background:#55eac9;box-shadow:0 0 9px #55eac9; }
    @media(max-width:700px) { body { padding-bottom:70px !important; }
      #gallery-nav { justify-content:center;overflow-x:auto;gap:12px;padding-left:8px;padding-right:8px; }
      #gallery-nav a { gap:6px;font-size:9px; }
      #gallery-nav a small { display:none; } }
    @media(prefers-reduced-motion:reduce) { #gallery-nav a { transition:none; } }
  `;
  document.head.append(style);
  const nav = document.createElement('nav');
  nav.id = 'gallery-nav';
  nav.setAttribute('aria-label', 'Nano network visualization gallery');
  nav.innerHTML = pages.map(({ href, name, detail }) =>
    `<a href="${href}"${current === href ? ' aria-current="page"' : ''}><span>${name}</span><small>${detail}</small></a>`
  ).join('');
  document.body.append(nav);
})();
