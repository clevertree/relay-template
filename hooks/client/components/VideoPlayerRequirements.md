### VideoPlayer Requirements and Implementation Plan

#### Goals
- Provide a unified `VideoPlayer` React component for the web client that can play media from standard URLs as well as decentralized sources like `torrent://` and `ipfs://`.
- Make `VideoPlayer` available inside markdown content rendered by `markdown-to-jsx`, enabling usage like:

```
<VideoPlayer src="torrent://<INFO_HASH>" />
```

#### Props
- `src: string` — media source. Supported:
  - `http(s)://...` (direct HLS/MP4)
  - `torrent://<infoHash>` (BitTorrent info hash; hex/base32 accepted)
  - `magnet:?xt=urn:btih:...` (optional support route)
  - `ipfs://<cid>`
- `subtitles?: { src: string; label?: string; lang?: string; default?: boolean }[]`
- `poster?: string`
- `autoPlay?: boolean` (default: true)
- `controls?: boolean` (default: true)

#### UX States
The player should show a small status line above the video element:
- Locating peers — initializing torrent/IPFS client and discovery
- Downloading data — pieces are being fetched
- Ready — enough buffer available to start playback (auto-play if enabled)
- Error — display a concise error summary

#### Web Client Approach
- Lazy-load decentralized clients only when needed to reduce bundle size:
  - On first `torrent://`/`magnet:` usage, dynamically import a web torrent client (e.g., `webtorrent`) or a light wrapper.
  - On first `ipfs://` usage, dynamically import an IPFS HTTP client wrapper or resolve via a public gateway as a fallback.
- For MVP, a gateway approach is acceptable:
  - Torrent: resolve to an internal gateway route (`/gateway/torrent/{infoHash}`) that streams the largest video file in the torrent. The gateway can be implemented on the server later.
  - IPFS: resolve via a public gateway (e.g., `https://ipfs.io/ipfs/{cid}`) until a native client is integrated.
- Auto-play when ready; allow standard HTML5 controls.

#### Android/iOS Native Approach
- Embed native clients for torrent/IPFS to avoid relying on external gateways:
  - Torrent: integrate a native module (e.g., `android-ios-native-torrent-streamer` or custom native bridge) to fetch the torrent pieces and serve a local `file://` or `http://127.0.0.1:<port>` URL to the native `<Video>` component.
  - IPFS: embed an IPFS client (e.g., using `js-ipfs` with native bridges or a lightweight Go-IPFS mobile build) and expose a local streaming endpoint.
- Provide the same component API (`src`, `subtitles`, etc.) so markdown-driven content remains portable.

#### Markdown Integration
- Register `VideoPlayer` in `MarkdownRenderer` overrides so the following works inside stored markdown files:

```
<VideoPlayer src="torrent://abcdef0123456789abcdef0123456789abcdef01" />
```

#### Security and Performance Notes
- Avoid enabling arbitrary iframes or script execution inside markdown.
- Keep the base bundle small; only load torrent/IPFS libraries when required by `src`.
- Add timeouts and error states for unreachable gateways or stalled swarms.
- For torrent playback, prefer sequential streaming and select the largest video file automatically; later expose file selection UI if multiple files exist.

#### Future Enhancements
- Show real-time metrics: peers connected, download rate, buffer progress.
- Add a selectable list of available sources and qualities.
- Support external subtitle downloads and offset adjustments.
- Persist last playback position per source.
