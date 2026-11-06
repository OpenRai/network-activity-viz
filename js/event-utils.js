'use strict';
// Shared by recording views. Keep presentation and retention limits at call sites.
function appendBounded(items, item, limit) {
  items.push(item);
  if (items.length > limit) items.shift();
}
function parseNanoBlock(block) {
  if (typeof block !== 'string') return block;
  try { return JSON.parse(block); } catch { return null; }
}
function downloadJSON(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
