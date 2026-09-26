"use strict";

const stations = [
  {id:"camera", name:"Camera", checks:["Camera powered and feed visible", "Stage clear and positions checked", "Walkie-talkie tested"]},
  {id:"livestream", name:"Livestream", checks:["OBS scenes and intro/outro loaded", "Camera and Focusrite audio visible in OBS", "Ethernet checked; second-device monitor ready"]},
  {id:"audio", name:"Audio", checks:["Mixer-to-Focusrite cable connected", "Preacher and worship mics checked", "Announcement mic checked"]},
  {id:"onsite-projection", name:"Onsite Projection", checks:["Projector aligned and focused", "Lyrics and preaching slides loaded in FreeShow", "Videos and TV monitor tested"]},
  {id:"fb-projection", name:"FB Live Projection", checks:["Lyrics and lower thirds checked", "Videos loaded and tested", "HDMI link to livestream laptop confirmed"]}
];
const $ = id => document.getElementById(id);
const config = window.MEDIA_DESK_FIREBASE_CONFIG;

if (!config || !config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
  $("message").textContent = "This pilot is waiting for the team's Google sign-in and shared storage setup. Use the sample demo to explore the flow; no live response is being collected here.";
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
    let user = null, member = null, serviceId = null, service = null, selectedStation = "";
    let readiness = {}, pointerFresh = false, serviceFresh = false, readinessFresh = false, busy = false;
    let stopPointer = null, stopService = null, stopReadiness = null;
    for (const station of stations) {
      const option=document.createElement("option"); option.value=station.id; option.textContent=station.name;
      $("station-select").append(option);
    }
    function currentStation() {
      return stations.find(s=>s.id===(member?.role==="shared"?selectedStation:member?.station));
    }

    function clearListeners() {
      if (stopReadiness) stopReadiness();
      if (stopService) stopService();
      if (stopPointer) stopPointer();
      stopReadiness = stopService = stopPointer = null;
      serviceId = null; service = null; readiness = {};
      pointerFresh = serviceFresh = readinessFresh = false;
    }
    function connected() { return Boolean(user && member && serviceId && service?.open && pointerFresh && serviceFresh && readinessFresh && navigator.onLine); }
    function stamp(value) {
      if (!value?.toDate) return "No response saved";
      return "Updated " + new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(value.toDate());
    }
    function setMessage(text, error=false) { $("message").textContent=text; $("message").className=error?"error":"muted"; }
    function render() {
      const live=connected();
      $("connection").classList.toggle("warn",!live);
      $("connection").textContent=live?"Live connection verified. Responses below are saved for this service.":"Live status is unavailable or unverified. Confirm go-signals directly with the Floor Director.";
      $("service-card").hidden=!member || !service;
      $("lead-card").hidden=!member || !["lead","shared"].includes(member.role) || !service;
      $("director-card").hidden=!member || !["director","shared"].includes(member.role) || !service;
      if (!service) return;
      $("service-title").textContent="Service: " + (service.date || serviceId);
      $("service-note").textContent=service.open?"Current service selected by the team owner.":"This service is closed. No changes can be saved.";
      $("sync-pill").textContent=live?"Live":"Unverified";
      $("sync-pill").className="pill "+(live?"ready":"unknown");
      if (["lead","shared"].includes(member.role)) {
        const shared=member.role==="shared";
        $("station-select-label").hidden=!shared;
        $("station-select").value=shared?selectedStation:"";
        $("station-access-note").textContent=shared
          ? "Shared JIA Media sign-in: anyone using this account can change any station. Responses show the station and time, not the person. Confirm each go-signal directly with the Floor Director."
          : "Your checks and response are saved for this service.";
        const station=currentStation();
        if (!station) {
          $("station-title").textContent="Choose a station";
          $("station-pill").textContent="Select station";
          $("station-pill").className="pill unknown";
          $("station-update").textContent="Select the station you are checking.";
          $("checks").replaceChildren();
          $("ready-button").disabled=true;
        } else {
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
        const count=stations.filter(s=>readiness[s.id]?.ready).length;
        $("director-count").textContent=live?`${count} of 5 stations ready`:`Status cannot be verified. Ask each station directly.`;
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
      service=null; readiness={}; serviceFresh=readinessFresh=false; serviceId=id;
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
      render();
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
    $("checks").addEventListener("change",event=>{
      const input=event.target.closest("[data-check]"); if (!input) return;
      const station=currentStation(); if (!station) return;
      const current=readiness[station.id];
      const checks=Array.isArray(current?.checks)&&current.checks.length===3?[...current.checks]:[false,false,false];
      checks[Number(input.dataset.check)]=input.checked;
      save(station.id,checks,false);
    });
    $("ready-button").addEventListener("click",()=>{
      const station=currentStation(); if (!station) return;
      const current=readiness[station.id];
      const checks=Array.isArray(current?.checks)?current.checks:[false,false,false];
      if (current?.ready || checks.every(Boolean)) save(station.id,checks,!current?.ready);
    });
    $("station-select").addEventListener("change",event=>{
      selectedStation=stations.some(s=>s.id===event.target.value)?event.target.value:"";
      render();
    });
    $("sign-in").addEventListener("click",async()=>{
      try { await authApi.signInWithPopup(auth,provider); }
      catch(error) { setMessage("Sign-in failed: "+error.message,true); }
    });
    $("sign-out").addEventListener("click",()=>authApi.signOut(auth));
    window.addEventListener("online",render);
    window.addEventListener("offline",render);
    authApi.onAuthStateChanged(auth,async nextUser=>{
      clearListeners(); user=nextUser; member=null; selectedStation="";
      $("sign-in").hidden=Boolean(user); $("sign-out").hidden=!user;
      if (!user) { setMessage("Sign in with your approved Google account to view the current service."); render(); return; }
      try {
        const snap=await dbApi.getDocFromServer(dbApi.doc(db,"members",user.uid));
        const data=snap.exists()?snap.data():null;
        if (!data?.active || !["lead","director","shared"].includes(data.role) || (data.role==="lead" && !stations.some(s=>s.id===data.station))) {
          setMessage("This account has no active station or Floor Director access. Ask the team owner to assign it.",true); render(); return;
        }
        member=data;
        setMessage(data.role==="shared"?"Shared account view open. Select the station before recording its response.":data.role==="director"?"Floor Director view open.":"Your station view is open.");
        stopPointer=dbApi.onSnapshot(dbApi.doc(db,"settings","current"),{includeMetadataChanges:true},snap=>{
          pointerFresh=snap.exists() && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites;
          const id=snap.exists()?snap.data().serviceId:null;
          if (typeof id!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) {
            if (stopService) stopService(); if (stopReadiness) stopReadiness();
            serviceId=null; service=null; serviceFresh=readinessFresh=false;
            setMessage("No current service is configured. Ask the team owner to select one.",true);
          } else if (id!==serviceId) listenForService(id);
          render();
        },error=>{ pointerFresh=false; setMessage("Could not find the current service: "+error.message,true); render(); });
      } catch(error) { setMessage("Could not verify this account: "+error.message,true); }
      render();
    });
  } catch(error) {
    $("connection").textContent="Live readiness is unavailable.";
    $("message").textContent="The shared service could not load. Use direct station confirmations. "+error.message;
    $("message").className="error";
  }
}
