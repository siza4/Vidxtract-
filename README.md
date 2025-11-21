# Selakw Xtract — Neon Edition

**Selakw Xtract** is a client-side, neon-styled, multi-platform video downloader UI designed for GitHub Pages.  
It attempts to resolve public video links (Facebook Reels, TikTok, Instagram, YouTube metadata, Twitter/X) and present downloadable formats (MP4/WEBM/MP3) where available.

> ⚠️ This tool uses public resolvers and proxy fallbacks. Some platforms actively block direct downloads — this project uses best-effort client-side parsing and fallback links.

---

## Features

- Neon glass UI + Vanta Waves animated background
- Auto platform detection (FB, IG, TikTok, YouTube, X)
- Thumbnail, title and duration preview (when available)
- Smart quality selector (480p / 720p / 1080p / 4K if available)
- Rewarded popup (simulated) before download
- Fake progress animation
- Floating mini-player preview
- Local download history (localStorage)
- Fully client-side, GitHub Pages ready

---

## Files

- `index.html` — main UI
- `style.css` — styling
- `script.js` — UI + resolver logic
- `logo.svg`, `banner.svg` — branding assets
- Several policy pages are included inline in `index.html`

---

## Quick Start (GitHub Pages)

1. Create a new repository on GitHub.
2. Upload `index.html`, `style.css`, `script.js`, `logo.svg`, and `banner.svg` to the repository root.
3. Go to **Settings → Pages** and enable GitHub Pages (branch: `main`, folder: `/root`).
4. Visit `https://your-username.github.io/your-repo/`.

> For local testing, run a local HTTP server (not `file:///`):
> - `python -m http.server 8080`
> - or `npx serve`

---

## How it works

- The client uses platform-specific resolver attempts (Snapsave for Facebook/Instagram, ssstik for TikTok, twdown for Twitter) and uses **AllOrigins** as a GET proxy fallback to bypass CORS when needed.
- If automatic extraction fails the UI shows a **Open manual resolver** button so the user can finish the download on the resolver website.

---

## Legal Notice

This tool is for **educational purposes**. Download only media you have rights to. The author is not responsible for misuse.

---

## Contact

For issues: **akachrizzney@gmail.com**

If you want a Cloudflare Worker proxy for better reliability (recommended), ask me and I’ll provide the worker code + deploy steps.
