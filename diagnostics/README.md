# Websocket investigation, 2026-11-05

The existing shared client implements Nano subscriptions and application ping/pong directly. Nano documentation: https://docs.nano.org/integration-guides/websockets/

Published packages inspected and exercised: @openrai/nano-core 3.6.0 (WsEndpointPool.connect) and nano-sdk 1.0.7 (WebSocketClient). The former hands back a native WebSocket after connection; it does not maintain the subscription. The latter reconnects closed sockets but does not automatically detect a confirmation stream that stops while pongs continue. No claim of npm popularity is made for either package.

Each three-minute run used six simultaneous connections: all three clients against nanoslo and rainstorm.city, with identical confirmation/election-info and vote subscriptions and application pings. This is a Bun runtime comparison, not a browser-only reproduction. Counts vary between independent connections; they are not a completeness measurement. Shared-client pongs are consumed internally and therefore show zero in the harness counter; its status reports heartbeat results.

Baseline: nanoslo shared received 3 confirmations, Nano Core 2, nano-sdk 0. Both package connections received 12 pongs; the old shared connection also remained heartbeat-healthy. Rainstorm rejected all-account subscriptions: "Subscribe to ALL not allowed. Please include an array of accounts."

Patched shared client renews after 45 seconds without confirmations, even with healthy pongs or incoming votes, and labels the observation gap. It resumed receiving confirmations after renewal while the package connections remained idle. This is a recovery workaround; the underlying nanoslo/proxy failure is not established. A genuinely quiet network can also cause renewal, and missed historical events are not recovered.

The final source additionally retains uncorrelated endpoint errors across pongs and avoids renewal loops when the endpoint explicitly rejects all-account subscriptions. Those refinements were made after the live recovery run started and are covered by unit tests.

The open user browser was not reloaded or reconnected by these experiments. Source changes take effect on the next page load.

Reproduce: install @openrai/nano-core@3.6.0 and nano-sdk@1.0.7 in a parent directory discoverable by Bun, then run `bun diagnostics/compare-ws.mjs`. Published package sources were unpacked directly into /tmp for the original runs. Baseline and recovery JSONL logs are retained here.
