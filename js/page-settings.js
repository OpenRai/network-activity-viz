// Shared Node and Memory controls for every gallery page except the starmap.
(() => {
  const node = document.querySelector('#feed');
  if (!node) return;
  const hosts = [
    ['wss://ws.nano.to', 'Nano.to'],
    ['wss://node.somenano.com/repeater', 'SomeNano network repeater'],
    ['demo', 'Simulated data'],
    ['stress', 'Stress test · 30×']
  ];
  let stored;
  try { stored = localStorage.getItem('nano-gallery-node'); } catch {}
  node.replaceChildren(...hosts.map(([value, label]) => new Option(label, value)));
  node.value = hosts.slice(0, 2).some(([value]) => value === stored) ? stored : hosts[0][0];
  node.setAttribute('aria-label', 'Node');
  let nodeLabel = node.closest('label');
  if (!nodeLabel) {
    nodeLabel = document.createElement('label');
    node.before(nodeLabel);
    nodeLabel.append('Node ', node);
  } else nodeLabel.firstChild.textContent = 'Node ';
  document.querySelector('#endpoint')?.closest('label')?.remove();

  const memory = document.createElement('select');
  memory.id = 'win';
  memory.setAttribute('aria-label', 'Memory window');
  memory.replaceChildren(...[[10,'10 minutes'],[30,'30 minutes'],[60,'60 minutes']]
    .map(([value,label]) => new Option(label, String(value))));
  let savedWindow;
  try { savedWindow = localStorage.getItem('nano-gallery-memory'); } catch {}
  memory.value = ['10','30','60'].includes(savedWindow) ? savedWindow : '30';
  const memoryLabel = document.createElement('label');
  memoryLabel.append('Memory ', memory);
  nodeLabel.after(memoryLabel);
  node.closest('.controls').replaceChildren(nodeLabel, memoryLabel);

  window.gallerySettings = {
    get memoryMs() { return Number(memory.value) * 60000; },
    saveNode() { try { if (['demo','stress'].includes(node.value)) localStorage.removeItem('nano-gallery-node'); else localStorage.setItem('nano-gallery-node', node.value); } catch {} },
    onMemoryChange(callback) { memory.addEventListener('change', callback); },
    onNodeChange(callback) { node.addEventListener('change', callback); }
  };
  node.addEventListener('change', () => window.gallerySettings.saveNode());
})();
