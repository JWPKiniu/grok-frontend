# Private Grok Studio

A private React/Vite interface for the current xAI Imagine APIs:

- text to image;
- image editing;
- image to video.

The deployed app has two separate locks:

1. an owner password verified only by the server, which protects every xAI proxy request;
2. an xAI API key kept in `sessionStorage`, so it disappears when the tab is closed or the app is locked.

## Privacy model

- Generated files are not saved in this app, placed in a gallery, or sent to analytics.
- The app requests ephemeral xAI media URLs. The authenticated proxy validates the owner before handing the browser to the short-lived xAI file, avoiding Vercel's 4.5 MB response limit.
- Proxy responses use `Cache-Control: private, no-store`.
- Large input images are resized/compressed locally in the browser before they are sent.
- Search indexing, framing, referrers, third-party fonts, and Vercel Web Analytics are disabled.
- xAI still necessarily receives prompts and source images/videos to perform generation and applies its own service policies.

The repository contains only a SHA-256 digest of the owner password, never its plaintext. Use a long, random password; a weak password can be guessed offline from the public digest.

## Current API models

- Images: `grok-imagine-image-quality`
- Video: `grok-imagine-video-1.5`

The response parser accepts both URL and Base64 image responses. Video polling handles current pending, completed, expired, failed, and transient rate-limit/server states.

## Local setup

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`, enter the private-access password, and then enter an xAI API key.

Useful checks:

```bash
npm run lint
npm test
npm run build
```

## Rotate the private-access password

Generate a high-entropy password and its digest locally:

```bash
node -e 'const c=require("node:crypto");const p=c.randomBytes(24).toString("base64url");console.log("password:",p);console.log("sha256:",c.createHash("sha256").update(p).digest("hex"))'
```

Keep the password private. Replace `OWNER_PASSWORD_SHA256` in both `api/auth.ts` and `api/proxy.ts` with the generated digest.

## Vercel deployment

`vercel.json` configures the SPA rewrite, private/no-store API responses, security headers, and Function timeouts. The owner-password gate is application-level, so it protects production independently of Vercel plan-specific deployment protection.

Required GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## License

MIT — see [LICENSE](LICENSE).
