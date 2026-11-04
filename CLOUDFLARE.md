# Hosting on Cloudflare Pages

The site is built by `scripts/build_site.py` into `dist/` (the app files, `data/`,
`textures/`, a `data/manifest.json` listing the colour files, and a `_headers` file).

## Settings (Workers & Pages → Create → Pages → Connect to Git)

| Setting | Value |
|---|---|
| Repository | `HC-SAMI/colorsamificator` (works while private) |
| Production branch | `main` |
| Framework preset | None |
| Build command | `python3 scripts/build_site.py` |
| Build output directory | `dist` |

Every push to `main` (including the app's own "Sync to GitHub" commits) rebuilds and
redeploys the site, usually within a minute.

## After the first deploy
1. Open the `*.pages.dev` address and check that the colours load.
2. In the app, Sync settings keep working unchanged (they talk to the GitHub API with your token;
   the token needs access to the private repo).
3. Put a login in front of the site (Zero Trust → Access → Applications) before making the repo
   private, and set the Android app's `APP_URL` to the new address.
