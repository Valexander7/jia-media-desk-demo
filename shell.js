// Odoo-style shell for every Media Desk page (John, 2026-10-05: "make it almost like Odoo").
// Like Odoo's web client: one list of apps drives the home launcher and every page's top bar.
// The top bar is [apps grid icon] [app name] [app menus]; the grid icon (or Alt+H) goes home,
// and on the home screen you can just start typing to find an app.
// A page opts in with <body data-app="id"> and an empty <header class="jia-header">.
// Anything inside the header marked data-keep (e.g. the demo's Reset button) stays on the right.
(function () {
  "use strict";

  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  // One place to add an app. Order here is the order on the home screen.
  const APPS = [
    { id: "live", name: "Sunday Checklist", tag: "Pilot", href: "live.html", color: "#184829",
      icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8l2 2 4-4M8 15h8"/>',
      menus: [{ label: "Checklist", href: "live.html" }, { label: "Live Camera", href: "tally.html" }] },
    { id: "tally", name: "Live Camera", tag: "Trial", href: "tally.html", color: "#c0161b",
      icon: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/><circle cx="6.5" cy="10" r="1.2" fill="currentColor"/>',
      menus: [{ label: "Director", href: "tally.html?as=director" }, { label: "Cam 1", href: "tally.html?as=cam1" }, { label: "Cam 2", href: "tally.html?as=cam2" }] },
    { id: "program", name: "Program Team", tag: "Preview", href: "program.html", color: "#157f44",
      icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/>',
      menus: [{ label: "Sunday flow", href: "program.html" }] },
    { id: "register", name: "Event Registration", tag: "Demo", href: "register.html", color: "#b0256b",
      icon: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 5v12" stroke-dasharray="2 2"/>',
      menus: [{ label: "Register", href: "register.html" }] },
    { id: "visuals", name: "Visuals", tag: "Canva guide", href: "visuals.html", color: "#7a3fa0",
      icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
      menus: [{ label: "Canva", href: "visuals.html#canva-how" }, { label: "Teaser", href: "visuals.html#v-teaser" }, { label: "Thumbnail", href: "visuals.html#v-thumb" },
        { label: "Announcements", href: "visuals.html#v-announce" }, { label: "Birthdays", href: "visuals.html#v-bday" }, { label: "Rules", href: "visuals.html#rules" }] },
    { id: "roadmap", name: "Roadmap", tag: "What's next", href: "roadmap.html", color: "#c77a12",
      icon: '<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
      menus: [{ label: "ASSESS vote", href: "roadmap.html#p-assess" }, { label: "Second camera", href: "roadmap.html#p-cam" },
        { label: "Design system", href: "roadmap.html#p-design" }, { label: "This website", href: "roadmap.html#p-desk" }] },
    { id: "flow", name: "Program Flow", tag: "Drive ↗", href: "https://drive.google.com/file/d/1SWlV6LEeAKeF2pVnzaVrCRnKNvO9rhD2/view", color: "#1f5f8b", external: true,
      icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>' },
    { id: "sheet", name: "Media Run Sheet", tag: "Drive ↗", href: "https://docs.google.com/spreadsheets/d/1ItieZgLx6cOteA-jBNAFiQaqH71Zr6w1y_Wyo9wKMaw/edit", color: "#2e7d4f", external: true,
      icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>' },
    { id: "demo", name: "Demo", tag: "Sample data", href: "demo.html", color: "#5b6b61",
      icon: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/>',
      menus: [] },
  ];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const appId = document.body.dataset.app || "home";
  const app = APPS.find((a) => a.id === appId);
  const here = location.pathname.split("/").pop() + location.search + location.hash;

  // ---------- Top bar ----------
  const header = document.querySelector("header.jia-header");
  if (header) {
    const keep = [...header.querySelectorAll("[data-keep]")];
    const menus = (app && app.menus) || [];
    const isActive = (m) => here === m.href || (!m.href.includes("#") && !m.href.includes("?") && here.split(/[?#]/)[0] === m.href && menus.filter((x) => x.href.split(/[?#]/)[0] === m.href).length === 1);
    const menuLinks = menus.map((m) => `<a href="${esc(m.href)}"${isActive(m) ? ' aria-current="page"' : ""}>${esc(m.label)}</a>`).join("");
    header.classList.add("o-navbar");
    header.innerHTML = `
      <a class="o-home" href="index.html" title="Home menu (Alt+H)" aria-label="Home menu">${svg('<circle cx="5" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="19" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/><circle cx="19" cy="19" r="1.6" fill="currentColor"/>')}</a>
      <a class="o-brand" href="${app ? esc(app.href) : "index.html"}">${app ? esc(app.name) : "Media Desk"}</a>
      ${menus.length ? `<nav class="o-menus" aria-label="${esc(app.name)} menu">${menuLinks}</nav>
      <details class="o-burger"><summary aria-label="${esc(app.name)} menu">${svg('<path d="M4 6h16M4 12h16M4 18h16"/>')}</summary><nav>${menuLinks}</nav></details>` : ""}
      <span class="o-spacer"></span>
      <img class="o-logo" src="jia-logo-176.png" alt="JIA Alabang" width="32" height="32">`;
    keep.forEach((el) => header.insertBefore(el, header.querySelector(".o-logo")));
    const burger = header.querySelector(".o-burger");
    if (burger) {
      burger.addEventListener("click", (e) => { if (e.target.closest("a")) burger.open = false; });
      document.addEventListener("click", (e) => { if (!burger.contains(e.target)) burger.open = false; });
    }

    // Breadcrumb under the bar, like Odoo's control panel: Media Desk / App.
    if (app) {
      const crumbs = document.createElement("div");
      crumbs.className = "o-crumbs";
      crumbs.innerHTML = `<a href="index.html">Media Desk</a><span aria-hidden="true">/</span><span>${esc(app.name)}</span>${app.tag ? `<span class="o-tag">${esc(app.tag)}</span>` : ""}`;
      header.after(crumbs);
    }
  }

  // Alt+H goes home, like Odoo.
  document.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "h" || e.key === "H" || e.code === "KeyH")) { e.preventDefault(); location.href = "index.html"; }
  });

  // ---------- Home launcher ----------
  function initHome() {
  const grid = document.getElementById("apps");
  if (grid) {
    grid.innerHTML = APPS.map((a) => `
      <a class="app" href="${esc(a.href)}"${a.external ? ' target="_blank" rel="noopener noreferrer"' : ""} data-name="${esc(a.name.toLowerCase())}">
        <span class="icon" style="background:${a.color}" aria-hidden="true">${svg(a.icon)}</span>
        <span>${esc(a.name)}<span class="tag">${esc(a.tag)}</span></span>
      </a>`).join("");
    const search = document.getElementById("app-search");
    const empty = document.getElementById("apps-empty");
    const filter = () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      grid.querySelectorAll(".app").forEach((el) => { const ok = !q || el.dataset.name.includes(q); el.hidden = !ok; if (ok) shown++; });
      empty.hidden = shown > 0;
    };
    search.addEventListener("input", filter);
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const first = grid.querySelector(".app:not([hidden])"); if (first) first.click(); }
      if (e.key === "Escape") { search.value = ""; filter(); search.blur(); }
    });
    // Odoo home: start typing anywhere to search apps (desktop keyboards only; no surprise keyboards on phones).
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || document.activeElement === search) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      search.focus();
    });
  }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initHome); else initHome();
})();
