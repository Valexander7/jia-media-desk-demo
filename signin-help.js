"use strict";
// Shared sign-in helpers for live.js and tally.js.
window.MEDIA_DESK_SIGNIN = {
  // Google refuses sign-in inside app browsers (error 403 disallowed_useragent). Team links are
  // shared in Messenger, which opens them in its own browser, so catch that before the tap.
  inAppBrowser() {
    return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|MicroMessenger|; wv\)/i.test(navigator.userAgent || "");
  },
  inAppHelp: "This page is open inside Messenger or Facebook, where Google sign-in is blocked. Tap ⋯ (top right), then Open in Safari or Open in Chrome, and sign in there.",
  // Plain words for the sign-in errors people actually hit; anything else keeps Firebase's text.
  plainError(error) {
    const words = {
      "auth/network-request-failed": "No internet connection. Connect, then tap Sign in again.",
      "auth/web-storage-unsupported": "This browser is blocking sign-in storage (often Private Browsing). Use a normal Safari or Chrome tab.",
      "auth/operation-not-supported-in-this-environment": "This browser can't do Google sign-in. Open the page in Safari or Chrome.",
      "auth/unauthorized-domain": "This web address isn't allowed to sign in. Use https://jia-media-desk.firebaseapp.com.",
      "auth/user-disabled": "This Google account has been turned off for the Media Desk. Ask John or James.",
      "auth/too-many-requests": "Too many tries. Wait a minute, then try again."
    };
    return words[error?.code] || ("Google sign-in did not finish. Try again in Safari or Chrome. " + (error?.message || ""));
  }
};
