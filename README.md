# Neon Arcade 50

A React + Vite single-page game arcade — an Endless Wing (chase a high score)
and a Challenge Room (games with a real ending). Mobile-friendly, with
synthesized sound effects/music (Web Audio API, no audio files) and
per-game high scores saved to the browser's `localStorage`.

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```bash
npm run build
```

Outputs a static site to `dist/`. This is the only folder Cloudflare needs —
it's plain HTML/JS, no server required.

## Deploying to Cloudflare Pages

### Option A — connect a Git repo (recommended for ongoing updates)

1. Push this project to a GitHub/GitLab repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo, then set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Deploy. Every future push to the branch redeploys automatically.

### Option B — direct upload (no Git needed)

1. Build locally: `npm run build`
2. Install Wrangler if you don't have it: `npm install -g wrangler`
3. Deploy the `dist` folder directly:
   ```bash
   npx wrangler pages deploy dist --project-name=neon-arcade-50
   ```
4. Follow the prompt to log in to Cloudflare the first time. Subsequent
   deploys just re-run the same command.

Either way you'll get a `*.pages.dev` URL, with the option to attach a
custom domain afterward in the Cloudflare dashboard.

## Notes

- High scores are stored per-browser via `localStorage` — clearing site
  data or switching browsers/devices resets them. There's no backend.
- All audio is generated live with the Web Audio API, so there's nothing
  to host or preload for sound.
- No routing library is used (it's a single page with in-app view state),
  so no Cloudflare Pages `_redirects` file is needed.
