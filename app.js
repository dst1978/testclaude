'use strict';

const STORE_KEY = 'foodlog.v1';
const GOAL_KEY = 'foodlog.goal';
const FIELDS = ['carbs', 'protein', 'fat', 'fiber', 'sugar', 'salt'];
const MEALS = { breakfast: 'Ontbijt', lunch: 'Lunch', dinner: 'Avondeten', snack: 'Snack' };
const LABELS = { kcal: 'kcal', carbs: 'Koolhydraten', protein: 'Eiwitten', fat: 'Vetten', fiber: 'Vezels', sugar: 'Suikers', salt: 'Zout' };
const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

// ---------- pure helpers ----------
const calcKcal = (c, p, f) => Math.round(4 * c + 4 * p + 9 * f);
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const weekStart = iso => { const d = fromISO(iso); return addDays(iso, -((d.getDay() + 6) % 7)); };
const weekRange = iso => { const s = weekStart(iso); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };
const round = (n, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

function sumEntries(list) {
  const t = { kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 };
  for (const e of list) for (const k in t) t[k] += Number(e[k]) || 0;
  return t;
}

// ---------- state ----------
let entries = [];
try { entries = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { entries = []; }
let dayISO = toISO(new Date());
let weekISO = dayISO;
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); } catch {} };

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- form ----------
function updateKcal() {
  if ($('f-auto').checked) $('f-kcal').value = calcKcal(+$('f-carbs').value || 0, +$('f-protein').value || 0, +$('f-fat').value || 0);
  $('f-kcal').readOnly = $('f-auto').checked;
}
['f-carbs', 'f-protein', 'f-fat', 'f-auto'].forEach(id => $(id).addEventListener('input', updateKcal));

function resetForm() {
  $('entry-form').reset();
  $('f-id').value = '';
  $('f-date').value = dayISO;
  $('form-title').textContent = 'Voeding toevoegen';
  $('f-submit').textContent = 'Toevoegen';
  $('f-cancel').hidden = true;
  updateKcal();
}

$('entry-form').addEventListener('submit', ev => {
  ev.preventDefault();
  const auto = $('f-auto').checked;
  const e = {
    id: $('f-id').value || crypto.randomUUID(),
    date: $('f-date').value,
    meal: $('f-meal').value,
    name: $('f-name').value.trim(),
    manualKcal: !auto,
  };
  for (const k of FIELDS) e[k] = Math.max(0, +$('f-' + k).value || 0);
  e.kcal = auto ? calcKcal(e.carbs, e.protein, e.fat) : Math.max(0, +$('f-kcal').value || 0);
  const i = entries.findIndex(x => x.id === e.id);
  if (i >= 0) entries[i] = e; else entries.push(e);
  save();
  dayISO = e.date;
  resetForm();
  render();
});

$('f-cancel').addEventListener('click', resetForm);

function editEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  $('f-id').value = e.id;
  $('f-name').value = e.name;
  $('f-date').value = e.date;
  $('f-meal').value = e.meal;
  for (const k of FIELDS) $('f-' + k).value = e[k];
  $('f-auto').checked = !e.manualKcal;
  $('f-kcal').value = e.kcal;
  updateKcal();
  if (e.manualKcal) $('f-kcal').value = e.kcal;
  $('form-title').textContent = 'Voeding wijzigen';
  $('f-submit').textContent = 'Opslaan';
  $('f-cancel').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEntry(id) {
  entries = entries.filter(x => x.id !== id);
  save();
  render();
}

// ---------- rendering ----------
function statsHTML(t, days = 1) {
  const items = [['kcal', Math.round(t.kcal), 'kcal']];
  for (const k of FIELDS) items.push([k, round(t[k], k === 'salt' ? 2 : 1), 'g']);
  return items.map(([k, v, u]) => `<div class="stat"><b>${v}</b><span>${LABELS[k]} (${u})</span></div>`).join('');
}

function renderDay() {
  $('day-date').value = dayISO;
  const list = entries.filter(e => e.date === dayISO);
  const t = sumEntries(list);
  $('day-totals').innerHTML = statsHTML(t);

  const goal = +localStorage.getItem(GOAL_KEY) || 0;
  $('goal').value = goal || '';
  const pct = goal ? Math.min(100, (t.kcal / goal) * 100) : 0;
  $('goal-bar').style.width = pct + '%';
  $('goal-bar').classList.toggle('over', goal > 0 && t.kcal > goal);
  $('goal-text').textContent = goal ? `${Math.round(t.kcal)} / ${goal} kcal (${Math.round((t.kcal / goal) * 100)}%)` : 'Stel een dagdoel in om voortgang te zien.';

  const macroKcal = t.carbs * 4 + t.protein * 4 + t.fat * 9;
  const split = macroKcal ? ` · Verdeling: KH ${Math.round(t.carbs * 4 / macroKcal * 100)}% / E ${Math.round(t.protein * 4 / macroKcal * 100)}% / V ${Math.round(t.fat * 9 / macroKcal * 100)}%` : '';

  let html = '';
  for (const [key, label] of Object.entries(MEALS)) {
    const items = list.filter(e => e.meal === key);
    if (!items.length) continue;
    html += `<div class="meal"><h3>${label} – ${Math.round(sumEntries(items).kcal)} kcal</h3>` + items.map(e =>
      `<div class="entry"><div><strong>${esc(e.name)}</strong><small>${Math.round(e.kcal)} kcal · KH ${e.carbs}g · E ${e.protein}g · V ${e.fat}g</small></div>
       <div><button data-edit="${e.id}">✎</button> <button data-del="${e.id}">✕</button></div></div>`).join('') + '</div>';
  }
  $('day-entries').innerHTML = (html || '<p>Geen items voor deze dag.</p>') + (split ? `<small>${split.slice(3)}</small>` : '');
}

function renderWeek() {
  const days = weekRange(weekISO);
  $('week-label').textContent = `${days[0]} → ${days[6]}`;
  const perDay = days.map(d => sumEntries(entries.filter(e => e.date === d)));
  const max = Math.max(1, ...perDay.map(t => t.kcal));
  $('week-chart').innerHTML = perDay.map((t, i) =>
    `<div class="col">${Math.round(t.kcal)}<div style="height:${(t.kcal / max) * 120}px"></div>${DAYS[i]}</div>`).join('');

  const total = sumEntries(perDay);
  const logged = perDay.filter(t => t.kcal > 0).length;
  $('week-totals').innerHTML =
    `<div class="stat"><b>${Math.round(total.kcal)}</b><span>Totaal kcal</span></div>` +
    `<div class="stat"><b>${logged ? Math.round(total.kcal / logged) : 0}</b><span>Gem. kcal/dag (${logged} dagen)</span></div>` +
    FIELDS.slice(0, 3).map(k => `<div class="stat"><b>${round(total[k])}</b><span>${LABELS[k]} (g)</span></div>`).join('');

  $('week-table').innerHTML =
    `<tr><th>Dag</th><th>kcal</th><th>KH</th><th>E</th><th>V</th></tr>` +
    days.map((d, i) => `<tr><td>${DAYS[i]} ${d.slice(5)}</td><td>${Math.round(perDay[i].kcal)}</td><td>${round(perDay[i].carbs)}</td><td>${round(perDay[i].protein)}</td><td>${round(perDay[i].fat)}</td></tr>`).join('');
}

function render() { renderDay(); renderWeek(); }

// ---------- events ----------
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
  $('view-day').hidden = b.dataset.view !== 'day';
  $('view-week').hidden = b.dataset.view !== 'week';
}));
$('day-prev').onclick = () => { dayISO = addDays(dayISO, -1); renderDay(); };
$('day-next').onclick = () => { dayISO = addDays(dayISO, 1); renderDay(); };
$('day-today').onclick = () => { dayISO = toISO(new Date()); renderDay(); };
$('day-date').onchange = e => { if (e.target.value) { dayISO = e.target.value; renderDay(); } };
$('week-prev').onclick = () => { weekISO = addDays(weekISO, -7); renderWeek(); };
$('week-next').onclick = () => { weekISO = addDays(weekISO, 7); renderWeek(); };
$('week-today').onclick = () => { weekISO = toISO(new Date()); renderWeek(); };
$('goal').onchange = e => { try { localStorage.setItem(GOAL_KEY, +e.target.value || 0); } catch {} renderDay(); };
$('day-entries').addEventListener('click', ev => {
  const t = ev.target;
  if (t.dataset.edit) editEntry(t.dataset.edit);
  if (t.dataset.del) deleteEntry(t.dataset.del);
});

$('export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
  a.download = 'voedingsdagboek.json';
  a.click();
  URL.revokeObjectURL(a.href);
};
$('import').onchange = async ev => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error('format');
    const ids = new Set(entries.map(e => e.id));
    for (const e of data) if (e && e.id && e.date && !ids.has(e.id)) entries.push(e);
    save();
    render();
  } catch { alert('Ongeldig bestand.'); }
  ev.target.value = '';
};

resetForm();
render();
