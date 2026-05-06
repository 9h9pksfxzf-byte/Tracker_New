import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell } from "recharts";

// ─── STORAGE (Safari-kompatibel via localStorage) ───────────────────────────
const DB = {
  async get(key) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : null;
    } catch { return null; }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error("Speichern fehlgeschlagen", e); }
  },
};

const todayKey = () => new Date().toISOString().split("T")[0];
const fmtDate = (k) =>
  new Date(k + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });

const EMPTY_ENTRY   = { desc: "", kcal: "", prot: "", carbs: "", fat: "", fiber: "" };
const DEFAULT_GOALS = { kcal: 2000, prot: 150, carbs: 250, fat: 70, fiber: 30 };
const sum  = (arr, key) => arr.reduce((s, i) => s + (i[key] || 0), 0);
const int  = (v) => parseInt(v) || 0;

// ─── MACRO FORM HOOK ─────────────────────────────────────────────────────────
function useMacroForm() {
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [kcalAuto, setKcalAuto] = useState(true);

  const calcKcal = (f) => {
    const p = int(f.prot), c = int(f.carbs), fa = int(f.fat);
    const total = p * 4 + c * 4 + fa * 9;
    return total > 0 ? String(total) : "";
  };

  const setMacro = (k) => (e) => {
    setForm((f) => {
      const next = { ...f, [k]: e.target.value };
      if (kcalAuto) next.kcal = calcKcal(next);
      return next;
    });
  };

  const setKcal = (e) => {
    setKcalAuto(false);
    setForm((f) => ({ ...f, kcal: e.target.value }));
  };

  const reset = () => { setForm(EMPTY_ENTRY); setKcalAuto(true); };

  return { form, kcalAuto, setMacro, setKcal, setDesc: (e) => setForm((f) => ({ ...f, desc: e.target.value })), reset };
}

// ─── UI ATOMS ────────────────────────────────────────────────────────────────
function StatBar({ label, value, max, unit, accent }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  const over = value > max;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">{label}</span>
        <span className={`text-xs font-bold ${over ? "text-red-500" : "text-stone-700"}`}>
          {value}<span className="font-normal text-stone-400"> / {max} {unit}</span>
        </span>
      </div>
      <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: over ? "#ef4444" : accent, transition: "width 0.5s ease" }} className="h-full rounded-full" />
      </div>
    </div>
  );
}

function KcalInp({ value, onChange, isAuto }) {
  return (
    <div className="relative">
      <input value={value} onChange={onChange} placeholder="kcal" type="number"
        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-500 bg-stone-50 placeholder-stone-300 transition-colors pr-12" />
      {isAuto && value !== "" && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-stone-400 uppercase tracking-wider pointer-events-none">auto</span>
      )}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = "text", onKeyDown }) {
  return (
    <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} type={type}
      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-500 bg-stone-50 placeholder-stone-300 transition-colors" />
  );
}

function Btn({ onClick, children, small }) {
  return (
    <button onClick={onClick}
      className={`font-semibold rounded-xl transition-all active:scale-[0.99] bg-stone-900 text-white hover:bg-stone-700 ${small ? "text-xs px-3 py-1.5" : "w-full text-sm py-2.5"}`}>
      {children}
    </button>
  );
}

function Label({ children }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{children}</p>;
}

function MacroChips({ entry }) {
  return (
    <div className="flex flex-wrap gap-x-2 mt-0.5">
      <span className="text-xs text-stone-500">{entry.kcal} kcal</span>
      <span className="text-xs text-green-600">{entry.prot}g P</span>
      <span className="text-xs text-amber-600">{entry.carbs}g K</span>
      <span className="text-xs text-blue-500">{entry.fat}g F</span>
      {!!entry.fiber && <span className="text-xs text-purple-500">{entry.fiber}g B</span>}
    </div>
  );
}

// ─── VIEWS ───────────────────────────────────────────────────────────────────

function TodayView({ entries, goals, addEntry, removeEntry, onStar }) {
  const { form, kcalAuto, setMacro, setKcal, setDesc, reset } = useMacroForm();
  const submit = () => {
    if (!form.desc.trim()) return;
    addEntry({ desc: form.desc.trim(), kcal: int(form.kcal), prot: int(form.prot), carbs: int(form.carbs), fat: int(form.fat), fiber: int(form.fiber) });
    reset();
  };
  const t = { kcal: sum(entries,"kcal"), prot: sum(entries,"prot"), carbs: sum(entries,"carbs"), fat: sum(entries,"fat"), fiber: sum(entries,"fiber") };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm space-y-4">
        <StatBar label="Kalorien" value={t.kcal} max={goals.kcal} unit="kcal" accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein"        value={t.prot}  max={goals.prot}  unit="g" accent="#16a34a" />
          <StatBar label="Kohlenhydrate"  value={t.carbs} max={goals.carbs} unit="g" accent="#d97706" />
          <StatBar label="Fette"          value={t.fat}   max={goals.fat}   unit="g" accent="#3b82f6" />
          <StatBar label="Ballaststoffe"  value={t.fiber} max={goals.fiber} unit="g" accent="#9333ea" />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm space-y-3">
        <Label>Eintrag hinzufügen</Label>
        <Inp value={form.desc} onChange={setDesc} placeholder="Was gab es?" onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div className="grid grid-cols-2 gap-2">
          <KcalInp value={form.kcal} onChange={setKcal} isAuto={kcalAuto} />
          <Inp value={form.prot}  onChange={setMacro("prot")}  placeholder="Protein (g)"       type="number" />
          <Inp value={form.carbs} onChange={setMacro("carbs")} placeholder="Kohlenhydrate (g)" type="number" />
          <Inp value={form.fat}   onChange={setMacro("fat")}   placeholder="Fette (g)"         type="number" />
        </div>
        <Inp value={form.fiber} onChange={setMacro("fiber")} placeholder="Ballaststoffe (g) — optional" type="number" />
        <Btn onClick={submit}>Hinzufügen</Btn>
      </div>
      {entries.length > 0 ? (
        <div className="space-y-2">
          <Label>Heute</Label>
          {entries.map((item, i) => (
            <div key={i} className="bg-white rounded-xl px-4 py-3.5 border border-stone-100 shadow-sm flex items-start justify-between group">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-800 truncate">{item.desc}</div>
                <MacroChips entry={item} />
              </div>
              <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => onStar(item)} className="text-stone-300 hover:text-amber-400 px-2 py-1 text-base transition-colors">★</button>
                <button onClick={() => removeEntry(i)} className="text-stone-300 hover:text-red-400 px-2 py-1 text-sm transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-14 text-stone-300 text-sm">Noch keine Einträge heute</div>
      )}
    </div>
  );
}

function AvgCard({ label, value, unit, color }) {
  return (
    <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
      <div className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold leading-none ${color}`}>
        {value} <span className="text-xs font-normal text-stone-400">{unit}</span>
      </div>
    </div>
  );
}

function HistCard({ label, entries }) {
  const t = { kcal: sum(entries,"kcal"), prot: sum(entries,"prot"), carbs: sum(entries,"carbs"), fat: sum(entries,"fat"), fiber: sum(entries,"fiber") };
  return (
    <div className="bg-white rounded-xl px-4 py-3.5 border border-stone-100 shadow-sm">
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <div className="text-xs text-stone-400 mb-0.5">{label}</div>
          <div className="text-base font-bold text-stone-900">{t.kcal} <span className="text-xs font-normal text-stone-400">kcal</span></div>
        </div>
        <div className="text-xs text-stone-400">{entries.length} Einträge</div>
      </div>
      <div className="flex gap-2.5 flex-wrap">
        <span className="text-xs text-green-600 font-medium">{t.prot}g P</span>
        <span className="text-xs text-amber-600 font-medium">{t.carbs}g K</span>
        <span className="text-xs text-blue-500 font-medium">{t.fat}g F</span>
        {t.fiber > 0 && <span className="text-xs text-purple-500 font-medium">{t.fiber}g B</span>}
      </div>
    </div>
  );
}

function AnalyseView({ histIndex, histData, todayEntries, goals }) {
  const today = todayKey();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    const dayEntries = key === today ? todayEntries : (histData[key] || []);
    return {
      key,
      label: d.toLocaleDateString("de-DE", { weekday: "short" }),
      kcal:  sum(dayEntries, "kcal"),
      prot:  sum(dayEntries, "prot"),
      carbs: sum(dayEntries, "carbs"),
      fat:   sum(dayEntries, "fat"),
      fiber: sum(dayEntries, "fiber"),
      hasData: dayEntries.length > 0,
    };
  });

  const daysWithData = last7.filter(d => d.hasData);
  const avg = (key) => daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, d) => s + d[key], 0) / daysWithData.length) : 0;
  const pastKeys = [...histIndex].filter(k => k !== today).sort().reverse();

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
        <Label>Ø letzte 7 Tage</Label>
        <p className="text-[10px] text-stone-400 mt-0.5 mb-3">{daysWithData.length} von 7 Tagen erfasst</p>
        <div className="grid grid-cols-2 gap-2">
          <AvgCard label="Kalorien" value={avg("kcal")} unit="kcal" color="text-stone-800" />
          <AvgCard label="Protein" value={avg("prot")} unit="g" color="text-green-600" />
          <AvgCard label="Kohlenhydrate" value={avg("carbs")} unit="g" color="text-amber-600" />
          <AvgCard label="Fette" value={avg("fat")} unit="g" color="text-blue-500" />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
        <Label>Kalorien — letzte 7 Tage</Label>
        <div className="mt-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7} barSize={28} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e", fontFamily: "inherit" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={goals.kcal} stroke="#1c1c1e" strokeDasharray="4 3" strokeWidth={1.5} />
              <Bar dataKey="kcal" radius={[5, 5, 2, 2]}>
                {last7.map((d, i) => (
                  <Cell key={i} fill={!d.hasData ? "#f5f5f4" : d.key === today ? "#1c1c1e" : d.kcal > goals.kcal ? "#fca5a5" : "#d6d3d1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Alle Tage</Label>
        <HistCard label="Heute" entries={todayEntries} />
        {pastKeys.map((k) => <HistCard key={k} label={fmtDate(k)} entries={histData[k] || []} />)}
      </div>
    </div>
  );
}

function FavsView({ favs, removeFav, addToToday, addFav }) {
  const { form, kcalAuto, setMacro, setKcal, setDesc, reset } = useMacroForm();
  const save = () => {
    if (!form.desc.trim()) return;
    addFav({ desc: form.desc.trim(), kcal: int(form.kcal), prot: int(form.prot), carbs: int(form.carbs), fat: int(form.fat), fiber: int(form.fiber) });
    reset();
  };
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm space-y-3">
        <Label>Neuer Favorit</Label>
        <Inp value={form.desc} onChange={setDesc} placeholder="Mahlzeit / Lebensmittel" />
        <div className="grid grid-cols-2 gap-2">
          <KcalInp value={form.kcal} onChange={setKcal} isAuto={kcalAuto} />
          <Inp value={form.prot}  onChange={setMacro("prot")}  placeholder="Protein (g)" type="number" />
          <Inp value={form.carbs} onChange={setMacro("carbs")} placeholder="Kohlenhydrate (g)" type="number" />
          <Inp value={form.fat}   onChange={setMacro("fat")}   placeholder="Fette (g)" type="number" />
        </div>
        <Inp value={form.fiber} onChange={setMacro("fiber")} placeholder="Ballaststoffe (g)" type="number" />
        <Btn onClick={save}>Speichern</Btn>
      </div>
      <div className="space-y-2">
        <Label>Gespeichert ({favs.length})</Label>
        {favs.map((fav, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-3.5 border border-stone-100 shadow-sm flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-stone-800 truncate">{fav.desc}</div>
              <MacroChips entry={fav} />
            </div>
            <div className="flex gap-2 items-center ml-3 shrink-0">
              <Btn onClick={() => addToToday(fav)} small>+ Heute</Btn>
              <button onClick={() => removeFav(i)} className="text-stone-300 hover:text-red-400 px-1 text-sm">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsView({ goals, saveGoals }) {
  const [form, setForm] = useState(goals);
  useEffect(() => setForm(goals), [goals]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: int(e.target.value) }));
  const fields = [
    { key: "kcal",  label: "Kalorien (kcal)" },
    { key: "prot",  label: "Protein (g)" },
    { key: "carbs", label: "Kohlenhydrate (g)" },
    { key: "fat",   label: "Fette (g)" },
    { key: "fiber", label: "Ballaststoffe (g)" },
  ];
  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm space-y-4">
      <Label>Tagesziele</Label>
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs text-stone-600 font-medium">{label}</label>
          <Inp value={form[key]} onChange={set(key)} type="number" />
        </div>
      ))}
      <Btn onClick={() => saveGoals(form)}>Ziele speichern</Btn>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [favs, setFavs] = useState([]);
  const [histIndex, setHistIndex] = useState([]);
  const [histData, setHistData] = useState({});
  const [toast, setToast] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const today = todayKey();
      const [e, g, f, hi] = await Promise.all([
        DB.get(`day-${today}`), DB.get("goals"), DB.get("favs"), DB.get("hist-index"),
      ]);
      if (e) setEntries(e);
      if (g) setGoals({ ...DEFAULT_GOALS, ...g });
      if (f) setFavs(f);
      if (hi) {
        setHistIndex(hi);
        const hd = {};
        for (const k of hi) { if (k !== today) { const d = await DB.get(`day-${k}`); if (d) hd[k] = d; } }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const persistEntries = async (updated) => {
    const today = todayKey();
    setEntries(updated);
    await DB.set(`day-${today}`, updated);
    const hi = (await DB.get("hist-index")) || [];
    if (!hi.includes(today)) {
      const newHi = [...hi, today].sort();
      setHistIndex(newHi);
      await DB.set("hist-index", newHi);
    }
  };

  const addEntry = async (item) => { await persistEntries([...entries, item]); flash("Hinzugefügt ✓"); };
  const removeEntry = async (i) => { await persistEntries(entries.filter((_, idx) => idx !== i)); };
  const addFav = async (fav) => {
    if (favs.some((f) => f.desc === fav.desc)) { flash("Bereits Favorit"); return; }
    const updated = [...favs, fav];
    setFavs(updated);
    await DB.set("favs", updated);
    flash("Favorit gespeichert ✓");
  };
  const removeFav = async (i) => {
    const updated = favs.filter((_, idx) => idx !== i);
    setFavs(updated);
    await DB.set("favs", updated);
  };
  const saveGoals = async (g) => { setGoals(g); await DB.set("goals", g); flash("Ziele gespeichert ✓"); };

  const TABS = [
    { id: "today", label: "Heute" },
    { id: "history", label: "Verlauf" },
    { id: "favs", label: "Datenbank" },
    { id: "goals", label: "Ziele" },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-[#fafaf8] text-stone-900 pb-20">
      <div className="px-5 pt-10 pb-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400 mb-1">Persönlich</p>
        <h1 className="text-3xl font-bold tracking-tight">Nährwerte</h1>
      </div>

      <div className="px-5 mb-6 sticky top-0 bg-[#fafaf8]/80 backdrop-blur-md z-10 py-2">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-2xl">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${tab === t.id ? "bg-stone-900 text-white shadow-sm" : "text-stone-400"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!ready ? (
        <div className="flex justify-center py-20 text-stone-300 text-sm">Laden…</div>
      ) : (
        <div className="px-5">
          {tab === "today" && <TodayView entries={entries} goals={goals} addEntry={addEntry} removeEntry={removeEntry} onStar={addFav} />}
          {tab === "history" && <AnalyseView histIndex={histIndex} histData={histData} todayEntries={entries} goals={goals} />}
          {tab === "favs" && <FavsView favs={favs} removeFav={removeFav} addToToday={addEntry} addFav={addFav} />}
          {tab === "goals" && <GoalsView goals={goals} saveGoals={saveGoals} />}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
