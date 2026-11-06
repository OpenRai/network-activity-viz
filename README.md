# Nano network activity visualizations

A collection of independent, live-capable visualizations of Nano network activity. Open `index.html` to start at the starmap, then use the bottom gallery bar to move between pages. Each selection loads a separate HTML document.

## Gallery

- **Starmap** — active accounts and observed transfers in a constellation view.
- **Constellation** — account relationships and transfer links.
- **Hangtime** — independent send and receive observations over time.
- **Score** — account-chain activity.
- **Lattice** — blocks arranged along account chains.
- **Send mountains** — confirmed send amounts as a live density landscape.

The visualizations can run in demo mode or connect to supported Nano websocket feeds. Live timestamps represent the local observer's receipt time; a feed may restrict topics or all-account subscriptions.

## Build

Requires Node.js 20 or newer. No package installation is needed.

```sh
npm run build
```

The static site is written to `dist/`. The build includes only the HTML pages and shared JavaScript used by the site; it omits tests, diagnostics, and generated stress-demo recordings.

To run the unit tests locally, install Bun and run:

```sh
bun test
```

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds and deploys `dist/` on pushes to `main`. Pull requests run the build without deploying. The site is hosted at https://viz.openrai.org/ through GitHub Pages, with Cloudflare managing its DNS.
