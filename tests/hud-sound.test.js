import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('the Sound control turns off on audio failure and a single tap re-enables it', async () => {
  class Element extends EventTarget {
    attributes = new Map();
    children = [];
    dataset = {};
    append(...children) { this.children.push(...children); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
  }
  const elements = Object.fromEntries(['hud','snd','audioState','hud-shell'].map(id => [id,new Element()]));
  const toggle = elements.snd;
  toggle.checked = true;
  toggle.click = () => {
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('input'));
    toggle.dispatchEvent(new Event('change'));
  };
  let requireGesture, previews = 0;
  const fx = {
    setGestureRequiredHandler(handler) { requireGesture = handler; },
    async enable() {},
    disable() {},
    play() { previews++; },
  };
  const context = vm.createContext({Event, matchMedia:() => ({matches:false}), document:{
    head:new Element(), getElementById:id => elements[id], createElement:() => new Element(),
    createTextNode:textContent => ({textContent}),
  }});
  vm.runInContext(readFileSync(new URL('../js/hud-card.js', import.meta.url),'utf8'), context);
  context.bindHudSound(fx);
  const [button] = elements['hud-shell'].children;
  requireGesture();
  expect(toggle.checked).toBe(false);
  expect(button.attributes.get('aria-pressed')).toBe('false');
  expect(button.children[1].textContent).toBe('Retry');
  button.dispatchEvent(new Event('click'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(toggle.checked).toBe(true);
  expect(button.attributes.get('aria-pressed')).toBe('true');
  expect(button.children[1].textContent).toBe('Sound');
  expect(previews).toBe(1);
});
