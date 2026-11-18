# NetLoom: shared effects and marker-label cache

## Changes

NetLoom now mixes filtered voices into one delay/reverb/compressor bus per audio context, followed by its existing master safety stage. Individual pitch, envelopes and filters are retained. Unlike independent reverbs, the shared ambience and compression respond to the combined mix; delay modulation is now a fixed bus setting rather than an independent delay per event. Voices disconnect immediately after ending. The shared bus retains the final tail, then disconnects after an idle period (reverb duration + 5 seconds, capped at 20 seconds). Context release and preset change also disconnect it. NetLoom's original per-layer path remains available only in diagnostics for comparisons; Starmap uses its original synth path.

The graphics optimization stores each marker's hash-derived seed and formatted caption/account label for the lifetime of that marker. It changes no label content or placement. Cached data is discarded with the marker.

## Conditions and reproduction

Chromium 156 via ego-browser, visible tab, 1163×701 CSS pixels, DPR 2, Neon Pulse. Sample-buffer and static-grid caching from the prior iteration are enabled for both conditions. Three cold-page runs per condition, each using a seeded 20-second workload of five send transfers/second plus generated receives. Four audio-clock/output checkpoints per run are spaced five seconds apart. Short runs include cold-cache synthesis and do not establish a 60 FPS budget.

- Audio before: `?perf=1&sharedEffects=0&labelCache=0`, `netloomPerf.start({rate:5,seconds:20,audio:true})`.
- Audio after: same with `sharedEffects=1`.
- Graphics before: `?perf=1&sharedEffects=1&labelCache=0`, `netloomPerf.start({rate:5,seconds:20,audio:false,history:600})`.
- Graphics after: same with `labelCache=1`.

Enable sound through its checkbox before starting audio scenarios. Disable the browser cache and reload between runs. Results are exported using `netloomPerf.export()`; the runner also saves four `snapshot().state.audio` checkpoints with wall times. Raw run artifacts: `/private/tmp/netloom-optimization-2/`.

An analyser at the final output is enabled only in diagnostic NetLoom sessions. Nonzero RMS establishes a generated signal, not successful delivery to a physical speaker. Audio-clock/wall-clock ratios compare the first and last checkpoints and exclude initial activation time.

## Results

Medians across three runs (all raw measurements are summarized in the adjacent JSON):

| Metric | Before | After |
|---|---:|---:|
| Audio clock / wall clock | 0.285× | 1.000× |
| Graphics rebuild p50, 600 initial historical blocks | 4.7 ms | 3.8 ms |
| Graphics rebuild p95 | 6.1 ms | 4.7 ms |
| Graphics-only frame interval p99 | 50.3 ms | 50.1 ms |
| Audio-enabled frame interval p99 | 1033 ms | 1049 ms |

All shared-bus audio checkpoints had one effects bus and nonzero final-output RMS (0.051–0.268). The old graph's audio-clock ratios ranged from 0.192× to 0.342×; the new graph ranged from 0.9996× to 1.00004×. Capacity rejections remain (328 across the three new runs versus 420 before), and audio-enabled frame stalls remain. This optimization addresses audio-renderer progression and graph growth, not all synthesis or polyphony bottlenecks.

Marker metadata caching reduces median rebuild time about 19% and p95 about 23% in the populated workload. It does not establish higher frame rates or smoother gestures. The corrected graphics fixture uses distinct historical hashes; preliminary files without `corrected` in their names are superseded because history/live hashes overlapped and suppressed incoming events. Corrected runs all ended with 762 markers.

Validation: seven focused audio tests pass (72 assertions), covering the original synth opt-in/polyphony/cleanup and volume invariant, finite NetLoom output, sample-buffer reuse, and shared-convolver lifecycle. Safari's supplied Timeline recording motivated this change, but this iteration measures Chromium; iPhone 13/Safari tab-crash resolution remains unverified on hardware.

The final combined run used both optimizations with 600 historical blocks. After 20 seconds the output RMS was 0.188 and the audio clock had advanced 20.096 seconds. Following an 18-second quiet period, voices, pending voices, effects buses and per-layer tails were all zero. Restarting event playback produced RMS 0.149 and one bus without toggling Sound; the clock continued to advance normally. The bounded sample cache remained retained across idle, as intended. A screenshot confirmed the resulting scene renders correctly.
