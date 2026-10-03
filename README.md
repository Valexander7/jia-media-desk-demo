# JIA Media Desk

The JIA Media Desk has three parts:

- `index.html` is the public sample demo. It has fictional service data and no account or shared storage. Demo changes reset when the page reloads.
- `live.html` is the online Sunday checklist. It connects to the team-owned `jia-media-desk` Firebase project on the Spark no-cost plan. The current service is October 4, 2026. At the September 28 readback, the service was open, the September 27 service was closed, and no station responses or test passes remained.
- `program.html` is a public Program Team preview with fictional calendar items and a reorderable Sunday flow. It saves changes in that browser only. It does not sync between devices, update Drive, or notify anyone. Do not enter real birthdays or private contact details.

## This Sunday reminders

The live page shows a "This Sunday" card for the coming Sunday in Manila time: Breaking of the Bread on the 1st and 3rd Sunday, homogeneous hosting and birthday celebrants on the last Sunday, and the weekly FB Live thumbnail. The rules are in `sunday-reminders.js` and come from Program Flow plus John's 2026-10-01 note. The card needs no sign-in or database. Confirm each Sunday against the Sunday Service Program in Drive.

## Live camera tally (trial)

`tally.html` tells each camera operator whether their camera is on FB Live. The director's phone opens it as **Director** and taps Cam 1, Cam 2 or No camera; each camera phone opens it as **Cam 1** or **Cam 2** and turns full red when it is live, green on standby. Direct links: `tally.html?as=director`, `tally.html?as=cam1`, `tally.html?as=cam2`. Access is the same as the checklist (Google sign-in plus the Sunday code, entered on the checklist page). It saves one document, `services/{id}/tally/live` = `{cam: 0|1|2}`.

The director's page sends a heartbeat every 5 seconds, so it must stay open. A camera phone that hears nothing for 15 seconds turns grey ("Not connected") instead of showing an old answer; grey means follow the director's voice cue. The page asks the phone to keep its screen on. It is not linked from the other pages yet; the media leaders approve before the team uses it.

## Sunday checklist access

**Team password (from 2026-10-03).** Members enter one media team password once per Google account; the page remembers it on later Sundays. The owner sets it in the private `teamAccess/current` document (field `code`, 8–32 characters) in the Firebase console, and changes it when someone leaves the team (everyone then enters the new one once). Never put the password in this repository. The older per-Sunday code below still works as a fallback.


The live page uses Google sign-in plus a private Sunday code. Any verified Google account with the current service code can read and edit the church setup checklist and all five station responses. Give the code in person. Never put it in this repository, a public URL, or a screenshot. A new random code is needed for each service. The code controls access but does not prove who held the phone or completed a check.

The October 4 code is stored in the private `serviceAccess/2026-10-04` Firestore document. Do not copy the code into this file. Changing the code invalidates previously saved passes; a person can enter the new code on the same account. Each save records the signed-in account's Google UID, its Google display name (the rules accept only the name on the sign-in token), and a server timestamp. Saves run as Firestore transactions, so two phones ticking the same station at once both keep their tick. Firestore keeps the latest response, not a full change history.

The JIA Media shared account remains an active fallback and can still update the current service without entering the Sunday code. Do not share its password. Revoke this fallback only after the assigned phone operator has confirmed the personal-account flow works for service day.

The assigned operator should use one phone, internet access, and tick only items actually checked. If the page shows Unverified or cannot save, confirm directly with the Floor Director. The Floor Director still confirms each station's go-signal directly before service.

## Current service setup

At the last live readback on September 28, 2026:

- `settings/current.serviceId` was `2026-10-04`.
- `services/2026-10-04` was open.
- `services/2026-09-27` was closed.
- October 4 had no readiness records or saved account passes after the sample test was cleared.
- A private 12-character code existed for October 4. Its value is intentionally not recorded here.

The pasted rollout report says the personal Google sign-in and Sunday-code flow was tested in Chrome with one sample Camera check, then cleared. The subsequent readback confirmed there were no saved readiness records or passes. This does not replace testing the assigned phone at the venue.

## Checklist and source files

The live page contains a three-item **Before pre-worship** church setup checklist and five station checklists: Camera, Livestream, Audio, Onsite Projection, and FB Live Projection. The setup and station checks save separately. The page is designed for a phone and uses large controls; live saves need an internet connection.

The [Program Flow](https://drive.google.com/file/d/1SWlV6LEeAKeF2pVnzaVrCRnKNvO9rhD2/view), run sheets, procedures, assets, and incident log remain in Google Drive as the official sources. The website does not copy those records. The Program Team preview is not the live Sunday program or calendar.

On September 27, Safari sign-in through GitHub Pages showed Firebase's “missing initial state” error. The live page now uses `https://jia-media-desk.firebaseapp.com/live.html` and Google redirect sign-in on the Firebase domain. The GitHub Pages live link forwards to Firebase Hosting. John later reported that the phone sign-in problem was fixed.

## Owner steps for a future Sunday

1. Create `services/YYYY-MM-DD` with `{date:"YYYY-MM-DD", open:true}`.
2. Generate a fresh random code of 8–32 characters and place it in the private `serviceAccess/YYYY-MM-DD` document. Share it with the Floor Director for in-person distribution; never store it in the repository.
3. Set `settings/current` to `{serviceId:"YYYY-MM-DD"}` and close the previous service with `open:false`.
4. Confirm the five stations show Waiting and test the assigned phone's sign-in and save path before relying on it.
5. Keep the Floor Director's direct go-signal as the operational confirmation. Google sign-in identifies an account, not necessarily the person holding the device.

Firestore rules deny client writes to membership, service selection, service metadata, and private service codes. The team owner manages those records. A verified Google account with a valid current code can write setup and station responses for the selected open service. The JIA Media shared member fallback is also still supported.

## Deploying

`live-config.js` contains the Firebase web app configuration, which is public by design. Never put passwords, private keys, service-account credentials, real member data, or Sunday codes in this repository.

When `firestore.rules` changes, publish the complete rule set with `firebase deploy --only firestore:rules --project jia-media-desk`. Build the Hosting folder with `sh build-firebase-hosting.sh`, then publish the site with `firebase deploy --only hosting --project jia-media-desk`. Publish the GitHub Pages forwarding page from the repository when it changes. Confirm the public page and assigned phone after publication.

Cloud Firestore is in Singapore (`asia-southeast1`). Google Drive permissions continue to govern access to the linked files.
