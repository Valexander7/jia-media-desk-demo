# JIA Media Desk

`index.html` is the published, sample-only demo. It has no login or shared storage. All changes reset on reload.

`live.html` is an unpublished shared-readiness pilot. It stays visibly disconnected while `live-config.js` contains `null`. It uses Google sign-in and Firestore only after a team-owned Firebase project is configured. The source run sheet, procedures, assets, and incident log remain in Drive.

## Connect the pilot

1. Agree who owns station access and Sunday rollover. Keep the existing Floor Director's direct go-signal as the fallback.
2. In a team-owned Firebase project, enable Google sign-in and Cloud Firestore. Add `valexander7.github.io` as an authorized Authentication domain if using the existing GitHub Pages site. Use the no-cost Spark plan if its limits fit the team.
3. Install `firestore.rules` as the complete Firestore rule set **before** adding members or opening the pilot. Test the rules with one lead, one director, and one unapproved Google account.
4. Set `window.MEDIA_DESK_FIREBASE_CONFIG` in `live-config.js` to the Firebase web app config. This config is public by design; access comes from Authentication and the Firestore rules. Never put private keys or service-account credentials in this repository.
5. Sign in once with each approved account to get its Firebase Authentication UID. In Firestore, create `members/{uid}` with `{active:true, role:"lead", station:"camera"}` (choose exactly one of `camera`, `livestream`, `audio`, `onsite-projection`, `fb-projection`) or `{active:true, role:"director"}`. No names or contact list need to be copied into Firestore.
6. Create `services/YYYY-MM-DD` with `{date:"YYYY-MM-DD", open:true}`. Set `settings/current` to `{serviceId:"YYYY-MM-DD"}`. The site starts with all five stations waiting. For the next service, create its document and change only the current pointer. Close the old service with `open:false`.
7. Before relying on it, test two devices: a lead checks all three items and marks ready; the director sees the response and timestamp; an unapproved account cannot read or write; offline or lost access shows **Unverified**. Keep direct verbal/radio confirmation for the first real service.

The pilot records only three check booleans, a ready response, the authenticated UID, and a server timestamp for each station. It does not copy the run sheet or incident log. `firestore.rules` denies all client changes to membership, the selected service, and service metadata; those are controlled by the team owner in Firebase Console. Google Drive permissions still govern the linked files.
