# Remaining NetLoom optimization sequence

This sequence implements and evaluates adaptive polyphony, GPU/compositor investigation, audio-clock arpeggios, viewport/label culling, native sustained voices, time-based camera smoothing and OffscreenCanvas rendering. Six items are enabled or measured normally; OffscreenCanvas remains opt-in after a measured regression. Each step is compared against a diagnostic switch before proceeding. Prior iteration reports remain in the parent directory.

Measurements use a visible Chromium tab driven by ego-browser, seeded scenarios and no continuous screenshots. Raw artifacts are in `/private/tmp/netloom-final/`. Safari user recordings are separate evidence, not mixed into these lab numbers. No physical GPU execution time or phone battery claim is inferred from renderer-thread durations.

## Pair 1: voice allocation and compositor investigation

`voicePolicy=0` retains fixed capacity rejection; `voicePolicy=1` protects fundamentals, omits excess supporting harmonics and fades the oldest lower-priority voices over 20 ms. Active plus preparing voices stay at 28; at most four retiring voices briefly overlap. Reduced harmonics do not boost the remaining fundamental's gain. All retiring sources are stopped and disconnected on Sound disable/context release. The original Starmap path retains its existing allocation.

At five sends/second plus generated receives over 20 seconds, the original policy voiced 65/162 event fundamentals; adaptive allocation voiced 162/162. This is not a guarantee that every event remains audible under unbounded bursts. The bounded worker queue and 32-source hard ceiling remain protection limits. See final polyphony JSON for current output and counters.

Compositor trace (`gpu-baseline.json`, 7.5 seconds with zoom input): raster decoding p95 2.86 ms, GPU-process command flush p95 4.94 ms, renderer layer update p95 2.21 ms and compositor draw p95 0.54 ms. Nested events overlap and their totals must not be summed. This establishes a baseline for later culling/offscreen comparisons; it does not measure hardware GPU shader execution time.

## Pair 2: audio-clock arpeggios and culling

Signal Loom prepares its layers immediately and schedules starts 190 ms apart with a 120 ms audio-clock lookahead. The diagnostic `audioClock=0` path retains JS timer dispatch for comparison. In the 20-second sample, p95 note lateness relative to the intended schedule fell from 46.3 ms to zero. Disabling sound cancels already scheduled future sources.

Viewport culling uses a conservative inverse-transform rectangle, so paths that cross the viewport remain visible even when their endpoints are outside. Labels below six projected pixels are hidden; an occupancy grid suppresses overlaps, prioritizing newer labels. Compared with `cullScene=0`, a 600-history-block workload reduced median drawn labels from 557 to 23 and marks from 678 to 371; paint p95 fell from 3.3 ms to 2.4 ms. Content and transfer relationships remain in the layout/cache when culled.

## Pair 3: native sustain and elapsed-time camera easing

Signal Loom now uses native periodic-wave oscillators for sustained layers, with event-derived pitch/partials and the existing ADSR/filter/shared-effects envelopes. Circuit Weave, Neon Pulse and Handset Solace retain ZzFX textures. `nativeSustain=0` preserves the worker-buffer path for A/B measurement. In matched 20-second Signal Loom runs, both voiced all 69 event fundamentals; the native path generated no sample buffers versus 39 buffers / 25.2 MB retained on the ZzFX path. End-of-run RMS was comparable (0.092 versus 0.088). This deliberately changes Signal Loom's timbre slightly and is not presented as identical waveform output.

Camera easing uses `1 - 0.88^(dt/(1000/60))`, matching the old 60 Hz response while making settling duration depend on elapsed time. It applies to pointer drift and reset, with reduced-motion mode settling immediately. The reset trial in the ~30 Hz browser took 914 ms versus 1865 ms for fixed-per-frame easing. Mathematical tests verify equivalent residual error after one second at 30, 60 and 120 Hz. `cameraTime=0` retains the fixed easing only for diagnostics.

## Final item: OffscreenCanvas rendering

The same painter runs either on the main thread or in a dedicated render worker. The worker receives a scene snapshot only when layout changes, has one frame in flight and one replaceable pending frame, and reports actual paint duration separately from submission time and round-trip latency. Initialization, worker errors and timeouts fall back to a fresh main-thread canvas. Page suspension terminates the worker; restoration transfers a fresh canvas to a new worker. Browsers without transferable canvases and file URLs use the main painter.

Matched 20-second runs exposed a regression: main-thread painting delivered 515 paints, versus 69 worker paints. Main-thread frame interval p99 was 50.6 ms; the worker path reached 1016.7 ms despite the page reporting visible and focused. Worker submission p95 was lower (1.4 versus 2.4 ms), but actual worker paint p95 was 3.5 ms and round-trip p95 9.1 ms. A separate experiment using worker requestAnimationFrame still reached approximately one-second gaps. The exact browser scheduling cause remains unproven. The final worker paints directly on message dispatch; adding a second animation-frame scheduler gave no benefit.

Consequently, **main-thread painting remains the default**. `?offscreen=1` explicitly enables the experimental worker for further device/browser comparisons. This evaluates the seventh proposed optimization without enabling a measured regression. It does not claim that OffscreenCanvas improves this workload. Deterministic screenshots of a populated 600-entry scene matched exactly (zero different pixels), and browser lifecycle checks confirmed zero render-worker targets after pagehide and a fresh worker after pageshow.

## Combined validation

The default path was tested at 1163 × 701 CSS pixels, DPR 2, with 600 history entries and five simulated sends per second plus linked receives, over 20 seconds. Signal Loom voiced all 164 requested event fundamentals, with zero measured arpeggio lateness, 28 active voices at the endpoint, no pending synthesis jobs and no generated sample buffers. Paint p95 was 2.1 ms, layout p95 1.6 ms and frame interval p95 49.9 ms. The run included wheel zoom; a separate double-click reset returned the camera to its exact default position. These Chromium results are not a promise of 60 FPS on every device.

A second combined run used Neon Pulse to exercise worker-based ZzFX synthesis: 162 simulation sound requests, 163 event fundamentals including an overlapping opt-in preview cue, no reported synthesis/render errors, 28 active voices at the endpoint and 16.8 MB of retained sample buffers. The synthesis worker was inactive with zero pending jobs at the endpoint. The extra preview cue means these counters are not a clean per-event equality comparison.

After an 18-second quiet run, voices, retiring voices, scheduled voices, preparation jobs, effect buses and effect tails were all zero. Pagehide released the audio context and stopped rendering; pageshow recreated the opted-in audio context and resumed rendering. The original Starmap sound path passed its regression checks.

Validation: `bun test` passed all 83 tests / 707 assertions; `bun scripts/build.mjs` built all nine pages; `git diff --check` passed. No commit or push was performed. Source and generated worker scripts are included by the static build. This final pass was measured in Chromium; fresh Safari and iPhone listening/performance checks remain useful device validation, especially for the changed Signal Loom timbre.

Condensed measurements, conditions, counters and endpoint state are preserved in [measurements.json](measurements.json); GPU/compositor measurements are in [gpu-baseline.json](gpu-baseline.json). Large raw traces and screenshots remain in `/private/tmp/netloom-final/`.

## Repeating a comparison

Serve the repository on port 8000 and open `http://127.0.0.1:8000/netloom.html?perf=1`. Select the preset and enable Sound through the UI when testing audio, then wait for the opt-in preview cue to finish before beginning. In the console:

```js
netloomPerf.start({rate:5,seconds:20,audio:true,history:600});
// After 20 seconds:
netloomPerf.export();
```

Reload between variants. For a no-audio drawing comparison use `audio:false`. Retain the same viewport, device scale, preset, volume and fixture parameters. Diagnostic query switches `voicePolicy=0`, `audioClock=0`, `nativeSustain=0`, `cullScene=0` and `cameraTime=0` restore the respective comparison path only when `perf=1` is present. `offscreen=1` enables the experimental rendering worker independently of diagnostics. No continuous screenshots or open performance timeline were used during these timing runs.
