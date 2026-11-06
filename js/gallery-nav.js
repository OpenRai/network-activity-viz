(() => {
  const pages = [
    { href: 'starmap.html', name: 'Starmap', detail: 'Account constellation' },
    { href: 'constellation.html', name: 'Constellation', detail: 'Account links' },
    { href: 'dispatch.html', name: 'Dispatch', detail: 'Transfer activity' },
    { href: 'hangtime.html', name: 'Hangtime', detail: 'Send and receive timing' },
    { href: 'score.html', name: 'Score', detail: 'Account chains' },
    { href: 'lattice.html', name: 'Lattice', detail: 'Block lattice' }
  ];
  const current = location.pathname.split('/').pop() || 'index.html';
  const style = document.createElement('style');
  style.textContent = `
    body { padding-bottom: 76px !important; }
    nav[aria-label="Visualizer candidates"] { display:none; }
    #gallery-nav { position:fixed;z-index:1000;left:0;right:0;bottom:0;min-height:64px;
      display:flex;justify-content:center;align-items:center;gap:8px;padding:9px 18px calc(9px + env(safe-area-inset-bottom));
      background:rgba(7,10,23,.92);border-top:1px solid rgba(111,139,188,.28);backdrop-filter:blur(16px); }
    #gallery-nav a { display:flex;flex-direction:column;gap:2px;min-width:100px;padding:7px 12px;
      border:1px solid transparent;border-radius:7px;color:#9ba9c8;text-align:center;text-decoration:none;
      font:600 12px/1.2 system-ui,sans-serif;transition:background .18s,border-color .18s,color .18s; }
    #gallery-nav a small { color:#737f9e;font:10px/1.2 system-ui,sans-serif; }
    #gallery-nav a:hover { color:#ecf6ff;background:rgba(66,100,150,.18);border-color:rgba(111,139,188,.3); }
    #gallery-nav a[aria-current="page"] { color:#eafaff;background:rgba(47,196,214,.13);border-color:rgba(47,196,214,.48); }
    #gallery-nav a[aria-current="page"] small { color:#7dd9e5; }
    @media(max-width:700px) { body { padding-bottom:70px !important; }
      #gallery-nav { justify-content:flex-start;overflow-x:auto;gap:4px;padding-left:8px;padding-right:8px; }
      #gallery-nav a { min-width:85px;padding:8px 9px;font-size:11px; } }
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
