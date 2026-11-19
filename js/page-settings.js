// Shared Memory preferences and Node controls.
(() => {
  function bindMemory(memory) {
    const page = location.pathname.split('/').pop();
    const key = 'nano-gallery-memory:' + page;
    const options = ['10', '30', '60'];
    let savedWindow;
    try { savedWindow = localStorage.getItem(key); } catch {}
    memory.value = options.includes(savedWindow) ? savedWindow : '30';
    memory.addEventListener('change', () => {
      if (!options.includes(memory.value)) return;
      try { localStorage.setItem(key, memory.value); } catch {}
    });
    return {
      get memoryMs() { return Number(memory.value) * 60000; },
      onMemoryChange(callback) { memory.addEventListener('change', callback); }
    };
  }

  const existingMemory = document.querySelector('#win');
  if (existingMemory) {
    window.gallerySettings = bindMemory(existingMemory);
    return;
  }

  const node = document.querySelector('#feed');
  if (!node) return;
  const hosts = [
    ['wss://node.somenano.com/repeater', 'SomeNano network repeater'],
    ['wss://ws.nano.to', 'Nano.to'],
    ['demo', 'Simulated data'],
    ['stress', 'Stress test · 30×']
  ];
  let stored;
  try { stored = localStorage.getItem('nano-gallery-node'); } catch {}
  node.replaceChildren(...hosts.map(([value, label]) => new Option(label, value)));
  node.value = hosts.slice(0, 2).some(([value]) => value === stored) ? stored : 'wss://node.somenano.com/repeater';
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
  const memoryLabel = document.createElement('label');
  memoryLabel.append('Memory ', memory);
  nodeLabel.after(memoryLabel);
  node.closest('.controls').replaceChildren(nodeLabel, memoryLabel);

  window.gallerySettings = Object.assign(bindMemory(memory), {
    saveNode() { try { if (['demo','stress'].includes(node.value)) localStorage.removeItem('nano-gallery-node'); else localStorage.setItem('nano-gallery-node', node.value); } catch {} },
    onNodeChange(callback) { node.addEventListener('change', callback); }
  });
  node.addEventListener('change', () => window.gallerySettings.saveNode());
})();
