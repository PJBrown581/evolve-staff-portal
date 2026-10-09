# Energy Exchange at Evolve - Staff schedule (SANDBOX)

Static staff sign-in page for the Energy Exchange crew. Plain HTML/CSS/JS, no build step. Served by GitHub Pages.
Staff sign in with a user ID + password (no Google account needed) and see their shifts, open shifts, availability and time off.

## How it works
- The page calls the Staff Portal Apps Script web app (`API_URL` in `config.js`) as a JSON API:
  `POST` with `Content-Type: text/plain` (no CORS preflight) and `credentials: 'omit'`, so **no Google cookies are sent**.
  That is why it works whether the visitor has zero, one or several Google accounts signed in.
- Apps Script answers with a 302 to `script.googleusercontent.com`, which returns the JSON with `Access-Control-Allow-Origin: *`.
- The session token is sent only in the JSON body (never in a URL), kept in `sessionStorage`, or `localStorage` when
  "Keep me signed in" is checked.
- All rules (sessions, lockout, generic errors, audit) are enforced server-side by the portal script. This repo holds no data or secrets.

## Files
- `index.html` - page shell + strict Content-Security-Policy (scripts/styles/images/fonts from this site only;
  network calls only to script.google.com and script.googleusercontent.com).
- `config.js` - `API_URL` (the only setting).
- `app.js` - the app. `styles.css` - Evolve brand styles. `img/` - Iris's brand files. `fonts/` - self-hosted Jost, Inter,
  Crimson Text (SIL Open Font License 1.1, from Google Fonts).
- `.nojekyll` - serve files as-is.

## Publish (GitHub Pages)
New public repo `evolve-staff-portal`, push the contents of this folder to `main`, then
Settings > Pages > Source: Deploy from a branch > `main` / `(root)`. The site appears at
`https://<github-user>.github.io/evolve-staff-portal/`.

SANDBOX (test version). No pay or dollar amounts. Nothing is texted or emailed.

## Framing / clickjacking (known limitation)
GitHub Pages can't send response headers, so there is no `X-Frame-Options` or CSP `frame-ancestors` (browsers ignore
`frame-ancestors` in a `<meta>` CSP). Mitigation: the page starts hidden (`html.fb-wait`) and `app.js` reveals it only
when `top === self`; inside a frame it stays blank and tries to navigate the top window to itself. With JavaScript off
the page shows only the "needs JavaScript" note (noscript.css). The full fix is a host that sends headers.
