# JIA Media Desk

The JIA Media Desk opens on a home screen of app tiles (`index.html`, John 2026-10-03): Sunday Checklist, Live Camera, Program Team, Program Flow and Media Run Sheet (Drive links), and Demo, plus the "This Sunday" card. Its parts:

- `demo.html` is the public sample demo (moved from `index.html` on 2026-10-03; old demo links now land on the home screen). It has fictional service data and no account or shared storage. Demo changes reset when the page reloads.
- `live.html` is the online Sunday checklist. It connects to the team-owned `jia-media-desk` Firebase project on the Spark no-cost plan.
- `register.html` (+ `register.js`, `qrcode.js`) is a public event-registration demo for future events like the anniversary, modeled on abciyouth.online: Individual/Group, details, seating with seats left, GCash payment with screenshot, review, then a QR pass (Save QR image, Add to calendar). Sample data only; nothing is sent or saved online. The draft survives a refresh (sessionStorage). Apple Wallet is a placeholder: real passes need an Apple Developer account and a signing server. `qrcode.js` is qrcode-generator 1.4.4 (MIT, Kazuhiko Arase).
- `program.html` is a public Program Team preview with fictional calendar items and a reorderable Sunday flow. It saves changes in that browser only. It does not sync between devices, update Drive, or notify anyone. Do not enter real birthdays or private contact details.

## This Sunday reminders

The live page shows a "This Sunday" card for the coming Sunday in Manila time: Breaking of the Bread on the 1st and 3rd Sunday, homogeneous hosting and birthday celebrants on the last Sunday, and the weekly FB Live thumbnail. The rules are in `sunday-reminders.js` and come from Program Flow plus John's 2026-10-01 note. The card needs no sign-in or database. Confirm each Sunday against the Sunday Service Program in Drive.

## Live camera tally (trial)

`tally.html` tells each camera operator whether their camera is on FB Live. The director's phone opens it as **Director** and taps Cam 1, Cam 2 or No camera; each camera phone opens it as **Cam 1** or **Cam 2** and turns full red when it is live, green on standby. Direct links: `tally.html?as=director`, `tally.html?as=cam1`, `tally.html?as=cam2`. Access is the same as the checklist: Google sign-in. It saves one document, `services/{id}/tally/live` = `{cam: 0|1|2}`.

The director's page sends a heartbeat every 5 seconds, so it must stay open. A camera phone that hears nothing for 15 seconds turns grey ("Not connected") instead of showing an old answer; grey means follow the director's voice cue. The page asks the phone to keep its screen on. It is not linked from the other pages yet; the media leaders approve before the team uses it.

## Editing the checklist (from 2026-10-04)

Checklist items are edited on the site, not in code (John, C1/D1/E1). Accounts on the editors list see **Edit checklist** at the bottom of `live.html`: reword, add, remove and reorder items in Church setup and each station, then Save. Everyone's page updates right away.

- The list is saved in `config/checklist` (`lists.{setup|camera|...}.items` = `[{id, label}]`, plus `ids` in the same order, and a `version` that goes up by one per save so two editors can't overwrite each other). Until the first save, the built-in lists in `live.js` are used, with ids like `camera-1`.
- Ticks are saved by item id (`ticks: {itemId: true}`), so rewording or moving an item keeps its tick. A new item starts unticked, so that station shows Waiting until it's ticked. The rules refuse Ready/Complete unless every current item is ticked.
- Editors: the owner sets `config/editors` = `{emails: ["...", "..."]}` in the Firebase console (Firestore > Add document). Emails are Google sign-in emails in lowercase. Nobody can change this list from the site, and only people on it can read it.
- Up to 20 items per section, 120 characters each.

## Sunday checklist access

**Google sign-in only (John, 2026-10-03).** Any verified Google account can open and tick the current open Sunday and switch the camera tally. Closed Sundays, the current-Sunday pointer, the editors list and private documents stay locked. Each save records the Google account, its display name (must match the sign-in token) and a server time; ticks are saved in transactions, so two phones ticking at once both keep their tick.

Old access methods still in `firestore.rules`, unused: a team password (`hasTeamPassword()`, `teamAccess/current`) and a per-Sunday code (`hasSundayCode()`, `serviceAccess/{date}`). To go back to the password, swap `googleAccount()` for `hasTeamPassword()` in `canUseService`, `canWriteStation` and `canWriteSetup`; the page's password form would also need restoring from git history. Never put a password or code in this repository.

Sign the page in on `https://jia-media-desk.firebaseapp.com` (the sign-in domain). `web.app` and the old GitHub Pages address forward there, because Safari only finishes Google sign-in on the same domain. Opening a link inside Messenger, Facebook or Instagram shows "open in Safari or Chrome" (`signin-help.js`), because Google blocks sign-in in those app browsers.

The Floor Director's direct go-signal is still the real confirmation. A Google account identifies an account, not the person holding the phone.

## Weekly setup (owner, Firebase console)

1. Create `services/YYYY-MM-DD` with `{date:"YYYY-MM-DD", open:true}`.
2. Set `settings/current` to `{serviceId:"YYYY-MM-DD"}` and set the previous service to `open:false`.
3. Check the six stations (including CMA) show Waiting before relying on it.

Clients can't write members, the current-Sunday pointer, service records or the editors list; the owner manages those in the console.

## Sources

The [Program Flow](https://drive.google.com/file/d/1SWlV6LEeAKeF2pVnzaVrCRnKNvO9rhD2/view), run sheets, procedures, assets and incident log stay in Google Drive as the official sources. The website links to them and does not copy them.

## Deploying

`live-config.js` contains the Firebase web app configuration, which is public by design. Never put passwords, private keys, service-account credentials, real member data, or Sunday codes in this repository.

When `firestore.rules` changes, publish the complete rule set with `firebase deploy --only firestore:rules --project jia-media-desk`. Build the Hosting folder with `sh build-firebase-hosting.sh`, then publish the site with `firebase deploy --only hosting --project jia-media-desk`. Publish the GitHub Pages forwarding page from the repository when it changes. Confirm the public page and assigned phone after publication.

Cloud Firestore is in Singapore (`asia-southeast1`). Google Drive permissions continue to govern access to the linked files.
