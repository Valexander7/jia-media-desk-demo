"use strict";

// Recurring Sunday items. Source: Program Flow (Drive) and John, 2026-10-01 / 2026-10-03.
// "when" is one of: "every", "1st", "2nd", "3rd", "4th", "last".
// Later these rows move to the Drive checklist sheet so the media leaders can edit them.
const SUNDAY_RULES = [
  {when:"1st",   text:"Breaking of the Bread", team:"Program · Helps & Ushering"},
  {when:"3rd",   text:"Breaking of the Bread", team:"Program · Helps & Ushering"},
  {when:"4th",   text:"Homogeneous hosting", team:"Program"},  // John, 2026-10-03: 4th Sunday, not last
  {when:"last",  text:"Call this month's birthday celebrants on stage; birthday green-screen banner ready", team:"Program · Onsite Projection"},
  {when:"every", text:"New FB Live thumbnail for this Sunday", team:"Visual", saturday:true}
];

// One-off church events shown on the Program calendar. Add a row per event; no birthdays or minors' names (public page).
const CHURCH_EVENTS = [
  {date:"2026-10-04", text:"Call October birthday celebrants on stage after service", team:"Program · Onsite Projection"},
  {date:"2026-10-11", text:"Pastor's Appreciation", team:"Program · Media"}
];

// Today's calendar date in Manila, as a Date at noon UTC, so day-of-month maths can't slip across midnight.
function manilaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Manila", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(now);
  const get = type => Number(parts.find(p => p.type === type).value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 12));
}

// The Sunday this card is about: today if it is Sunday, otherwise the coming Sunday.
function upcomingSunday(now = new Date()) {
  const today = manilaToday(now);
  return new Date(today.getTime() + ((7 - today.getUTCDay()) % 7) * 86400000);
}

// Does this rule apply on this Sunday? sunday is a Date at noon UTC; use getUTCDate()/getUTCMonth().
function matchesRule(rule, sunday) {
  if (rule.when === "every") return true;
  const day = sunday.getUTCDate();
  if (rule.when === "last") {
    // Last Sunday: a week later is already next month. Handles 5-Sunday months.
    return new Date(sunday.getTime() + 7 * 86400000).getUTCMonth() !== sunday.getUTCMonth();
  }
  const nth = {"1st":1, "2nd":2, "3rd":3, "4th":4}[rule.when];
  return nth === Math.ceil(day / 7);
}

function renderSundayCard(target, now = new Date()) {
  const sunday = upcomingSunday(now);
  const sundayDate = sunday.toISOString().slice(0, 10);
  const items = [
    ...SUNDAY_RULES.filter(rule => matchesRule(rule, sunday)),
    ...CHURCH_EVENTS.filter(ev => ev.date === sundayDate).map(ev => ({when:"event", text:ev.text, team:ev.team}))
  ];
  const label = new Intl.DateTimeFormat("en-PH", {timeZone:"UTC", weekday:"long", month:"long", day:"numeric"}).format(sunday);
  const isSaturday = manilaToday(now).getUTCDay() === 6;

  const title = document.createElement("h2");
  title.textContent = "This Sunday · " + label;
  const note = document.createElement("p");
  note.className = "muted small-note";
  note.textContent = items.some(i => i.when !== "every")
    ? "Special items for this Sunday. Confirm with the Sunday Service Program in Drive."
    : "Regular Sunday. No special items from the monthly rules.";
  const list = document.createElement("ul");
  list.className = "reminders";
  for (const item of items) {
    const li = document.createElement("li");
    const text = document.createElement("strong");
    text.textContent = item.text;
    const team = document.createElement("span");
    team.className = "muted small-note";
    team.textContent = item.team + (item.saturday && isSaturday ? " · prep today" : "");
    li.append(text, team);
    list.append(li);
  }
  target.replaceChildren(title, note, list);
  target.hidden = false;
}

const card = document.getElementById("sunday-card");
if (card) {
  try { renderSundayCard(card); }
  catch (error) { card.hidden = true; console.error("Sunday reminders unavailable", error); }
}
