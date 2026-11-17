'use strict';
// Preserve the old 60 Hz response while using elapsed time at other refresh rates.
function netloomCameraEase(milliseconds) {
  return 1-Math.pow(.88,Math.max(0,Math.min(250,milliseconds))/(1000/60));
}
