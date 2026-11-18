# NetLoom: background synthesis and interpolated painting

## Changes

Uncached ZzFX sample generation runs in one lazy dedicated worker. ArrayBuffers are transferred back, converted to AudioBuffers, and retained by the existing bounded cache. Identical pending requests are coalesced; at most 16 distinct worker jobs and 28 active/preparing voices are admitted. Two-second job timeouts reject outstanding work; voices whose result arrives over 1.5 seconds late are dropped. Disabling sound, changing presets, releasing the context or disposing the engine cancels pending work and increments a generation token so late replies cannot play or repopulate the cache. The worker terminates after five seconds idle. Unsupported workers and file URLs retain foreground synthesis; a worker failure switches subsequent cues to the foreground fallback. Starmap continues using its original synth.

Rendering separates the 10 Hz layout update (amount sorting, band mapping and source-link lookup) from painting. Block positions and axis amounts interpolate between layouts; marks, pulse and fade paint at up to 30 Hz. Cached plane translation still runs every animation frame. Reduced-motion mode keeps the previous painting cadence. This increases visual update frequency with some additional paint work; it is not claimed to reduce total drawing CPU.

## Reproduction

Use a visible Chromium tab, 1163×701 CSS pixels, DPR 2, Neon Pulse, local server port 8000, browser cache disabled. Reload between runs, enable sound through the checkbox for activation, then disable the preview engine immediately before starting the diagnostic scenario to clear its cache and outstanding work. Three 20-second runs per condition, five seeded send transfers/second plus generated receives:

- Audio before: `?perf=1&workerSynthesis=0&smoothScene=0`.
- Audio after: `?perf=1&workerSynthesis=1&smoothScene=0`.
- Graphics before: `?perf=1&workerSynthesis=1&smoothScene=0`, sound off and `history:600`.
- Graphics after: `?perf=1&workerSynthesis=1&smoothScene=1`, sound off and `history:600`.

Call `netloomPerf.start({rate:5,seconds:20,audio:true})`, or `audio:false,history:600` for graphics. Save `netloomPerf.export()` and four snapshots spaced five seconds apart. The main-thread `synthesis` measurement should disappear on the worker path; `workerSynthesis` measures worker computation and `synthesisLatency` includes queue/transfer overhead. `canvasBuild` measures painting only; add its total to `layout.total` and divide by duration to compare drawing work per second. `bandStepPixels` measures the maximum logical Y-position movement between paints, not screen-space gesture latency.

Raw artifacts for this execution: `/private/tmp/netloom-optimization-3/`. No Timeline screenshots or continuous video capture were enabled during these benchmarks. The observed ~30 Hz animation-frame cadence is an environment constraint; these runs do not establish 60 FPS or GPU cost.

## Measurements

Medians of three runs; see the adjacent JSON summary for exact values:

| Metric | Before | After |
|---|---:|---:|
| Audio-enabled frame interval p99 | 1033 ms | 50.1 ms |
| Recorded main-thread synthesis calls, all runs | 139 | 0 |
| Recorded long tasks, all audio runs | 31 | 0 |
| Worker result latency p95 | — | 82.1 ms |
| Graphics paint frequency | 9.4 Hz | 26.2 Hz |
| Band position-step p95 | 1.62 logical px | 0.55 logical px |
| Graphics paint call p95 | 3.9 ms | 3.7 ms |
| Layout + paint work per second | 38.8 ms | 73.1 ms |

Audio clocks tracked wall time in both conditions because shared effects from the prior iteration remain enabled. The worker removes the remaining main-thread synthesis stalls in these short trials. It does not eliminate intentionally dropped notes at the polyphony budget or guarantee identical performance on Safari hardware. Worker generation still consumes CPU, now on a separate thread; queue/transfer latency remains part of sound onset.

Graphics interpolate more often with smaller positional steps and no measured frame-interval regression (p99 50.5 ms in both graphics conditions). The cost is about 34 ms more main-thread drawing work per second, roughly 3.4 percentage points of one core. This is a smoothness improvement within the measured paint budget, not a total-CPU reduction. Further GPU/compositor measurements and user review are still needed.

## Lifecycle and deployment validation

Thirteen focused tests pass (104 assertions): the existing original-synth opt-in/polyphony/cleanup/volume invariants, finite NetLoom buffers, sample-cache reuse, shared effects, worker coalescing, cancellation, queue bounds, failure fallback and late-result rejection. A preset-switching stress test exposed a stale worker-error race; handlers now detach on cancellation and check worker identity before touching the replacement. A subsequent browser run exercised Circuit Weave, Signal Loom, Neon Pulse and Handset Solace with `workerEnabled:true`, nonzero output and zero worker errors for every preset.

Real-browser cancellation stopped three preparing voices / three worker jobs with zero sources, buffers or effects created by late results. With both optimizations enabled and 600 historical blocks, the combined run recorded p99 frame interval 51.2 ms, paint p95 3.1 ms and worker-latency p95 75.2 ms. Wheel zoom and background double-click reset were exercised during that run. The final screenshot was visually checked.

After 18 seconds idle, active/preparing/scheduled voices, worker jobs and effects buses were all zero; `workerActive:false` and an empty browser worker-target list confirmed thread teardown. Playback resumed without toggling Sound and produced output RMS 0.173. Existing buffers remained inside the 32 MiB sample-cache limit. Raw checks are in `combined-recovery.json` beside the benchmark files.

The production copy build (`bun scripts/build.mjs`) passes and includes both worker resources. NetLoom uses new script version URLs to avoid reusing the earlier implementations. Safari/iPhone verification of this iteration remains pending.
