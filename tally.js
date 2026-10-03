"use strict";

// Live camera tally. The director taps which camera is on air; each camera phone turns red when
// it is that camera. One shared document per Sunday: services/{id}/tally/live = {cam: 0|1|2}.
// Access is the same as the checklist: Google sign-in plus this Sunday's code (or the shared account).
const $ = id => document.getElementById(id);
const config = window.MEDIA_DESK_FIREBASE_CONFIG;
const ROLES = ["director", "cam1", "cam2"];
// Firestore can take minutes to notice a dead connection, so the director's phone sends a small
// heartbeat and camera phones go grey when they have heard nothing for STALE_MS.
const HEARTBEAT_MS = 5000, STALE_MS = 15000;

// What a camera phone shows. liveCam: 0, 1 or 2 from the server (null if nothing saved yet).
// myCam: 1 or 2. fresh: true only when the value is confirmed from the server right now.
// Returns {mode:"live"|"standby"|"unknown", title, detail}.
function cameraScreen(liveCam, myCam, fresh) {
  // Never show an old value as current: unconfirmed means grey, whatever was last seen.
  if (!fresh || ![0, 1, 2].includes(liveCam)) return {mode: "unknown", title: "?", detail: "Not connected. Follow the director's voice cue."};
  if (liveCam === myCam) return {mode: "live", title: "Live", detail: `Cam ${myCam} is on air. Hold steady.`};
  if (liveCam === 0) return {mode: "standby", title: "Standby", detail: "Slides on screen. Both cameras free to reframe."};
  return {mode: "standby", title: "Standby", detail: `Cam ${liveCam} is live. Free to reframe.`};
}

function readRole() {
  const fromUrl = new URLSearchParams(location.search).get("as");
  if (ROLES.includes(fromUrl)) return fromUrl;
  try { const saved = localStorage.getItem("tallyRole"); return ROLES.includes(saved) ? saved : null; }
  catch (_) { return null; }
}
function saveRole(role) {
  try { localStorage.setItem("tallyRole", role); } catch (_) { /* private mode: role just isn't remembered */ }
}

// Keep the camera phone's screen on during service (Safari 16.4+, Chrome). Released when hidden.
let wakeLock = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator && document.visibilityState === "visible" && !wakeLock) {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } } catch (_) { wakeLock = null; }
}
document.addEventListener("visibilitychange", keepAwake);

function setMessage(text, error = false) {
  $("message").textContent = text;
  $("message").className = "status" + (error ? " error" : "");
}

if (!config?.apiKey) {
  setMessage("Live camera is not set up on this copy of the site.", true);
} else {
  try {
    const version = "12.19.0";
    const [{initializeApp}, authApi, dbApi] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);
    const app = initializeApp(config);
    const auth = authApi.getAuth(app);
    const db = dbApi.getFirestore(app);
    if (["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("emulator")) {
      authApi.connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings: true});
      dbApi.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    authApi.getRedirectResult(auth).catch(error => setMessage("Google sign-in did not finish. Try again. " + error.message, true));

    let user = null, userName = "", serviceId = null, liveCam = null, fresh = false, busy = false;
    let role = readRole(), lastLiveCam = null, lastHeard = 0;
    const confirmed = () => fresh && navigator.onLine && Date.now() - lastHeard < STALE_MS;
    let stopPointer = null, stopTally = null;

    function render() {
      const signedIn = Boolean(user);
      $("auth-card").hidden = signedIn;
      $("sign-out").hidden = !signedIn;
      $("tally").hidden = !signedIn || !serviceId;
      document.querySelectorAll("[data-role]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.role === role)));
      $("switcher").hidden = role !== "director";
      $("screen").hidden = !role || role === "director";
      if (!signedIn || !serviceId) return;
      if (!role) { setMessage("Choose what this phone is for."); }
      if (role === "director") {
        document.querySelectorAll("[data-cam]").forEach(b => {
          b.setAttribute("aria-pressed", String(confirmed() && liveCam === Number(b.dataset.cam)));
          b.disabled = busy || !serviceId;
        });
        setMessage(!confirmed() ? "Not confirmed. Camera phones may be grey; use your voice cue." : busy ? "Sending…" : "Confirmed. Keep this page open so camera phones stay connected.", !confirmed());
      }
      if (role === "cam1" || role === "cam2") {
        const view = cameraScreen(liveCam, role === "cam1" ? 1 : 2, confirmed()) || {mode: "unknown", title: "?", detail: ""};
        $("screen").className = "screen " + view.mode;
        $("screen-title").textContent = view.title;
        $("screen-detail").textContent = view.detail;
        setMessage("");
      }
    }

    function listen(id) {
      if (stopTally) stopTally();
      serviceId = id; liveCam = null; fresh = false;
      stopTally = dbApi.onSnapshot(dbApi.doc(db, "services", id, "tally", "live"), {includeMetadataChanges: true}, snap => {
        liveCam = snap.exists() ? snap.data().cam : 0;
        fresh = !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        // Short buzz when this camera goes live (Android only; iPhone ignores it).
        const mine = role === "cam1" ? 1 : role === "cam2" ? 2 : null;
        if (fresh && mine && liveCam === mine && lastLiveCam !== mine && navigator.vibrate) navigator.vibrate(200);
        if (fresh) { lastLiveCam = liveCam; lastHeard = Date.now(); }
        render();
      }, error => {
        fresh = false;
        if (error.code === "permission-denied") {
          serviceId = null;
          setMessage("This account has no access to this Sunday yet. Enter the team password on the checklist page once, then come back.", true);
        } else setMessage("Lost the live connection: " + error.message, true);
        render();
      });
      render();
    }

    // Heartbeat: touch only the time and author, never cam, so it can't undo another director's tap.
    setInterval(() => {
      if (role === "director" && user && serviceId && !busy && fresh && document.visibilityState === "visible") {
        dbApi.updateDoc(dbApi.doc(db, "services", serviceId, "tally", "live"), {
          updatedAt: dbApi.serverTimestamp(), updatedBy: user.uid,
          updatedByName: userName && userName.length <= 60 ? userName : dbApi.deleteField()
        }).catch(() => {});
      }
      render();
    }, HEARTBEAT_MS);
    setInterval(render, 2000);

    async function setCam(cam) {
      if (!user || !serviceId || busy) return;
      busy = true; render();
      try {
        // Last tap wins on purpose: the director's newest choice is the truth, so no transaction.
        await dbApi.setDoc(dbApi.doc(db, "services", serviceId, "tally", "live"), {
          cam, updatedAt: dbApi.serverTimestamp(), updatedBy: user.uid,
          ...(userName && userName.length <= 60 ? {updatedByName: userName} : {})
        });
      } catch (error) {
        setMessage("Not sent. Use your voice cue. " + error.message, true);
      } finally { busy = false; render(); }
    }

    document.querySelectorAll("[data-role]").forEach(b => b.addEventListener("click", () => {
      role = b.dataset.role; saveRole(role); keepAwake(); render();
    }));
    $("switcher").addEventListener("click", event => {
      const b = event.target.closest("[data-cam]"); if (b) setCam(Number(b.dataset.cam));
    });
    $("sign-in").addEventListener("click", () => authApi.signInWithRedirect(auth, new authApi.GoogleAuthProvider()).catch(e => setMessage("Sign-in failed: " + e.message, true)));
    $("sign-out").addEventListener("click", () => authApi.signOut(auth));
    window.addEventListener("online", render);
    window.addEventListener("offline", render);

    authApi.onAuthStateChanged(auth, async nextUser => {
      if (stopTally) stopTally(); if (stopPointer) stopPointer();
      stopTally = stopPointer = null; serviceId = null; liveCam = null; fresh = false;
      user = nextUser; userName = "";
      if (!user) { setMessage(""); render(); return; }
      try { const token = await user.getIdTokenResult(); userName = typeof token.claims.name === "string" ? token.claims.name : ""; } catch (_) {}
      stopPointer = dbApi.onSnapshot(dbApi.doc(db, "settings", "current"), snap => {
        const id = snap.exists() ? snap.data().serviceId : null;
        if (typeof id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) { setMessage("No Sunday is open yet. Ask John or James.", true); return; }
        if (id !== serviceId) listen(id);
      }, error => setMessage("Could not find this Sunday: " + error.message, true));
      keepAwake();
      render();
    });
  } catch (error) {
    setMessage("Live camera could not load. Use the director's voice cue. " + error.message, true);
  }
}
