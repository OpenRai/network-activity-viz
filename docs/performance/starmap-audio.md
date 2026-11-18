# Starmap audio synthesis profiling

Chromium 156 via ego-browser, foreground, 1163 × 701 CSS pixels, DPR 2, Starlight ascent, 100% volume, sparkles enabled. Each capture used the seeded 30× stress replay with audio on and 14 seconds of measurement. The outside-receive comparison stripped receive links from the same fixture to exercise the longer filtered-noise cue.

Start the page with `?perf=1&stress=ready`, enable Sound through the UI, and run `await starmapPerf.start({audio:true,outsideReceives:false})`. After the capture ends, use `starmapPerf.export()`. Reload between runs. Repeat with `outsideReceives:true` for the second scenario. Raw captures are under `artifacts/starmap-audio/` in the local workspace.

The legacy engine recalculated note frequencies, envelope constants and filter endpoints inside the sample loop. It also evaluated modulation on tones that did not use it, and advanced an oscillator phase that only Velvet reads. The optimized path prepares constants once per cue and evaluates modulation and phase only where used. Both browser cases used the same preset and synthesizer settings.

| Metric | Linked replay before → after | Outside-receive replay before → after |
|---|---:|---:|
| Voice starts during capture | 60 → 60 | 60 → 66 |
| Median synthesis time per voice | 13.9 → 6.7 ms (−52%) | 14.2 → 8.2 ms (−42%) |
| p95 synthesis time per voice | 30.7 → 12.3 ms (−60%) | 31.6 → 18.3 ms (−42%) |
| Total synthesis time | 1012.7 → 446.2 ms (−56%) | 1016.4 → 597.7 ms (−41%) |
| p95 outside-receive synthesis | — | 29.1 → 20.6 ms (−29%) |
| Browser long tasks | 10 → 2 | 9 → 2 |

All four captures processed 1,814 replay events and measured nonzero audio output. Stress playback still fills the existing polyphony cap. Frame pacing improved within these runs, but the browser also showed intermittent one-second frame gaps. This single trial per condition does not isolate the source of those gaps or establish an FPS gain.

All 22 sound tests passed. At fixed pitch jitter, direct before/after comparisons produced byte-identical sample buffers for 30 combinations across all five Starmap presets, three pitches, and both tone and outside-receive cues.

## Worker benchmark loop

The worker is available at `starmap.html?workerSynthesis=1`. For a matched capture, add `perf=1&stress=ready`, enable Sound in the page, and wait for the preview cue to end. Run `await starmapPerf.start({audio:true,rate:30,outsideReceives:false})`. Use `rate:1` for live-like pacing and `outsideReceives:true` to strip receive links from the fixture. After 14 seconds, export with `starmapPerf.export()`. Reload between captures and set `workerSynthesis=0` for the synchronous control.

These runs used Chromium 156, the settings above, and the same seeded replay. The 30× runs processed all 1,814 events. The 1× runs processed 74–78 events in 14 seconds. The first series started immediately after the Sound click, so an asynchronous preview can contribute one voice start. The filter experiment waited 2.3 seconds for that preview to finish. Raw captures from this workspace are in `artifacts/starmap-audio/worker-loop/`.

### Extraction, worker transfer, and deadlines

All timings are in milliseconds. Each cell lists **1× linked / 30× linked / 30× unmatched**. The transfer-only measurement used a temporary worker client that posted every admitted cue directly. Preparing voices counted toward the 12 slots in both worker variants. The bounded client dispatches one job at a time, expires work at 250 ms, and keeps fresher requests when an older job times out.

| Metric | Inlined synchronous | Shared generator, synchronous | Worker transfer only | Bounded worker, two trials |
|---|---:|---:|---:|---:|
| Main-thread synthesis p95 | 19.7 / 13.5 / 20.6 | 20.8 / 10.5 / 21.4 | 0 / 0 / 0 | 0 / 0 / 0 |
| Main-thread PCM allocation and copy p95 | — | — | 0.2 / 0.1 / 0.1 | 0.2 / 0.1 / 0.1 |
| Worker compute p95 | — | — | 19.0 / 11.2 / 13.0 | 19.0–19.7 / 10.9 / 12.5–13.5 |
| Worker queue and dispatch p95 | — | — | 15.1 / 68.8 / 78.1 | 6.6–18.5 / 76.0–102.6 / 68.8–78.2 |
| Request to playback scheduling p95 | — | 20.9 / 10.7 / 21.5 | 27.6 / 76.7 / 85.7 | 21.0–32.1 / 83.1–108.8 / 76.6–85.0 |
| Estimated device onset p95 | — | 42.2 / 32.0 / 42.8 | 48.9 / 98.0 / 107.0 | 42.3–53.4 / 104.4–130.1 / 97.9–106.3 |
| Frame interval p99 | 50.1 / 50.0 / 1033.2 | 1050.1 / 50.1 / 1016.7 | 50.3 / 50.0 / 50.0 | 50.1 / 50.0 / 50.0–50.1 |
| Browser long tasks | 2 / 2 / 2 | 11 / 1 / 4 | 0 / 0 / 0 | 0 / 0 / 0 |
| Capacity rejections | 12 / 1754 / 1747 | 8 / 1752 / 1754 | 9 / 1754 / 1745 | 9 / 1754 / 1744 |
| Deadline expirations | — | — | — | 0 / 0 / 0 |

Extraction alone showed no consistent change. Worker transfer removed the 10.5–21.4 ms p95 synchronous generation cost and introduced at most 0.2 ms p95 for the PCM copy. Deadline handling retained the same admission policy. Its linked stress scheduling p95 was 6.4–32.1 ms higher than transfer-only, and the other workloads varied in both directions. The live-like runs offered no evidence that changing cue priorities would recover useful cues. A controlled stall test covered deadline expiration because it did not occur during replay.

Estimated onset adds the audio context’s reported base and output latencies to the measured request-to-schedule time. It gives an estimate of device timing before the cue’s envelope rises. The synchronous captures had intermittent one-second frame gaps, and many runs had a roughly 50 ms p99 frame interval. The samples do not establish a general FPS gain.

### Unmatched-receive reuse

A temporary worker variant memoized the deterministic filtered noise, swell, and sweep multiplier for the last unmatched-receive duration, sample rate, and octave. Normal-motion unmatched receives use a fixed 1.1-second cue. The experiment retained a roughly 1.21 MiB shape at 48 kHz and evaluated pitch per cue. It produced byte-identical PCM for 90 comparisons across five presets, two sample rates, three durations, and three pitches.

| Metric | 1× unmatched, control → reuse | 30× unmatched, control → reuse | 30× unmatched repeat, control → reuse |
|---|---:|---:|---:|
| Worker compute p95 | 19.1 → 19.2 ms | 10.7 → 9.5 ms | 13.2 → 9.2 ms |
| Unmatched-receive worker compute p95 | — | — | 13.4 → 7.2 ms |
| Request to playback scheduling p95 | 20.5 → 21.4 ms | 33.7 → 24.4 ms | 32.9 → 27.4 ms |
| Estimated device onset p95 | 41.8 → 42.7 ms | 55.0 → 45.7 ms | 54.2 → 48.7 ms |
| Capacity rejections | 2 → 2 | 1738 → 1736 | 1738 → 1736 |
| Frame interval p99 | 50.8 → 51.0 ms | 51.2 → 50.7 ms | 50.7 → 50.5 ms |

The reuse savings appeared in the accelerated workload. The live-like run showed no onset benefit, so the production worker keeps the existing generator. A PCM cache would need to account for event pitch and jitter. Native Web Audio voices remain deferred pending a listening check of worker scheduling.

### Rollout validation

The worker remains opt-in pending a fresh Safari trace and listening check. Safari WebDriver could not create a session because Allow Remote Automation was disabled. Chromium measured nonzero output in both paths. The Bun suite checks byte-identical worker and fallback PCM for all five presets and unmatched receives, bounded polyphony, expiration, stale replies on disable and context replacement, and synchronous fallback on file URLs and browsers without Worker support.
