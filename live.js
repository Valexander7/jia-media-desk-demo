"use strict";

const stations = [
  {id:"camera", name:"Camera", checks:["Camera powered and feed visible", "Stage clear and positions checked", "Walkie-talkie tested"]},
  {id:"livestream", name:"Livestream", checks:["OBS scenes and intro/outro loaded", "Camera and Focusrite audio visible in OBS", "Internet connection checked; second-device monitor ready"]},
  {id:"audio", name:"Audio", checks:["Mixer-to-Focusrite cable connected", "Preacher and worship mics checked", "Announcement mic checked"]},
  {id:"onsite-projection", name:"Onsite Projection", checks:["Lyrics and preaching slides loaded in FreeShow", "Birthday banner and presenter checked", "Videos and TV monitor tested"]},
  {id:"fb-projection", name:"FB Live Projection", checks:["Lyrics and lower thirds checked", "Videos loaded and tested", "HDMI link to livestream laptop confirmed"]}
];
const setupItems = [
  "Front lights opened correctly",
  "Speakers and audio switched on correctly",
  "Laptops, TV, and other media equipment switched on",
  // Call time items from the Media Rules booth checklist (John, 2026-10-04).
  "Media IDs on and all-black attire (Floor Director checked)",
  "Phones on silent, bags under the table, only water in sealed bottles",
  "Slides and lyrics checked against the lineup",
  "Team prayer done"
];
const $ = id => document.getElementById(id);
const config = window.MEDIA_DESK_FIREBASE_CONFIG;

if (!config || !config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
  $("message").textContent = "This pilot is waiting for the team's Google sign-in and shared storage setup. Use the sample demo to explore the flow; no live response is being collected here.";
  $("message").hidden = false;
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
    if (["localhost","127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("emulator")) {
      authApi.connectAuthEmulator(auth,"http://127.0.0.1:9099",{disableWarnings:true});
      dbApi.connectFirestoreEmulator(db,"127.0.0.1",8080);
    }
    const provider = new authApi.GoogleAuthProvider();
    const signin=window.MEDIA_DESK_SIGNIN;
    authApi.getRedirectResult(auth).catch(error=>setMessage(signin.plainError(error),true));
    let user = null, userName = "", member = null, serviceId = null, service = null;
    let readiness = {}, setup = null, pointerFresh = false, serviceFresh = false, readinessFresh = false, setupFresh = false, busy = false;
    // everLive: this page has been confirmed live at least once. failed: opening the checklist hit an error.
    // Together they keep the brown warning for real problems, not the normal few seconds of connecting.
    let everLive = false, failed = false;
    let stopPointer = null, stopService = null, stopReadiness = null, stopSetup = null;
    function currentStation() {
      return stations.find(s=>s.id===member?.station);
    }

    function clearListeners() {
      if (stopReadiness) stopReadiness();
      if (stopSetup) stopSetup();
      if (stopService) stopService();
      if (stopPointer) stopPointer();
      stopReadiness = stopSetup = stopService = stopPointer = null;
      serviceId = null; service = null; readiness = {}; setup = null;
      pointerFresh = serviceFresh = readinessFresh = setupFresh = false;
      everLive = failed = false;
    }
    function connected() { return Boolean(user && member && serviceId && service?.open && pointerFresh && serviceFresh && readinessFresh && setupFresh && navigator.onLine); }
    function accountId(uid) { return typeof uid==="string"?uid.slice(0,8):"unknown"; }
    function stamp(value, uid, name) {
      if (!value?.toDate) return "No response saved";
      const who = typeof name==="string" && name ? name : "account " + accountId(uid);
      return "Updated " + new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(value.toDate()) + " · " + who;
    }
    function author() {
      // The rules accept a name only when it matches the Google sign-in token exactly.
      return userName && userName.length<=60 ? {updatedByName:userName} : {};
    }
    function setMessage(text, error=false) { if (error && user && !connected()) failed=true; $("message").textContent=text; $("message").className=error?"error":"muted"; $("message").hidden=!text; }
    function showCodePrompt(text, error=false) {
      $("code-card").hidden=false;
      setMessage(text,error);
      render();
    }
    function serviceError(error, message) {
      if (member?.viaCode && error.code==="permission-denied") {
        clearListeners(); member=null;
        setMessage("Access has changed. Confirm go-signals directly and tell John or James.",true); render();
      } else { setMessage(message+error.message,true); render(); }
    }
    function render() {
      const live=connected();
      if (live) { everLive=true; failed=false; }
      // Brown warning only for real problems: an error, or a connection that was live and dropped.
      const warn=!live && Boolean(user) && (failed || (Boolean(member) && everLive));
      $("connection").classList.toggle("warn",warn);
      $("connection").classList.toggle("idle",!live && !warn);
      $("connection").textContent=!user?"Not signed in yet. Sign in below to open the Sunday checklist.":busy?"Checking or saving. Please wait…":live?"Connected. Saved responses are shown below.":failed?"Could not open the checklist (see the note below). Confirm go-signals directly with the Floor Director.":warn?"Connection lost or unverified. Confirm go-signals directly with the Floor Director.":"Signed in. Opening this Sunday's checklist…";
      $("service-card").hidden=!member || !service;
      $("setup-card").hidden=!member || !service;
      $("operator-card").hidden=!member || member.role!=="shared" || !service;
      $("lead-card").hidden=!member || member.role!=="lead" || !service;
      $("director-card").hidden=!member || !["director","shared"].includes(member.role) || !service;
      if (!service) return;
      $("service-title").textContent="Service: " + (service.date || serviceId);
      $("service-note").textContent=service.open?"Current service selected by the team owner.":"This service is closed. No changes can be saved.";
      $("account-note").textContent=`Your Google account: ${user.email || "email unavailable"} · ID ${accountId(user.uid)}. If a response shows a different account ID, confirm it with the Floor Director.`;
      $("sync-pill").textContent=live?"Live":"Unverified";
      $("sync-pill").className="pill "+(live?"ready":"unknown");
      const setupChecks=Array.isArray(setup?.checks)&&setup.checks.length===setupItems.length?setup.checks:setupItems.map(()=>false);
      const completedChecks=setupChecks.filter(Boolean).length+stations.reduce((total,s)=>total+(Array.isArray(readiness[s.id]?.checks)?readiness[s.id].checks.filter(Boolean).length:0),0);
      const readyCount=stations.filter(s=>readiness[s.id]?.ready).length;
      const totalChecks=setupItems.length+stations.reduce((total,s)=>total+s.checks.length,0);
      $("ready-count").textContent=live?String(readyCount):"?";
      $("ready-of").textContent=`of ${stations.length} stations Ready`;
      $("overall-progress").textContent=live?`Church setup ${setup?.complete?"Complete":"Waiting"} · ${completedChecks} of ${totalChecks} checks`:"Progress cannot be verified.";
      $("setup-pill").textContent=live?(setup?.complete?"Complete":"Waiting"):"Unverified";
      $("setup-pill").className="pill "+(live?(setup?.complete?"ready":""):"unknown");
      $("setup-card").classList.toggle("done",live && setup?.complete===true);
      $("setup-progress").textContent=live?`${setupChecks.filter(Boolean).length} of ${setupItems.length} checks saved · ${stamp(setup?.updatedAt,setup?.updatedBy,setup?.updatedByName)}`:"Setup status cannot be verified right now.";
      $("setup-checks").replaceChildren(...setupItems.map((label,i)=>{
        const row=document.createElement("label"); row.className="check";
        const input=document.createElement("input"); input.type="checkbox"; input.checked=setupChecks[i]===true;
        input.disabled=!live || busy || !["shared","director"].includes(member.role); input.dataset.setupCheck=String(i);
        const span=document.createElement("span"); span.textContent=label;
        row.append(input,span); return row;
      }));
      $("setup-complete-button").textContent=setup?.complete?"Reopen setup":"Mark setup complete";
      $("setup-complete-button").disabled=!live || busy || !["shared","director"].includes(member.role) || (!setup?.complete && !setupChecks.every(Boolean));
      if (member.role==="shared") {
        $("operator-stations").replaceChildren(...stations.map((station,index)=>{
          const saved=readiness[station.id];
          const checks=Array.isArray(saved?.checks)&&saved.checks.length===station.checks.length?saved.checks:station.checks.map(()=>false);
          const section=document.createElement("section"); section.className="station-card"+(live&&saved?.ready?" done":"");
          const head=document.createElement("div"); head.className="row";
          const title=document.createElement("h2"); title.textContent=`${index+1}. ${station.name}`;
          const pill=document.createElement("span"); pill.className="pill "+(live?(saved?.ready?"ready":""):"unknown"); pill.textContent=live?(saved?.ready?"Ready":"Waiting"):"Unverified";
          head.append(title,pill);
          const update=document.createElement("p"); update.className="muted small-note"; update.textContent=live?stamp(saved?.updatedAt,saved?.updatedBy,saved?.updatedByName):"Response cannot be verified.";
          const list=document.createElement("div"); list.className="checks";
          list.append(...station.checks.map((label,i)=>{
            const row=document.createElement("label"); row.className="check";
            const input=document.createElement("input"); input.type="checkbox"; input.checked=checks[i]===true;
            input.disabled=!live || busy; input.dataset.stationId=station.id; input.dataset.check=String(i);
            const span=document.createElement("span"); span.textContent=label;
            row.append(input,span); return row;
          }));
          const actions=document.createElement("div"); actions.className="actions";
          const button=document.createElement("button"); button.type="button"; button.dataset.readyStation=station.id;
          button.textContent=saved?.ready?"Withdraw Ready":"Mark Ready";
          button.disabled=!live || busy || (!saved?.ready && !checks.every(Boolean));
          actions.append(button); section.append(head,update,list,actions); return section;
        }));
      }
      if (member.role==="lead") {
        $("station-access-note").textContent="Your checks and response are saved for this service.";
        const station=currentStation();
        if (station) {
        const saved=readiness[station.id];
        const checks=Array.isArray(saved?.checks) && saved.checks.length===station.checks.length?saved.checks:station.checks.map(()=>false);
        $("station-title").textContent=station.name;
        $("station-pill").textContent=live?(saved?.ready?"Ready":"Waiting"):"Unverified";
        $("station-pill").className="pill "+(live?(saved?.ready?"ready":""):"unknown");
        $("station-update").textContent=live?stamp(saved?.updatedAt,saved?.updatedBy,saved?.updatedByName):"Response cannot be verified right now.";
        $("checks").replaceChildren(...station.checks.map((label,i)=>{
          const row=document.createElement("label"); row.className="check";
          const input=document.createElement("input"); input.type="checkbox"; input.checked=checks[i]===true;
          input.disabled=!live || busy; input.dataset.check=String(i);
          const span=document.createElement("span"); span.textContent=label;
          row.append(input,span); return row;
        }));
        $("ready-button").textContent=saved?.ready?"Withdraw ready response":"Mark station ready";
        $("ready-button").disabled=!live || busy || (!saved?.ready && !checks.every(Boolean));
        }
      }
      if (["director","shared"].includes(member.role)) {
        $("director-count").textContent=live?`${readyCount} of ${stations.length} stations Ready`:`Status cannot be verified. Ask each station directly.`;
        $("stations").replaceChildren(...stations.map(s=>{
          const row=document.createElement("div"); row.className="station";
          const label=document.createElement("div");
          const name=document.createElement("strong"); name.textContent=s.name;
          const detail=document.createElement("div"); detail.className="muted";
          detail.textContent=live?stamp(readiness[s.id]?.updatedAt,readiness[s.id]?.updatedBy,readiness[s.id]?.updatedByName):"Connection unverified";
          label.append(name,detail);
          const pill=document.createElement("span");
          pill.className="pill "+(live?(readiness[s.id]?.ready?"ready":""):"unknown");
          pill.textContent=live?(readiness[s.id]?.ready?"Ready":"Waiting"):"Unknown";
          row.append(label,pill); return row;
        }));
      }
    }
    function listenForService(id) {
      if (stopService) stopService();
      if (stopReadiness) stopReadiness();
      if (stopSetup) stopSetup();
      service=null; readiness={}; setup=null; serviceFresh=readinessFresh=setupFresh=false; serviceId=id;
      const serviceRef=dbApi.doc(db,"services",id);
      stopService=dbApi.onSnapshot(serviceRef,{includeMetadataChanges:true},snap=>{
        service=snap.exists()?snap.data():null;
        serviceFresh=!snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        if (!service) setMessage("The selected service does not exist. Ask the team owner to check setup.",true);
        render();
      },error=>{ serviceFresh=false; serviceError(error,"Could not read the current service: "); });
      stopReadiness=dbApi.onSnapshot(dbApi.collection(db,"services",id,"readiness"),{includeMetadataChanges:true},snap=>{
        readiness={}; snap.forEach(item=>{ readiness[item.id]=item.data(); });
        readinessFresh=!snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        render();
      },error=>{ readinessFresh=false; serviceError(error,"Could not read station responses: "); });
      stopSetup=dbApi.onSnapshot(dbApi.doc(db,"services",id,"setup","pre-service"),{includeMetadataChanges:true},snap=>{
        setup=snap.exists()?snap.data():null;
        setupFresh=!snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        render();
      },error=>{ setupFresh=false; serviceError(error,"Could not read the pre-service checklist: "); });
      render();
    }
    function cleanChecks(value, size) {
      return Array.isArray(value) && value.length===size ? value.map(v=>v===true) : Array(size).fill(false);
    }
    // change(latest) gets the latest saved copy from the server and returns the new {checks, flag},
    // so two phones ticking different boxes at the same moment both keep their tick.
    async function saveSetup(change) {
      if (!connected() || !["shared","director"].includes(member.role) || busy) return;
      busy=true; render();
      try {
        const ref=dbApi.doc(db,"services",serviceId,"setup","pre-service");
        await dbApi.runTransaction(db,async tx=>{
          const snap=await tx.get(ref);
          const latest=snap.exists()?snap.data():null;
          const next=change({checks:cleanChecks(latest?.checks,setupItems.length), done:latest?.complete===true});
          if (!next) return false;
          tx.set(ref,{checks:next.checks, complete:next.done, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid, ...author()});
          return true;
        }).then(saved=>setMessage(saved?"Pre-service checklist saved for this service.":"Not saved: someone changed a box. Tick every box, then try again.",!saved));
      } catch(error) {
        serviceError(error,"Could not save the pre-service checklist. Tell the Floor Director. ");
      } finally { busy=false; render(); }
    }
    async function save(stationId,change) {
      if (!connected() || !["lead","shared"].includes(member.role) || busy) return;
      const station=stations.find(s=>s.id===stationId);
      if (!station || (member.role==="lead" && member.station!==stationId)) return;
      busy=true; render();
      try {
        const ref=dbApi.doc(db,"services",serviceId,"readiness",stationId);
        const saved=await dbApi.runTransaction(db,async tx=>{
          const snap=await tx.get(ref);
          const latest=snap.exists()?snap.data():null;
          const next=change({checks:cleanChecks(latest?.checks,station.checks.length), done:latest?.ready===true});
          if (!next) return false;
          tx.set(ref,{checks:next.checks, ready:next.done, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid, ...author()});
          return true;
        });
        setMessage(saved?"Response saved for this service.":"Not saved: someone changed a box. Tick every box, then try again.",!saved);
      } catch(error) {
        serviceError(error,"Could not save. Confirm your response with the Floor Director. ");
      } finally { busy=false; render(); }
    }
    function changeStationCheck(event) {
      const input=event.target.closest("[data-check]"); if (!input) return;
      const station=stations.find(s=>s.id===(input.dataset.stationId||currentStation()?.id)); if (!station) return;
      const index=Number(input.dataset.check), value=input.checked;
      // Changing any box withdraws Ready, as before.
      save(station.id,latest=>{ const checks=[...latest.checks]; checks[index]=value; return {checks, done:false}; });
    }
    // Capture the intended Ready/Complete value at tap time; marking needs every latest box ticked.
    function toggleDone(done) {
      return latest=>{
        if (!done) return {checks:latest.checks, done:false};
        return latest.checks.every(Boolean) ? {checks:latest.checks, done:true} : null;
      };
    }
    $("checks").addEventListener("change",changeStationCheck);
    $("operator-stations").addEventListener("change",changeStationCheck);
    $("setup-checks").addEventListener("change",event=>{
      const input=event.target.closest("[data-setup-check]"); if (!input) return;
      const index=Number(input.dataset.setupCheck), value=input.checked;
      saveSetup(latest=>{ const checks=[...latest.checks]; checks[index]=value; return {checks, done:false}; });
    });
    $("setup-complete-button").addEventListener("click",()=>{
      saveSetup(toggleDone(!setup?.complete));
    });
    $("ready-button").addEventListener("click",()=>{
      const station=currentStation(); if (!station) return;
      save(station.id,toggleDone(!readiness[station.id]?.ready));
    });
    $("operator-stations").addEventListener("click",event=>{
      const button=event.target.closest("[data-ready-station]"); if (!button) return;
      const station=stations.find(s=>s.id===button.dataset.readyStation); if (!station) return;
      save(station.id,toggleDone(!readiness[station.id]?.ready));
    });
    $("sign-in").addEventListener("click",async()=>{
      if (signin.inAppBrowser()) { setMessage(signin.inAppHelp,true); return; }
      try { await authApi.signInWithRedirect(auth,provider); }
      catch(error) { setMessage(signin.plainError(error),true); }
    });
    $("show-code").addEventListener("click",()=>{
      const shown=$("sunday-code").type==="text";
      $("sunday-code").type=shown?"password":"text";
      $("show-code").textContent=shown?"Show password":"Hide password";
      $("show-code").setAttribute("aria-pressed",String(!shown));
    });
    $("code-form").addEventListener("submit",async event=>{
      event.preventDefault();
      if (!user || busy) return;
      if (!navigator.onLine) { setMessage("Connect to the internet before entering the team password.",true); return; }
      const code=$("sunday-code").value.trim();
      if (code.length<8 || code.length>32) { setMessage("Check the team password and try again.",true); return; }
      busy=true; $("join-service").disabled=true; render();
      try {
        const pointer=await dbApi.getDocFromServer(dbApi.doc(db,"settings","current"));
        const id=pointer.exists()?pointer.data().serviceId:null;
        if (typeof id!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) throw new Error("No current service is selected.");
        const pass={code, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid};
        // Team password first (remembered for later Sundays); this Sunday's old-style code still works.
        try { await dbApi.setDoc(dbApi.doc(db,"teamPasses",user.uid),pass); }
        catch (_) { await dbApi.setDoc(dbApi.doc(db,"services",id,"passes",user.uid),pass); }
        $("sunday-code").value="";
        location.reload();
      } catch(error) {
        setMessage("Password not accepted, or the service is not open. Check with John or James and try again.",true);
      } finally { busy=false; $("join-service").disabled=false; render(); }
    });
    $("sign-out").addEventListener("click",()=>authApi.signOut(auth));
    window.addEventListener("online",render);
    window.addEventListener("offline",render);
    authApi.onAuthStateChanged(auth,async nextUser=>{
      clearListeners(); user=nextUser; member=null; userName="";
      $("code-card").hidden=true; $("sunday-code").value=""; $("sunday-code").type="password";
      $("show-code").textContent="Show password"; $("show-code").setAttribute("aria-pressed","false");
      $("auth-card").hidden=Boolean(user); $("sign-in").hidden=Boolean(user); $("sign-out").hidden=!user;
      if (!user) { setMessage(signin.inAppBrowser()?signin.inAppHelp:""); render(); return; }
      // Each await below can finish after the person signed out or switched account; stop if so.
      const stale=()=>user!==nextUser;
      try {
        try { const token=await user.getIdTokenResult(); userName=typeof token.claims.name==="string"?token.claims.name:""; } catch (_) { userName=""; }
        if (stale()) return;
        const snap=await dbApi.getDocFromServer(dbApi.doc(db,"members",user.uid));
        if (stale()) return;
        const data=snap.exists()?snap.data():null;
        if (data?.active && ["lead","director","shared"].includes(data.role) && (data.role!=="lead" || stations.some(s=>s.id===data.station))) {
          member=data;
        } else {
          const pointer=await dbApi.getDocFromServer(dbApi.doc(db,"settings","current"));
          if (stale()) return;
          const id=pointer.exists()?pointer.data().serviceId:null;
          if (typeof id!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) { setMessage("No Sunday is open yet. Ask John or James.",true); render(); return; }
          // Reading the service only works with a valid team password (or this Sunday's code).
          try {
            const verified=await dbApi.getDocFromServer(dbApi.doc(db,"services",id));
            if (!verified.exists()) throw new Error("Service missing");
          } catch (_) { if (!stale()) { setMessage("Could not open this Sunday's checklist. Check with John or James.",true); render(); } return; }
          if (stale()) return;
          member={role:"shared",viaCode:true};
        }
        setMessage(member.viaCode?`Signed in as ${user.email || "your Google account"}. Your changes are saved with this account and time.`:member.role==="shared"?"":member.role==="director"?"Floor Director view open.":"Your station view is open.");
        stopPointer=dbApi.onSnapshot(dbApi.doc(db,"settings","current"),{includeMetadataChanges:true},snap=>{
          pointerFresh=snap.exists() && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
          const id=snap.exists()?snap.data().serviceId:null;
          if (typeof id!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) {
            if (stopService) stopService(); if (stopReadiness) stopReadiness(); if (stopSetup) stopSetup();
            serviceId=null; service=null; setup=null; serviceFresh=readinessFresh=setupFresh=false;
            setMessage("No current service is configured. Ask the team owner to select one.",true);
          } else if (id!==serviceId) {
            setMessage(member.viaCode?`Signed in as ${user.email || "your Google account"}. Your changes are saved with this account and time.`:member.role==="shared"?"":member.role==="director"?"Floor Director view open.":"Your station view is open.");
            listenForService(id);
          }
          render();
        },error=>{ pointerFresh=false; setMessage("Could not find the current service: "+error.message,true); render(); });
      } catch(error) { if (stale()) return; setMessage("Could not verify this account: "+error.message,true); }
      render();
    });
  } catch(error) {
    $("connection").textContent="Live readiness is unavailable.";
    $("message").textContent="The shared service could not load. Use direct station confirmations. "+error.message;
    $("message").className="error";
    $("message").hidden=false;
  }
}
