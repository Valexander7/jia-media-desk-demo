"use strict";

const KEY = "jia-program-preview-v2";
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sample = () => ({
  month:new Date().toISOString().slice(0,7), selected:null, serviceDate:"2026-11-15",
  events:[
    {id:"e1",date:"2026-11-15",type:"Birthday greeting",title:"Mina’s birthday (fictional)",intro:"Onsite announcements · 10:35–10:45",owner:"Church Narrator"},
    {id:"e2",date:"2026-11-22",type:"Event",title:"Volunteer orientation (fictional)",intro:"Onsite announcements",owner:"Program Team"}
  ],
  blocks:[
    {id:"b1",time:"08:50",kind:"Media cue",title:"Standby and countdown",owner:"Church Narrator + Media",cue:"Welcome video and final countdown",needs:{person:true,asset:true,cue:true},done:{person:false,asset:false,cue:false}},
    {id:"b2",time:"09:00",kind:"Worship",title:"Praise and worship",owner:"CMA + Projection",cue:"Lyric order and lighting handoff",needs:{person:true,asset:true,cue:true},done:{person:false,asset:false,cue:false}},
    {id:"b3",time:"09:30",kind:"Service",title:"Offertory",owner:"Church Narrator + Audio",cue:"Presenter, mic, media cue",needs:{person:true,asset:false,cue:true},done:{person:false,asset:false,cue:false}},
    {id:"b4",time:"09:40",kind:"Message",title:"Word of God",owner:"Preacher + Church Narrator",cue:"Introduce preacher; switch monitor to slides",needs:{person:true,asset:true,cue:true},done:{person:false,asset:false,cue:false}},
    {id:"b5",time:"10:25",kind:"Service",title:"Benediction and offering",owner:"Pastor + Media",cue:"End livestream; onsite flow continues",needs:{person:true,asset:true,cue:true},done:{person:false,asset:false,cue:false}},
    {id:"b6",time:"10:35",kind:"Birthday",title:"Birthday greeting and onsite announcements",owner:"Church Narrator + Projection",cue:"Birthday green-screen banner if there is a Sunday celebrant; then visual announcements",needs:{person:true,asset:true,cue:true},done:{person:false,asset:false,cue:false}}
  ]
});
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && /^\d{4}-\d{2}$/.test(saved.month) && Array.isArray(saved.events) && Array.isArray(saved.blocks)) return saved;
  } catch (_) { /* Storage may be disabled; keep the preview usable in memory. */ }
  return sample();
}
let state = load();
let dragging = null;
function save() { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch (_) { /* In-memory preview remains usable. */ } }
function dateText(date) { return new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(new Date(`${date}T12:00:00`)); }
function ready(block) { return ["person","asset","cue"].every(key => !block.needs?.[key] || block.done?.[key]); }
function monthDays(month) { const [year,num]=month.split("-").map(Number); return new Date(year,num,0).getDate(); }
// Automatic items for a date: monthly Sunday rules plus one-off church events (from sunday-reminders.js).
function autoItems(date) {
  const items=[];
  const d=new Date(`${date}T12:00:00Z`);
  if(typeof SUNDAY_RULES!=="undefined" && d.getUTCDay()===0) {
    for(const rule of SUNDAY_RULES) if(rule.when!=="every" && matchesRule(rule,d)) items.push({date,title:ruleText(rule,d),type:"Monthly",owner:rule.team});
  }
  if(typeof CHURCH_EVENTS!=="undefined") for(const ev of CHURCH_EVENTS) if(ev.date===date) items.push({date,title:ev.text,type:"Church event",owner:ev.team});
  return items;
}
function monthAutoItems(month) { const out=[]; for(let day=1; day<=monthDays(month); day++) out.push(...autoItems(`${month}-${String(day).padStart(2,"0")}`)); return out; }
function renderCalendar() {
  const [year,num]=state.month.split("-").map(Number);
  $("month-label").textContent=new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(new Date(year,num-1,1));
  const start=new Date(year,num-1,1).getDay();
  let html=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=>`<span class="weekday">${day}</span>`).join("");
  html += Array.from({length:start},()=>"<span></span>").join("");
  for(let day=1; day<=monthDays(state.month); day++) {
    const date=`${state.month}-${String(day).padStart(2,"0")}`;
    const auto=autoItems(date).length;
    const count=state.events.filter(event=>event.date===date).length+auto;
    html+=`<button type="button" class="day ${count?"has-event":""} ${auto?"has-auto":""} ${state.selected===date?"selected":""}" data-date="${date}" aria-label="${escapeHtml(dateText(date))}, ${count} items" aria-pressed="${state.selected===date}">${day}${count?`<span class="dot">${count} item${count===1?"":"s"}</span>`:""}</button>`;
  }
  $("calendar").innerHTML=html;
}
function renderEvents() {
  const auto=(state.selected?autoItems(state.selected):monthAutoItems(state.month));
  const own=state.events.filter(event=>!state.selected || event.date===state.selected);
  const visible=[...auto.map(item=>({...item,auto:true})),...own].sort((a,b)=>a.date.localeCompare(b.date));
  $("event-heading").textContent=state.selected?`Items · ${dateText(state.selected)}`:"Upcoming items";
  $("show-all").hidden=!state.selected;
  $("events").innerHTML=visible.length?visible.map(event=>event.auto?`<article class="event auto"><div class="row"><strong>${escapeHtml(event.title)}</strong><span class="tag ready">${escapeHtml(event.type)}</span></div><p class="small muted">${escapeHtml(dateText(event.date))} · ${escapeHtml(event.owner)}</p></article>`:`<article class="event" data-event-id="${escapeHtml(event.id)}"><div class="row"><strong>${escapeHtml(event.title)}</strong><span class="tag">${escapeHtml(event.type)}</span></div><p class="small muted">${escapeHtml(dateText(event.date))} · ${escapeHtml(event.intro || "Introduction time not set")}</p><p class="small muted">Confirm with: ${escapeHtml(event.owner || "Not assigned")}</p><div class="actions"><button type="button" class="secondary" data-event-add="${escapeHtml(event.id)}" ${event.date===state.serviceDate?"":"disabled"}>${event.date===state.serviceDate?"Add to program":"Different service date"}</button><button type="button" class="secondary" data-event-delete="${escapeHtml(event.id)}">Remove</button></div></article>`).join(""):`<p class="empty">No items for this date. Add one below, or show all.</p>`;
}
function renderBlocks() {
  const done=state.blocks.filter(ready).length;
  $("readiness").textContent=`${done} of ${state.blocks.length} checks done`;
  $("readiness").className="tag "+(done===state.blocks.length?"ready":"warn");
  $("missing").textContent=done===state.blocks.length?"All sample handoff checks are done. Confirm the final flow with the Program Team and current run sheet.":`${state.blocks.length-done} block${state.blocks.length-done===1?"":"s"} still need a handoff check.`;
  $("blocks").innerHTML=state.blocks.length?state.blocks.map((block,index)=>{
    const status=ready(block);
    return `<article class="program-card" data-block-id="${escapeHtml(block.id)}"><div class="program-head"><button class="drag" type="button" aria-label="Drag ${escapeHtml(block.title)} to reorder" title="Drag to reorder">☰</button><div class="program-title"><strong>${escapeHtml(block.time)} · ${escapeHtml(block.title)}</strong><small>${escapeHtml(block.kind)} · ${escapeHtml(block.owner || "Person not assigned")}</small><span class="tag ${status?"ready":"warn"}">${status?"Checks done":"Needs handoff"}</span></div><div class="move"><button type="button" class="secondary" data-move="up" aria-label="Move ${escapeHtml(block.title)} up" ${index===0?"disabled":""}>↑</button><button type="button" class="secondary" data-move="down" aria-label="Move ${escapeHtml(block.title)} down" ${index===state.blocks.length-1?"disabled":""}>↓</button></div></div><details><summary>Edit handoff and checks</summary><form class="block-edit form-grid"><label class="field">Time<input name="time" type="time" required value="${escapeHtml(block.time)}"></label><label class="field">Kind<select name="kind">${["Service","Worship","Message","Announcement","Birthday","Media cue","Other"].map(kind=>`<option ${block.kind===kind?"selected":""}>${kind}</option>`).join("")}</select></label><label class="field wide">Title<input name="title" maxlength="80" required value="${escapeHtml(block.title)}"></label><label class="field wide">Person / team to confirm<input name="owner" maxlength="80" value="${escapeHtml(block.owner)}"></label><label class="field wide">Media cue or asset<input name="cue" maxlength="150" value="${escapeHtml(block.cue)}"></label><div class="wide"><strong>Checks this block needs</strong><div class="checks">${[["person","Person confirmed"],["asset","Asset ready"],["cue","Cue agreed"]].map(([key,label])=>`<label><input type="checkbox" name="need-${key}" ${block.needs?.[key]?"checked":""}>${label}</label>`).join("")}</div></div><div class="wide"><strong>Already done</strong><div class="checks">${[["person","Person"],["asset","Asset"],["cue","Cue"]].map(([key,label])=>`<label><input type="checkbox" name="done-${key}" ${block.done?.[key]?"checked":""}>${label}</label>`).join("")}</div></div><div class="actions wide"><button type="submit">Save block</button><button type="button" class="secondary" data-delete-block="${escapeHtml(block.id)}">Remove block</button></div></form></details></article>`;
  }).join(""):`<p class="empty">No blocks yet. Add the first one below.</p>`;
}
function render() { $("service-date-label").textContent=dateText(state.serviceDate); $("service-date").value=state.serviceDate; renderCalendar(); renderEvents(); renderBlocks(); }
function changeMonth(offset) { const [year,num]=state.month.split("-").map(Number); const date=new Date(year,num-1+offset,1); state.month=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; state.selected=null; save(); render(); }
$("prev-month").addEventListener("click",()=>changeMonth(-1));
$("next-month").addEventListener("click",()=>changeMonth(1));
$("calendar").addEventListener("click",event=>{ const button=event.target.closest("[data-date]"); if(!button)return; state.selected=state.selected===button.dataset.date?null:button.dataset.date; save(); render(); });
$("show-all").addEventListener("click",()=>{state.selected=null;save();render();});
$("service-date").addEventListener("change",event=>{ if(!event.target.value)return; state.serviceDate=event.target.value; state.month=state.serviceDate.slice(0,7); state.selected=null; save(); render(); });
$("event-form").addEventListener("submit",event=>{ event.preventDefault(); const form=event.currentTarget; const values=new FormData(form); const date=String(values.get("date")); state.events.push({id:uid(),date,type:String(values.get("type")),title:String(values.get("title")).trim(),intro:String(values.get("intro")).trim(),owner:String(values.get("owner")).trim()}); state.month=date.slice(0,7); state.selected=date; save(); form.reset(); render(); });
$("events").addEventListener("click",event=>{
  const add=event.target.closest("[data-event-add]"); const remove=event.target.closest("[data-event-delete]");
  if(add) { const item=state.events.find(e=>e.id===add.dataset.eventAdd); if(!item || item.date!==state.serviceDate)return; state.blocks.push({id:uid(),time:"10:35",kind:item.type==="Birthday greeting"?"Birthday":"Announcement",title:item.title,owner:item.owner,cue:item.intro,needs:{person:true,asset:true,cue:true},done:{person:false,asset:false,cue:false}}); save(); render(); $("blocks").scrollIntoView({behavior:"smooth",block:"start"}); }
  if(remove) { state.events=state.events.filter(e=>e.id!==remove.dataset.eventDelete); save(); render(); }
});
$("block-form").addEventListener("submit",event=>{ event.preventDefault(); const form=event.currentTarget; const values=new FormData(form); state.blocks.push({id:uid(),time:String(values.get("time")),kind:String(values.get("kind")),title:String(values.get("title")).trim(),owner:String(values.get("owner")).trim(),cue:"",needs:{person:true,asset:false,cue:true},done:{person:false,asset:false,cue:false}}); save(); form.reset(); render(); });
$("blocks").addEventListener("submit",event=>{
  const form=event.target.closest(".block-edit"); if(!form)return; event.preventDefault();
  const block=state.blocks.find(b=>b.id===form.closest("[data-block-id]").dataset.blockId); if(!block)return;
  const values=new FormData(form); for(const key of ["time","kind","title","owner","cue"]) block[key]=String(values.get(key)||"").trim();
  for(const key of ["person","asset","cue"]) { block.needs[key]=values.has(`need-${key}`); block.done[key]=values.has(`done-${key}`); }
  save(); render();
});
$("blocks").addEventListener("click",event=>{
  const card=event.target.closest("[data-block-id]"); if(!card)return;
  const index=state.blocks.findIndex(b=>b.id===card.dataset.blockId); if(index<0)return;
  const move=event.target.closest("[data-move]");
  if(move) { const target=index+(move.dataset.move==="up"?-1:1); if(target>=0&&target<state.blocks.length) [state.blocks[index],state.blocks[target]]=[state.blocks[target],state.blocks[index]]; save(); render(); }
  if(event.target.closest("[data-delete-block]")) { state.blocks.splice(index,1); save(); render(); }
});
$("blocks").addEventListener("pointerdown",event=>{
  const handle=event.target.closest(".drag"); if(!handle)return;
  dragging={card:handle.closest("[data-block-id]"),handle};
  handle.setPointerCapture(event.pointerId);
  dragging.card.classList.add("dragging");
});
$("blocks").addEventListener("pointermove",event=>{
  if(!dragging)return;
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-block-id]");
  if(!target || target===dragging.card || target.parentElement!==$("blocks"))return;
  const midpoint=target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;
  $("blocks").insertBefore(dragging.card,event.clientY<midpoint?target:target.nextSibling);
});
function endDrag() {
  if(!dragging)return;
  dragging.card.classList.remove("dragging");
  const ids=[...$("blocks").querySelectorAll("[data-block-id]")].map(card=>card.dataset.blockId);
  state.blocks.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id)); dragging=null; save(); render();
}
$("blocks").addEventListener("pointerup",endDrag);
$("blocks").addEventListener("pointercancel",endDrag);
$("reset").addEventListener("click",()=>{ state=sample(); save(); render(); window.scrollTo({top:0,behavior:"smooth"}); });
render();
