// Event registration demo (register.html). Everything stays in this browser: nothing is sent,
// saved online or charged. The form keeps a draft in sessionStorage so a refresh doesn't wipe
// it (the ABCI Youth site we copied this flow from loses everything on refresh).
(function () {
  "use strict";

  // Sample event. Swap these for a real event when this becomes the real thing.
  const EVENT = {
    title: "Anniversary Celebration",
    tagline: "One day of worship, thanksgiving and lunch together as one JIA family.",
    start: "2027-03-07T09:00:00+08:00",
    end: "2027-03-07T14:00:00+08:00",
    whenText: "Sun, March 7, 2027 · 9:00 AM",
    venue: "JIA Alabang, 107 Mayor J. Posadas Ave, Sucat",
    fee: 200,
    seats: [
      { id: "main", label: "Main hall", note: "Closest to the stage", left: 42 },
      { id: "side", label: "Side section", note: "Good view of the screens", left: 18 },
      { id: "family", label: "Family area", note: "Near the exit, for kids", left: 9 },
      { id: "online", label: "Watch online", note: "FB Live link by email", left: 0, unlimited: true },
    ],
  };
  const DRAFT_KEY = "jia-register-draft-v1";

  const $ = (id) => document.getElementById(id);
  const form = $("form");
  let step = 1;
  let group = false;
  let proofDataUrl = "";

  // ---------- Event panel ----------
  $("ev-title").textContent = EVENT.title;
  $("ev-tagline").textContent = EVENT.tagline;
  $("ev-when").textContent = EVENT.whenText;
  $("ev-map").textContent = EVENT.venue + " ↗";
  $("ev-map").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(EVENT.venue + ", Muntinlupa");

  function tick() {
    let ms = Math.max(0, new Date(EVENT.start) - Date.now());
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4); ms -= m * 6e4;
    $("cd-d").textContent = d;
    $("cd-h").textContent = String(h).padStart(2, "0");
    $("cd-m").textContent = String(m).padStart(2, "0");
    $("cd-s").textContent = String(Math.floor(ms / 1000)).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);

  function downloadCalendar() {
    const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JIA Alabang//Media Desk//EN",
      "BEGIN:VEVENT",
      "UID:jia-anniversary-demo@jia-media-desk",
      "DTSTAMP:" + stamp(new Date().toISOString()),
      "DTSTART:" + stamp(EVENT.start), "DTEND:" + stamp(EVENT.end),
      "SUMMARY:JIA Alabang " + EVENT.title,
      "LOCATION:" + EVENT.venue.replace(/,/g, "\\,"),
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    saveBlob(new Blob([ics], { type: "text/calendar" }), "jia-anniversary.ics");
  }
  $("ev-cal").addEventListener("click", downloadCalendar);
  $("pass-cal").addEventListener("click", downloadCalendar);

  $("ev-share").addEventListener("click", async () => {
    const data = { title: "JIA Alabang " + EVENT.title, url: location.href };
    try {
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(location.href);
      alert("Link copied.");
    } catch (e) { /* user closed the share sheet */ }
  });

  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- QR drawing ----------
  function drawQr(canvas, text) {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 2;
    const size = canvas.width;
    const cell = Math.floor(size / (n + quiet * 2));
    const offset = Math.floor((size - cell * n) / 2);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#184829";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
    }
  }
  drawQr($("gcash-qr"), "SAMPLE ONLY - not a real GCash QR");
  $("pay-amount").textContent = "₱" + EVENT.fee;

  // ---------- Seats ----------
  $("seat-choices").innerHTML = EVENT.seats.map((s) => {
    const full = !s.unlimited && s.left <= 0;
    const left = s.unlimited ? "No limit" : s.left + " seats left";
    return `<label class="choice${full ? " full-seat" : ""}"><input type="radio" name="seat" value="${s.id}"${full ? " disabled" : ""} required>
      <strong>${s.label}</strong><small>${s.note}</small><small>${left}</small></label>`;
  }).join("");
  const seatLabel = (id) => (EVENT.seats.find((s) => s.id === id) || {}).label || "";

  // ---------- Individual / Group ----------
  function setMode(isGroup) {
    group = isGroup;
    $("mode-single").setAttribute("aria-selected", String(!isGroup));
    $("mode-group").setAttribute("aria-selected", String(isGroup));
    $("group-box").hidden = !isGroup;
    if (isGroup && !$("group-list").children.length) addPerson();
    updatePayAmount();
    saveDraft();
  }
  function addPerson(name = "", age = "") {
    const row = document.createElement("div");
    row.className = "group-row";
    row.innerHTML = `<input type="text" placeholder="Full name" aria-label="Group member name">
      <input type="number" placeholder="Age" min="1" max="120" aria-label="Group member age">
      <button type="button" class="secondary" aria-label="Remove person">✕</button>`;
    row.children[0].value = name;
    row.children[1].value = age;
    row.children[2].addEventListener("click", () => { row.remove(); updatePayAmount(); saveDraft(); });
    row.addEventListener("input", () => { updatePayAmount(); saveDraft(); });
    $("group-list").appendChild(row);
    updatePayAmount();
  }
  function groupMembers() {
    if (!group) return [];
    return [...$("group-list").children]
      .map((r) => ({ name: r.children[0].value.trim(), age: r.children[1].value.trim() }))
      .filter((p) => p.name);
  }
  function headcount() { return 1 + groupMembers().length; }
  function updatePayAmount() {
    const n = headcount();
    $("pay-amount").textContent = "₱" + EVENT.fee * n + (n > 1 ? ` (${n} × ₱${EVENT.fee})` : "");
  }
  $("mode-single").addEventListener("click", () => setMode(false));
  $("mode-group").addEventListener("click", () => setMode(true));
  $("add-person").addEventListener("click", () => { addPerson(); saveDraft(); });

  // ---------- Payment screenshot preview ----------
  form.proof.addEventListener("change", () => {
    const file = form.proof.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showError("Screenshot is over 5 MB. Try a smaller one."); form.proof.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => { proofDataUrl = reader.result; $("proof-preview").src = proofDataUrl; $("proof-preview").hidden = false; };
    reader.readAsDataURL(file);
  });

  // ---------- Draft (survives a refresh, cleared when the tab closes) ----------
  const DRAFT_FIELDS = ["name", "age", "mobile", "email", "church", "role", "lunch", "sender", "ref"];
  function saveDraft() {
    const d = { step, group, seat: (form.seat && form.seat.value) || "", people: groupMembers() };
    DRAFT_FIELDS.forEach((f) => { d[f] = form[f].value; });
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }
  function loadDraft() {
    let d;
    try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { d = null; }
    if (!d) return;
    DRAFT_FIELDS.forEach((f) => { if (d[f] != null) form[f].value = d[f]; });
    if (d.seat) { const r = form.querySelector(`input[name=seat][value="${d.seat}"]`); if (r) r.checked = true; }
    if (d.group) { (d.people || []).forEach((p) => addPerson(p.name, p.age)); setMode(true); }
    // The screenshot can't be kept, so never resume past the payment step without it.
    show(Math.min(d.step || 1, 3), false);
  }
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  // ---------- Steps ----------
  function show(n, scroll = true) {
    step = n;
    form.querySelectorAll("[data-step]").forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
    [...$("steps").children].forEach((li, i) => {
      li.className = i + 1 < n ? "done" : i + 1 === n ? "now" : "";
    });
    $("back").style.visibility = n === 1 ? "hidden" : "visible";
    $("next").textContent = n === 4 ? "Submit registration ✓" : "Continue →";
    $("error").hidden = true;
    if (n === 3) updatePayAmount();
    if (n === 4) renderReview();
    saveDraft();
    if (scroll) window.scrollTo({ top: document.querySelector(".panel").offsetTop - 8, behavior: "smooth" });
  }
  function showError(msg) { $("error").textContent = msg; $("error").hidden = false; }

  function checkStep(n) {
    const box = form.querySelector(`[data-step="${n}"]`);
    const bad = [...box.querySelectorAll("input[required], select[required]")].find((el) => {
      if (el.type === "radio") return !form.querySelector(`input[name="${el.name}"]:checked`);
      if (el.type === "checkbox") return !el.checked;
      return !el.checkValidity() || !el.value.trim();
    });
    if (bad) {
      const label = bad.closest("label");
      const what = bad.type === "radio" ? "a seating option" : bad.type === "checkbox" ? "the agreement box" : (label ? label.firstChild.textContent.trim().toLowerCase() : "this field");
      showError("Please check " + what + ".");
      if (bad.type !== "radio") bad.focus();
      return false;
    }
    if (n === 1 && group && groupMembers().length === 0) { showError("Add at least one person, or switch to Individual."); return false; }
    if (n === 3 && !/^\d{13}$/.test(form.ref.value.replace(/\s/g, ""))) { showError("GCash reference numbers have 13 digits."); form.ref.focus(); return false; }
    if (n === 3 && !proofDataUrl) { showError("Please upload your payment screenshot."); return false; }
    return true;
  }

  function renderReview() {
    const people = groupMembers();
    const cell = (label, html) => `<div><small>${label}</small>${html}</div>`;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    $("review").innerHTML =
      cell("Registrant", `<strong>${esc(form.name.value)}</strong><br>${esc(form.email.value)}<br>${esc(form.mobile.value)}`) +
      cell("Church", `<strong>${esc(form.church.value)}</strong><br>${esc(form.role.value)}`) +
      cell("Seating", `<strong>${esc(seatLabel(form.seat.value))}</strong><br>Lunch: ${esc(form.lunch.value)}`) +
      cell("Payment", `<strong>₱${EVENT.fee * headcount()}</strong> from ${esc(form.sender.value)}<br>Ref ${esc(form.ref.value)}`) +
      (people.length ? `<div style="grid-column:1/-1"><small>Group (${people.length + 1} people)</small>${people.map((p) => esc(p.name)).join(", ")}</div>` : "");
  }

  $("back").addEventListener("click", () => show(Math.max(1, step - 1)));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!checkStep(step)) return;
    if (step < 4) return show(step + 1);
    finish();
  });

  // ---------- Pass ----------
  function makeCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, easier to read out loud
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return "JIA-" + [...bytes].map((b) => chars[b % chars.length]).join("");
  }
  const passes = [];
  function renderPass(p) {
    $("pass-name").textContent = p.name;
    $("pass-church").textContent = form.church.value;
    $("pass-code").textContent = p.code;
    $("pass-seat").textContent = seatLabel(form.seat.value);
    $("pass-lunch").textContent = form.lunch.value;
    drawQr($("pass-qr"), p.code);
    $("save-qr").dataset.code = p.code;
  }
  function finish() {
    passes.length = 0;
    [{ name: form.name.value.trim() }, ...groupMembers()].forEach((p) => passes.push({ name: p.name, code: makeCode() }));
    $("form-view").hidden = true;
    $("pass-view").hidden = false;
    renderPass(passes[0]);
    if (passes.length > 1) {
      $("others").hidden = false;
      passes.forEach((p) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "secondary"; b.textContent = p.name;
        b.addEventListener("click", () => renderPass(p));
        $("others").appendChild(b);
      });
    }
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("save-qr").addEventListener("click", () => {
    // Draw the pass as one image: name, QR and code, so the saved photo works on its own.
    const src = $("pass-qr");
    const out = document.createElement("canvas");
    out.width = 600; out.height = 760;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 600, 760);
    ctx.fillStyle = "#184829"; ctx.fillRect(0, 0, 600, 16);
    ctx.textAlign = "center"; ctx.fillStyle = "#102a18";
    ctx.font = "800 26px Montserrat, sans-serif"; ctx.fillText("JIA ALABANG " + EVENT.title.toUpperCase(), 300, 70);
    ctx.font = "600 34px Montserrat, sans-serif"; ctx.fillText($("pass-name").textContent, 300, 120);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 100, 150, 400, 400);
    ctx.font = "800 36px Montserrat, sans-serif"; ctx.fillText($("save-qr").dataset.code, 300, 610);
    ctx.font = "500 22px Montserrat, sans-serif"; ctx.fillStyle = "#425649";
    ctx.fillText(EVENT.whenText, 300, 660); ctx.fillText("Sample pass. Not valid for entry.", 300, 700);
    out.toBlob((blob) => saveBlob(blob, $("save-qr").dataset.code + ".png"), "image/png");
  });

  $("wallet").addEventListener("click", () => {
    alert("Apple Wallet needs a pass signed with an Apple Developer account (US$99/year) and a small server to sign it. For the demo, use Save QR image instead; it works the same at check-in.");
  });

  loadDraft();
  if (step === 1) show(1, false);
})();
