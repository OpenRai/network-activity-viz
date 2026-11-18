# NetLoom: first isolated optimization measurements

Changes under comparison:

- Audio: LRU AudioBuffer cache capped at 128 entries / 32 MiB. Generation uses semitone-centered notes, with fine event pitch restored by playbackRate. Envelope and modulation parameters remain part of the cache key. Audio context release clears retained buffers. Cache misses still synthesize on the main thread.
- Graphics: render the opaque static grid once per resize at device resolution, then copy it during each scene rebuild. Dynamic blocks, paths, labels and glow retain their existing rendering.

## Reproduce

Serve the repository locally on port 8000. In ego-browser, enable Network.setCacheDisabled and use a visible tab at 1163×701 CSS pixels, deviceScaleFactor 2. Select Neon Pulse, then run:

```js
netloomPerf.start({rate:5,seconds:20,audio:true});
// After 20 seconds:
netloomPerf.export();
```

Reload between runs. Use these query strings:

- Audio before: `?perf=1&sampleCache=0&gridCache=0`
- Audio after: `?perf=1&sampleCache=1&gridCache=0`
- Graphics before: `?perf=1&sampleCache=1&gridCache=0`, with `audio:false`
- Graphics after: `?perf=1&sampleCache=1&gridCache=1`, with `audio:false`

Repeat each condition three times. The rate is **send transfers per second**; generated receive events increase total confirmation rate. Runs include cold-cache synthesis. Metrics reset when the scenario starts. These are short lab runs, not long-term resource or audible-output certification. Cache changes slightly transpose the sample envelope with playback pitch; synthetic micro-variation remains present.

Artifacts for this execution: `/private/tmp/netloom-optimization/*.json`.

## Results

Three 20-second runs per condition, Chromium 156, foreground tab. See the adjacent JSON summary for exact aggregates.

| Metric | Before | After |
|---|---:|---:|
| Audio layers synthesized, all runs | 201 | 73 |
| Audio layers reused, all runs | 0 | 137 |
| Audio-run p99 frame interval, median | 1050 ms | 1050 ms |
| Graphics-only median rebuild duration | 1.2 ms | 1.0 ms |
| Graphics-only p95 rebuild duration | 1.9 ms | 1.9 ms |
| Graphics-only p99 frame interval | 50 ms | 50 ms |

The cache serves 65% of generated layer requests and reduces synthesis calls by 64% in these runs. Peak retained sample buffers were 21,986,304 bytes. This does not fix the audio-clock slowdown, persistent capacity rejection, or one-second frame stalls. Repeated effects graphs remain the next audio investigation. Graphics caching reduces median command-issuance time about 17%, but offers no established p95 or frame-rate improvement. GPU/compositor time has not been measured here. The recurring ~33 ms median frame cadence remains an environment constraint requiring separate investigation.

Validation: three focused audio tests pass (41 assertions), including cache reuse/release, finite output for every current NetLoom preset, and the Starmap volume invariant. Browser screenshot confirms the grid and dynamic scene still render. No claims are made about audible quality or a permanent-silence fix.
