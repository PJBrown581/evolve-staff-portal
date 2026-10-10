# Evolve · Daily SOPs (SANDBOX): static staff page

Built from the SOP branch (`/workspace/ops-board/sandbox-sop-runs`, `tools/build_pages.js`). Do not edit by hand.
Same app as the Apps Script staff portal. Here it talks to the portal's JSON API (`config.js`: `SOP_API_URL`) with
`fetch(..., {method:'POST', credentials:'omit'})` and a text/plain body, so no Google cookies are sent and it works on phones
signed in to several Google accounts. The session token travels in the JSON body only (never in a URL). It is kept in
sessionStorage, or localStorage with "Keep me signed in" (keys `sop_tok`, `sop_uid`, `sop_dev:<user id>`).
Every rule (PBKDF2 passwords, sessions, throttle, role and shift checks, privacy) is enforced by the portal script. Nothing secret lives here.
SANDBOX. No money amounts. Floor checklists only.
