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
// The lists above are only the starting point. Once John or James saves the checklist on the site
// (Edit checklist), config/checklist in the database is used instead (John, 2026-10-04, C1/D1).
// Built-in items get fixed ids (camera-1, setup-1, ...) so ticks saved before the first edit still count.
let lists = {setup:setupItems.map((label,i)=>({id:`setup-${i+1}`,label}))};
stations.forEach(s=>{ lists[s.id]=s.checks.map((label,i)=>({id:`${s.id}-${i+1}`,label})); });
let listsMeta = null; // {version, updatedAt, updatedByName} of the saved checklist, null while built-in
const itemsOf = id => lists[id] || [];
// A saved response is {ticks:{itemId:true}, ready}. Ready only counts while every current item is
// ticked, so adding an item puts that station back to Waiting (E1) without anyone saving anything.
const tickedIn = (saved, item) => saved?.ticks?.[item.id] === true;
const allTickedIn = (saved, id) => itemsOf(id).every(item => tickedIn(saved, item));
const isReady = (saved, id) => saved?.ready === true && allTickedIn(saved, id);
const isComplete = saved => saved?.complete === true && allTickedIn(saved, "setup");
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
    let stopPointer = null, stopService = null, stopReadiness = null, stopSetup = null, stopChecklist = null;
    let editor = false, editing = false, draft = null, draftBase = 0;
    function currentStation() {
      return stations.find(s=>s.id===member?.station);
    }

    function clearListeners() {
      if (stopReadiness) stopReadiness();
      if (stopSetup) stopSetup();
      if (stopService) stopService();
      if (stopPointer) stopPointer();
      if (stopChecklist) stopChecklist();
      stopReadiness = stopSetup = stopService = stopPointer = stopChecklist = null;
      editor = editing = false; draft = null;
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
      $("edit-checklist").hidden=!editor || editing;
      $("editor-card").hidden=!editing;
      const sunday=Boolean(member && service && !editing);
      $("service-card").hidden=!sunday;
      $("setup-card").hidden=!sunday;
      $("operator-card").hidden=!sunday || member.role!=="shared";
      $("lead-card").hidden=!sunday || member.role!=="lead";
      $("director-card").hidden=!sunday || !["director","shared"].includes(member.role);
      if (!sunday) return;
      $("service-title").textContent="Service: " + (service.date || serviceId);
      $("service-note").textContent=service.open?"Current service selected by the team owner.":"This service is closed. No changes can be saved.";
      $("account-note").textContent=`Your Google account: ${user.email || "email unavailable"} · ID ${accountId(user.uid)}. If a response shows a different account ID, confirm it with the Floor Director.`;
      $("sync-pill").textContent=live?"Live":"Unverified";
      $("sync-pill").className="pill "+(live?"ready":"unknown");
      const setupDone=isComplete(setup);
      const tickCount=(saved,id)=>itemsOf(id).filter(item=>tickedIn(saved,item)).length;
      const completedChecks=tickCount(setup,"setup")+stations.reduce((total,s)=>total+tickCount(readiness[s.id],s.id),0);
      const readyCount=stations.filter(s=>isReady(readiness[s.id],s.id)).length;
      const totalChecks=itemsOf("setup").length+stations.reduce((total,s)=>total+itemsOf(s.id).length,0);
      $("ready-count").textContent=live?String(readyCount):"?";
      $("ready-of").textContent=`of ${stations.length} stations Ready`;
      $("overall-progress").textContent=live?`Church setup ${setupDone?"Complete":"Waiting"} · ${completedChecks} of ${totalChecks} checks`:"Progress cannot be verified.";
      $("setup-pill").textContent=live?(setupDone?"Complete":"Waiting"):"Unverified";
      $("setup-pill").className="pill "+(live?(setupDone?"ready":""):"unknown");
      $("setup-card").classList.toggle("done",live && setupDone);
      $("setup-progress").textContent=live?`${tickCount(setup,"setup")} of ${itemsOf("setup").length} checks saved · ${stamp(setup?.updatedAt,setup?.updatedBy,setup?.updatedByName)}`:"Setup status cannot be verified right now.";
      $("setup-checks").replaceChildren(...itemsOf("setup").map(item=>{
        const row=document.createElement("label"); row.className="check";
        const input=document.createElement("input"); input.type="checkbox"; input.checked=tickedIn(setup,item);
        input.disabled=!live || busy || !["shared","director"].includes(member.role); input.dataset.setupCheck=item.id;
        const span=document.createElement("span"); span.textContent=item.label;
        row.append(input,span); return row;
      }));
      $("setup-complete-button").textContent=setupDone?"Reopen setup":"Mark setup complete";
      $("setup-complete-button").disabled=!live || busy || !["shared","director"].includes(member.role) || (!setupDone && !allTickedIn(setup,"setup"));
      if (member.role==="shared") {
        $("operator-stations").replaceChildren(...stations.map((station,index)=>{
          const saved=readiness[station.id], ready=isReady(saved,station.id);
          const section=document.createElement("section"); section.className="station-card"+(live&&ready?" done":"");
          const head=document.createElement("div"); head.className="row";
          const title=document.createElement("h2"); title.textContent=`${index+1}. ${station.name}`;
          const pill=document.createElement("span"); pill.className="pill "+(live?(ready?"ready":""):"unknown"); pill.textContent=live?(ready?"Ready":"Waiting"):"Unverified";
          head.append(title,pill);
          const update=document.createElement("p"); update.className="muted small-note"; update.textContent=live?stamp(saved?.updatedAt,saved?.updatedBy,saved?.updatedByName):"Response cannot be verified.";
          const list=document.createElement("div"); list.className="checks";
          list.append(...itemsOf(station.id).map(item=>{
            const row=document.createElement("label"); row.className="check";
            const input=document.createElement("input"); input.type="checkbox"; input.checked=tickedIn(saved,item);
            input.disabled=!live || busy; input.dataset.stationId=station.id; input.dataset.check=item.id;
            const span=document.createElement("span"); span.textContent=item.label;
            row.append(input,span); return row;
          }));
          const actions=document.createElement("div"); actions.className="actions";
          const button=document.createElement("button"); button.type="button"; button.dataset.readyStation=station.id;
          button.textContent=ready?"Withdraw Ready":"Mark Ready";
          button.disabled=!live || busy || (!ready && !allTickedIn(saved,station.id));
          actions.append(button); section.append(head,update,list,actions); return section;
        }));
      }
      if (member.role==="lead") {
        $("station-access-note").textContent="Your checks and response are saved for this service.";
        const station=currentStation();
        if (station) {
        const saved=readiness[station.id], ready=isReady(saved,station.id);
        $("station-title").textContent=station.name;
        $("station-pill").textContent=live?(ready?"Ready":"Waiting"):"Unverified";
        $("station-pill").className="pill "+(live?(ready?"ready":""):"unknown");
        $("station-update").textContent=live?stamp(saved?.updatedAt,saved?.updatedBy,saved?.updatedByName):"Response cannot be verified right now.";
        $("checks").replaceChildren(...itemsOf(station.id).map(item=>{
          const row=document.createElement("label"); row.className="check";
          const input=document.createElement("input"); input.type="checkbox"; input.checked=tickedIn(saved,item);
          input.disabled=!live || busy; input.dataset.check=item.id;
          const span=document.createElement("span"); span.textContent=item.label;
          row.append(input,span); return row;
        }));
        $("ready-button").textContent=ready?"Withdraw ready response":"Mark station ready";
        $("ready-button").disabled=!live || busy || (!ready && !allTickedIn(saved,station.id));
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
          const ready=isReady(readiness[s.id],s.id);
          pill.className="pill "+(live?(ready?"ready":""):"unknown");
          pill.textContent=live?(ready?"Ready":"Waiting"):"Unknown";
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
    // Keep only ticks for items that are on the list now, so removed items don't pile up.
    function cleanTicks(value, listId) {
      const ticks={};
      for (const item of itemsOf(listId)) if (value?.[item.id]===true) ticks[item.id]=true;
      return ticks;
    }
    // change(latest) gets the latest saved copy from the server and returns the new {ticks, done},
    // so two phones ticking different boxes at the same moment both keep their tick.
    async function saveSetup(change) {
      if (!connected() || !["shared","director"].includes(member.role) || busy) return;
      busy=true; render();
      try {
        const ref=dbApi.doc(db,"services",serviceId,"setup","pre-service");
        await dbApi.runTransaction(db,async tx=>{
          const snap=await tx.get(ref);
          const latest=snap.exists()?snap.data():null;
          const next=change({ticks:cleanTicks(latest?.ticks,"setup"), done:latest?.complete===true});
          if (!next) return false;
          tx.set(ref,{ticks:next.ticks, complete:next.done, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid, ...author()});
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
          const next=change({ticks:cleanTicks(latest?.ticks,stationId), done:latest?.ready===true});
          if (!next) return false;
          tx.set(ref,{ticks:next.ticks, ready:next.done, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid, ...author()});
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
      const itemId=input.dataset.check, value=input.checked;
      // Changing any box withdraws Ready, as before.
      save(station.id,setTick(itemId,value));
    }
    function setTick(itemId, value) {
      return latest=>{ const ticks={...latest.ticks}; if (value) ticks[itemId]=true; else delete ticks[itemId]; return {ticks, done:false}; };
    }
    // Capture the intended Ready/Complete value at tap time; marking needs every current item ticked.
    function toggleDone(done, listId) {
      return latest=>{
        if (!done) return {ticks:latest.ticks, done:false};
        return itemsOf(listId).every(item=>latest.ticks[item.id]===true) ? {ticks:latest.ticks, done:true} : null;
      };
    }
    $("checks").addEventListener("change",changeStationCheck);
    $("operator-stations").addEventListener("change",changeStationCheck);
    $("setup-checks").addEventListener("change",event=>{
      const input=event.target.closest("[data-setup-check]"); if (!input) return;
      saveSetup(setTick(input.dataset.setupCheck,input.checked));
    });
    $("setup-complete-button").addEventListener("click",()=>{
      saveSetup(toggleDone(!isComplete(setup),"setup"));
    });
    $("ready-button").addEventListener("click",()=>{
      const station=currentStation(); if (!station) return;
      save(station.id,toggleDone(!isReady(readiness[station.id],station.id),station.id));
    });
    $("operator-stations").addEventListener("click",event=>{
      const button=event.target.closest("[data-ready-station]"); if (!button) return;
      const station=stations.find(s=>s.id===button.dataset.readyStation); if (!station) return;
      save(station.id,toggleDone(!isReady(readiness[station.id],station.id),station.id));
    });
    // ---- Checklist editing (John and James, config/editors) ----
    const sections=()=>[{id:"setup",name:"Church setup and call time"},...stations];
    function readLists(data) {
      // Use a saved list only if it is well-formed; otherwise keep what we have for that section.
      const next={};
      for (const sec of sections()) {
        const items=data?.lists?.[sec.id]?.items;
        const ok=Array.isArray(items) && items.length>0 && items.every(i=>typeof i?.id==="string" && typeof i?.label==="string");
        next[sec.id]=ok?items.map(i=>({id:i.id,label:i.label})):itemsOf(sec.id);
      }
      return next;
    }
    function listenForChecklist() {
      if (stopChecklist) stopChecklist();
      stopChecklist=dbApi.onSnapshot(dbApi.doc(db,"config","checklist"),snap=>{
        if (!snap.exists()) return;
        const data=snap.data();
        lists=readLists(data);
        listsMeta={version:data.version, updatedAt:data.updatedAt, updatedByName:data.updatedByName, updatedBy:data.updatedBy};
        if (editing && data.version!==draftBase) $("editor-note").textContent="Someone else just saved the checklist. Cancel and open Edit again to see their version.";
        render();
      },()=>{ /* keep the built-in or last good list */ });
    }
    async function checkEditor() {
      try { editor=(await dbApi.getDocFromServer(dbApi.doc(db,"config","editors"))).exists(); }
      catch (_) { editor=false; } // not on the list: the rules refuse the read
      render();
    }
    const newId=sectionId=>`${sectionId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
    function renderEditor() {
      $("editor-meta").textContent=listsMeta?.updatedAt?.toDate?"Last saved "+stamp(listsMeta.updatedAt,listsMeta.updatedBy,listsMeta.updatedByName).replace(/^Updated /,""):"Not edited yet: this is the starting list.";
      $("editor-lists").replaceChildren(...sections().map(sec=>{
        const box=document.createElement("fieldset"); box.className="edit-section";
        const legend=document.createElement("legend"); legend.textContent=sec.name; box.append(legend);
        draft[sec.id].forEach((item,i,all)=>{
          const row=document.createElement("div"); row.className="edit-row";
          const input=document.createElement("textarea"); input.rows=2; input.value=item.label; input.maxLength=120;
          input.dataset.list=sec.id; input.dataset.index=String(i); input.setAttribute("aria-label",`${sec.name} item ${i+1}`);
          const tools=document.createElement("div"); tools.className="edit-tools";
          for (const [act,text,label,off] of [["up","↑","Move up",i===0],["down","↓","Move down",i===all.length-1],["remove","✕","Remove",all.length===1]]) {
            const b=document.createElement("button"); b.type="button"; b.className="secondary"; b.textContent=text;
            b.dataset.act=act; b.dataset.list=sec.id; b.dataset.index=String(i); b.disabled=off;
            b.setAttribute("aria-label",`${label}: ${item.label || "new item"}`); tools.append(b);
          }
          row.append(input,tools); box.append(row);
        });
        const add=document.createElement("button"); add.type="button"; add.className="secondary"; add.textContent="+ Add item";
        add.dataset.act="add"; add.dataset.list=sec.id; box.append(add);
        return box;
      }));
    }
    function openEditor() {
      draft={}; for (const sec of sections()) draft[sec.id]=itemsOf(sec.id).map(i=>({...i}));
      draftBase=listsMeta?.version || 0; editing=true;
      $("editor-note").textContent="";
      renderEditor(); render(); $("editor-card").scrollIntoView({block:"start"});
    }
    $("edit-checklist").addEventListener("click",openEditor);
    $("editor-cancel").addEventListener("click",()=>{ editing=false; draft=null; setMessage(""); render(); });
    // Typing only updates the draft; the list is redrawn only when items move, so the keyboard stays put.
    $("editor-lists").addEventListener("input",event=>{
      const input=event.target.closest("textarea[data-list]"); if (!input) return;
      draft[input.dataset.list][Number(input.dataset.index)].label=input.value.replace(/\s*\n\s*/g," ");
    });
    $("editor-lists").addEventListener("click",event=>{
      const b=event.target.closest("button[data-act]"); if (!b) return;
      const list=draft[b.dataset.list], i=Number(b.dataset.index);
      if (b.dataset.act==="add") list.push({id:newId(b.dataset.list),label:""});
      if (b.dataset.act==="remove" && list.length>1) list.splice(i,1);
      if (b.dataset.act==="up" && i>0) [list[i-1],list[i]]=[list[i],list[i-1]];
      if (b.dataset.act==="down" && i<list.length-1) [list[i+1],list[i]]=[list[i],list[i+1]];
      renderEditor();
      if (b.dataset.act==="add") { const inputs=$("editor-lists").querySelectorAll(`textarea[data-list="${b.dataset.list}"]`); inputs[inputs.length-1]?.focus(); }
    });
    $("editor-save").addEventListener("click",async()=>{
      if (!editing || busy) return;
      const payload={};
      for (const sec of sections()) {
        const items=draft[sec.id].map(i=>({id:i.id,label:i.label.trim()})).filter(i=>i.label);
        if (!items.length) { $("editor-note").textContent=`${sec.name} needs at least one item.`; return; }
        if (items.length>20) { $("editor-note").textContent=`${sec.name} can have up to 20 items.`; return; }
        payload[sec.id]={items, ids:items.map(i=>i.id)};
      }
      busy=true; $("editor-save").disabled=true; $("editor-note").textContent="Saving…";
      try {
        const ref=dbApi.doc(db,"config","checklist");
        const ok=await dbApi.runTransaction(db,async tx=>{
          const snap=await tx.get(ref);
          const version=snap.exists()?snap.data().version:0;
          if (version!==draftBase) return false; // someone saved since this edit started
          tx.set(ref,{lists:payload, version:version+1, updatedAt:dbApi.serverTimestamp(), updatedBy:user.uid, ...author()});
          return true;
        });
        if (ok) { editing=false; draft=null; setMessage("Checklist saved. Everyone sees the new list now."); }
        else $("editor-note").textContent="Not saved: someone else saved the checklist while you were editing. Cancel and open Edit again.";
      } catch (error) {
        $("editor-note").textContent="Not saved. "+(error.code==="permission-denied"?"This account can't edit the checklist.":error.message);
      } finally { busy=false; $("editor-save").disabled=false; render(); }
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
        listenForChecklist(); checkEditor();
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
