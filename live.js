"use strict";

const stations = [
  {id:"camera", name:"Camera", checks:["Camera powered and feed visible", "Stage clear and positions checked", "Walkie-talkie tested"]},
  {id:"livestream", name:"Livestream", checks:["OBS scenes and intro/outro loaded", "Camera and Focusrite audio visible in OBS", "Ethernet checked; second-device monitor ready"]},
  {id:"audio", name:"Audio", checks:["Mixer-to-Focusrite cable connected", "Preacher and worship mics checked", "Announcement mic checked"]},
  {id:"onsite-projection", name:"Onsite Projection", checks:["Projector aligned and focused", "Lyrics and preaching slides loaded in FreeShow", "Videos and TV monitor tested"]},
  {id:"fb-projection", name:"FB Live Projection", checks:["Lyrics and lower thirds checked", "Videos loaded and tested", "HDMI link to livestream laptop confirmed"]}
];
const setupItems = [
  "Front lights opened correctly",
  "Speakers and audio switched on correctly",
  "Projector, laptop, TV, and other media equipment switched on"
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
    const provider = new authApi.GoogleAuthProvider();
    authApi.getRedirectResult(auth).catch(error=>{
      setMessage("Google sign-in did not finish. Open this page in Safari or Chrome and try again. "+error.message,true);
    });
    let user = null, member = null, serviceId = null, service = null;
    let readiness = {}, setup = null, pointerFresh = false, serviceFresh = false, readinessFresh = false, setupFresh = false, busy = false;
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
    }
    function connected() { return Boolean(user && member && serviceId && service?.open && pointerFresh && serviceFresh && readinessFresh && setupFresh && navigator.onLine); }
    function stamp(value) {
      if (!value?.toDate) return "No response saved";
      return "Updated " + new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(value.toDate());
    }
    function setMessage(text, error=false) { $("message").textContent=text; $("message").className=error?"error":"muted"; $("message").hidden=!text; }
    function render() {
      const live=connected();
      $("connection").classList.toggle("warn",!live);
      $("connection").textContent=busy?"Saving your check. Please wait…":live?"Connected. Saved responses are shown below.":"Connection unavailable or unverified. Confirm go-signals directly with the Floor Director.";
      $("service-card").hidden=!member || !service;
      $("setup-card").hidden=!member || !service;
      $("operator-card").hidden=!member || member.role!=="shared" || !service;
      $("lead-card").hidden=!member || member.role!=="lead" || !service;
      $("director-card").hidden=!member || !["director","shared"].includes(member.role) || !service;
      if (!service) return;
      $("service-title").textContent="Service: " + (service.date || serviceId);
      $("service-note").textContent=service.open?"Current service selected by the team owner.":"This service is closed. No changes can be saved.";
      $("sync-pill").textContent=live?"Live":"Unverified";
      $("sync-pill").className="pill "+(live?"ready":"unknown");
      const setupChecks=Array.isArray(setup?.checks)&&setup.checks.length===setupItems.length?setup.checks:[false,false,false];
      const completedChecks=setupChecks.filter(Boolean).length+stations.reduce((total,s)=>total+(Array.isArray(readiness[s.id]?.checks)?readiness[s.id].checks.filter(Boolean).length:0),0);
      const readyCount=stations.filter(s=>readiness[s.id]?.ready).length;
      $("overall-progress").textContent=live?`Church setup ${setup?.complete?"Complete":"Waiting"} · ${completedChecks} of 18 checks · ${readyCount} of 5 stations Ready`:"Progress cannot be verified.";
      $("setup-pill").textContent=live?(setup?.complete?"Complete":"Waiting"):"Unverified";
      $("setup-pill").className="pill "+(live?(setup?.complete?"ready":""):"unknown");
      $("setup-progress").textContent=live?`${setupChecks.filter(Boolean).length} of ${setupItems.length} checks saved · ${stamp(setup?.updatedAt)}`:"Setup status cannot be verified right now.";
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
          const checks=Array.isArray(saved?.checks)&&saved.checks.length===3?saved.checks:[false,false,false];
          const section=document.createElement("section"); section.className="station-card";
          const head=document.createElement("div"); head.className="row";
          const title=document.createElement("h2"); title.textContent=`${index+1}. ${station.name}`;
          const pill=document.createElement("span"); pill.className="pill "+(live?(saved?.ready?"ready":""):"unknown"); pill.textContent=live?(saved?.ready?"Ready":"Waiting"):"Unverified";
          head.append(title,pill);
          const update=document.createElement("p"); update.className="muted small-note"; update.textContent=live?stamp(saved?.updatedAt):"Response cannot be verified.";
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
        const checks=Array.isArray(saved?.checks) && saved.checks.length===3?saved.checks:[false,false,false];
        $("station-title").textContent=station.name;
        $("station-pill").textContent=live?(saved?.ready?"Ready":"Waiting"):"Unverified";
        $("station-pill").className="pill "+(live?(saved?.ready?"ready":""):"unknown");
        $("station-update").textContent=live?stamp(saved?.updatedAt):"Response cannot be verified right now.";
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
        $("director-count").textContent=live?`${readyCount} of 5 stations Ready`:`Status cannot be verified. Ask each station directly.`;
        $("stations").replaceChildren(...stations.map(s=>{
          const row=document.createElement("div"); row.className="station";
          const label=document.createElement("div");
          const name=document.createElement("strong"); name.textContent=s.name;
          const detail=document.createElement("div"); detail.className="muted";
          detail.textContent=live?stamp(readiness[s.id]?.updatedAt):"Connection unverified";
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
      },error=>{ serviceFresh=false; setMessage("Could not read the current service: "+error.message,true); render(); });
      stopReadiness=dbApi.onSnapshot(dbApi.collection(db,"services",id,"readiness"),{includeMetadataChanges:true},snap=>{
        readiness={}; snap.forEach(item=>{ readiness[item.id]=item.data(); });
        readinessFresh=!snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        render();
      },error=>{ readinessFresh=false; setMessage("Could not read station responses: "+error.message,true); render(); });
      stopSetup=dbApi.onSnapshot(dbApi.doc(db,"services",id,"setup","pre-service"),{includeMetadataChanges:true},snap=>{
        setup=snap.exists()?snap.data():null;
        setupFresh=!snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
        render();
      },error=>{ setupFresh=false; setMessage("Could not read the pre-service checklist: "+error.message,true); render(); });
      render();
    }
    async function saveSetup(checks,complete) {
      if (!connected() || !["shared","director"].includes(member.role) || busy) return;
      busy=true; render();
      try {
        await dbApi.setDoc(dbApi.doc(db,"services",serviceId,"setup","pre-service"),{
          checks, complete, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid
        });
        setMessage("Pre-service checklist saved for this service.");
      } catch(error) {
        setMessage("Could not save the pre-service checklist. Tell the Floor Director. "+error.message,true);
      } finally { busy=false; render(); }
    }
    async function save(stationId,checks,ready) {
      if (!connected() || !["lead","shared"].includes(member.role) || busy) return;
      if (!stations.some(s=>s.id===stationId) || (member.role==="lead" && member.station!==stationId)) return;
      busy=true; render();
      try {
        await dbApi.setDoc(dbApi.doc(db,"services",serviceId,"readiness",stationId),{
          checks, ready, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid
        });
        setMessage("Response saved for this service.");
      } catch(error) {
        setMessage("Could not save. Confirm your response with the Floor Director. "+error.message,true);
      } finally { busy=false; render(); }
    }
    function changeStationCheck(event) {
      const input=event.target.closest("[data-check]"); if (!input) return;
      const station=stations.find(s=>s.id===(input.dataset.stationId||currentStation()?.id)); if (!station) return;
      const current=readiness[station.id];
      const checks=Array.isArray(current?.checks)&&current.checks.length===3?[...current.checks]:[false,false,false];
      checks[Number(input.dataset.check)]=input.checked;
      save(station.id,checks,false);
    }
    $("checks").addEventListener("change",changeStationCheck);
    $("operator-stations").addEventListener("change",changeStationCheck);
    $("setup-checks").addEventListener("change",event=>{
      const input=event.target.closest("[data-setup-check]"); if (!input) return;
      const checks=Array.isArray(setup?.checks)&&setup.checks.length===setupItems.length?[...setup.checks]:[false,false,false];
      checks[Number(input.dataset.setupCheck)]=input.checked;
      saveSetup(checks,false);
    });
    $("setup-complete-button").addEventListener("click",()=>{
      const checks=Array.isArray(setup?.checks)&&setup.checks.length===setupItems.length?setup.checks:[false,false,false];
      if (setup?.complete || checks.every(Boolean)) saveSetup(checks,!setup?.complete);
    });
    $("ready-button").addEventListener("click",()=>{
      const station=currentStation(); if (!station) return;
      const current=readiness[station.id];
      const checks=Array.isArray(current?.checks)?current.checks:[false,false,false];
      if (current?.ready || checks.every(Boolean)) save(station.id,checks,!current?.ready);
    });
    $("operator-stations").addEventListener("click",event=>{
      const button=event.target.closest("[data-ready-station]"); if (!button) return;
      const station=stations.find(s=>s.id===button.dataset.readyStation); if (!station) return;
      const current=readiness[station.id];
      const checks=Array.isArray(current?.checks)?current.checks:[false,false,false];
      if (current?.ready || checks.every(Boolean)) save(station.id,checks,!current?.ready);
    });
    $("sign-in").addEventListener("click",async()=>{
      try { await authApi.signInWithRedirect(auth,provider); }
      catch(error) { setMessage("Sign-in failed: "+error.message,true); }
    });
    $("sign-out").addEventListener("click",()=>authApi.signOut(auth));
    window.addEventListener("online",render);
    window.addEventListener("offline",render);
    authApi.onAuthStateChanged(auth,async nextUser=>{
      clearListeners(); user=nextUser; member=null;
      $("auth-card").hidden=Boolean(user); $("sign-in").hidden=Boolean(user); $("sign-out").hidden=!user;
      if (!user) { setMessage("Sign in with a Google account approved by the team owner to view the current service."); render(); return; }
      try {
        const snap=await dbApi.getDocFromServer(dbApi.doc(db,"members",user.uid));
        const data=snap.exists()?snap.data():null;
        if (!data?.active || !["lead","director","shared"].includes(data.role) || (data.role==="lead" && !stations.some(s=>s.id===data.station))) {
          setMessage(`This Google account is not approved for the Media checklist: ${user.email || "email unavailable"}. Ask the team owner to grant access to this account. Do not share your password.`,true); render(); return;
        }
        member=data;
        setMessage(data.role==="shared"?"":data.role==="director"?"Floor Director view open.":"Your station view is open.");
        stopPointer=dbApi.onSnapshot(dbApi.doc(db,"settings","current"),{includeMetadataChanges:true},snap=>{
          pointerFresh=snap.exists() && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
          const id=snap.exists()?snap.data().serviceId:null;
          if (typeof id!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) {
            if (stopService) stopService(); if (stopReadiness) stopReadiness(); if (stopSetup) stopSetup();
            serviceId=null; service=null; setup=null; serviceFresh=readinessFresh=setupFresh=false;
            setMessage("No current service is configured. Ask the team owner to select one.",true);
          } else if (id!==serviceId) {
            setMessage(member.role==="shared"?"":member.role==="director"?"Floor Director view open.":"Your station view is open.");
            listenForService(id);
          }
          render();
        },error=>{ pointerFresh=false; setMessage("Could not find the current service: "+error.message,true); render(); });
      } catch(error) { setMessage("Could not verify this account: "+error.message,true); }
      render();
    });
  } catch(error) {
    $("connection").textContent="Live readiness is unavailable.";
    $("message").textContent="The shared service could not load. Use direct station confirmations. "+error.message;
    $("message").className="error";
    $("message").hidden=false;
  }
}
