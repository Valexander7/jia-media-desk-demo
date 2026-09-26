# JIA Media Desk

`index.html` is the published, sample-only demo. It has no login or shared storage. All changes reset on reload.

`live.html` is the [published shared-readiness pilot](https://valexander7.github.io/jia-media-desk-demo/live.html). It connects to the team-owned `jia-media-desk` Firebase project on the no-cost Spark plan. Google sign-in is enabled and `valexander7.github.io` is an authorized domain. The JIA Media account has `role:"shared"` membership. The current service is `2026-09-27` and is open. The shared account can record station checks and readiness for that date. A test Camera response was saved, observed in a second tab, then reset to all checks false and Waiting; its timestamp remains visible. The source run sheet, procedures, assets, and incident log remain in Drive.

## Connect the pilot

1. The team owner controls station access and Sunday rollover. Keep the existing Floor Director's direct go-signal as the fallback.
2. Cloud Firestore is in Singapore (`asia-southeast1`). Publish `firestore.rules` as the complete rule set **before** adding a member or opening a service. The rule set must be republished after any change to this file.
3. The Firebase web app config in `live-config.js` is public by design. Access comes from Authentication and Firestore rules. Never put passwords, private keys, or service-account credentials in this repository.
4. The current shared-account pilot has one `members/{uid}` document with `{active:true, role:"shared"}`. This account can update any station after a service is opened, and the website cannot attribute a response to a person. Do not distribute the account password through this repository. For future individual accounts, `role:"lead"` plus one `station` or `role:"director"` remains supported.
5. Create `services/YYYY-MM-DD` with `{date:"YYYY-MM-DD", open:true}`. Set `settings/current` to `{serviceId:"YYYY-MM-DD"}`. The site starts with all five stations waiting. For the next service, create its document and change only the current pointer. Close the old service with `open:false`.
6. Before relying on it, test two devices: select a station, check all three items, and mark ready; verify that the Floor Director summary updates on the other device; verify an unapproved account cannot read or write; verify offline or lost access shows **Unverified**. Keep direct verbal/radio confirmation for the first real service.

The pilot records only three check booleans, a ready response, the authenticated UID, and a server timestamp for each station. With a shared account, the UID identifies the account, not the person. It does not copy the run sheet or incident log. `firestore.rules` denies all client changes to membership, the selected service, and service metadata; those are controlled by the team owner in Firebase Console. Google Drive permissions still govern the linked files.
