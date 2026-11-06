/* Shared formatting and DOM lookup. Loaded by every visualizer. */
'use strict';
const $ = id => document.getElementById(id);

function shortAccount(value, stripDemoPrefix = true) {
  if (!value) return 'unknown';
  if (value.startsWith('Demo ')) return stripDemoPrefix ? value.slice(5) : value;
  return value.slice(0, 9) + '…' + value.slice(-5);
}

function formatNanoAmount(raw, keepDecimalZero = false) {
  try {
    const value = BigInt(raw);
    const whole = value / 10n ** 30n;
    const fraction = (value % 10n ** 30n).toString().padStart(30, '0').replace(/0+$/, '');
    const decimals = fraction ? '.' + fraction : keepDecimalZero ? '.0' : '';
    return whole.toString() + decimals + ' XNO';
  } catch {
    return keepDecimalZero ? 'amount unavailable' : 'amount unknown';
  }
}
