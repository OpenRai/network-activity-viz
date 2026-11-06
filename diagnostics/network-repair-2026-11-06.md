# Network source repair — 2026-11-06

Fresh probes: nanoslo did not open within the initial 15-second sample; nanos.cc and powernode failed connection; rainstorm explicitly rejected all-account subscriptions. SomeNano /websocket replied to pings without delivering the global feed. Its documented all-network endpoint is /repeater: https://node.somenano.com/#node-repeater

A real client bug was then reproduced in the browser: Nano.to sends binary JSON websocket frames. Bun implicitly converted these payloads for JSON.parse during the raw probe, while browsers delivered Blobs that the old JSON.parse(event.data) silently discarded. The shared client now requests ArrayBuffers and decodes binary data, with a Blob fallback and a stale-socket guard after asynchronous decoding.

The actual SomeNano repeater envelope is {topic: confirmation, blocks: [...], duration: 5000}, not necessarily the older documented block_dump wrapper. Both wrappers and native confirmations are accepted. Repeater liveness uses incoming events; it does not require application pongs or subscribe to votes.

Fresh browser verification after the repair: after 40 seconds, both ws.nano.to and node.somenano.com/repeater had delivered 6 sends and 2 receives, drawn as 9 accounts / 6 links. Nano.to also delivered votes; heartbeat RTT was approximately 300 ms. This is a short functional verification, not a long-running availability guarantee. Idle recovery remains enabled.

All six visualizers now default to ws.nano.to. Starmap additionally offers the SomeNano network repeater. Restricted/failed global-feed presets were removed; custom websocket URLs remain supported. Existing observer tabs were not reloaded.

Regression suite: 30 tests passed, including binary JSON, Blob pongs, stale asynchronous frames, and repeater batches.
