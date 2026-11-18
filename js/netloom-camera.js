'use strict';
// Preserve the old 60 Hz response while using elapsed time at other refresh rates.
function netloomCameraEase(milliseconds) {
  return 1-Math.pow(.88,Math.max(0,Math.min(250,milliseconds))/(1000/60));
}

function netloomDefaultFraming(width, height) {
  // Blend into a closer crop on tall screens, centering the active amount bands.
  const portrait = Math.max(0, Math.min(1, (0.85 - width / height) / 0.33));
  return {
    scale: Math.min(width / 1450, height / 850) * 1.35 * (1 + 1.55 * portrait),
    focusY: 970 - 450 * portrait,
    anchorX: width * (0.94 - 0.22 * portrait),
    anchorY: (height - 68) * (0.84 - 0.29 * portrait),
  };
}
