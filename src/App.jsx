import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell, LineChart, Line, YAxis, Tooltip } from "recharts";

// ─── STORAGE & LOGIC ────────────────────────────────────────────────────────
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
  new Date(k + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

const EMPTY_ENTRY   = { desc: "", kcal: "", prot: "", carbs: "", fat: "", fiber: "" };
const DEFAULT_GOALS = { kcal: 2000, prot: 150, carbs: 250, fat: 70, fiber: 30 };

const sum  = (arr, key) => Math.round(arr.reduce((s, i) => s + (Number(i[key]) || 0), 0) * 10) / 10;
const num  = (v) => v === "" ? 0 : parseFloat(String(v).replace(",", ".")) || 0;

const getMovingAverage = (data, windowSize = 7) => {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const subset = data.slice(start, index + 1);
    const average = subset.reduce((acc, p) => acc + p.val, 0) / subset.length;
    return { ...point, avg: Math.round(average * 10) / 10 };
  });
};

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
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: over ? "#ef4444" : accent, transition: "width 0.5s ease" }} className="h-full rounded-full" />
      </div>
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = "text", onKeyDown, className = "" }) {
  return (
    <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} type={type} step="any"
      className={`w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-500 bg-stone-50 placeholder-stone-300 transition-colors ${className}`} />
  );
}

function Btn({ onClick, children, small, variant = "primary" }) {
  const base = "font-semibold rounded-xl transition-all active:scale-[0.98]";
  const styles = variant === "primary" ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200";
  const size = small ? "text-[10px] px-3 py-1.5" : "w-full text-sm py-3";
  return <button onClick={onClick} className={`${base} ${styles} ${size}`}>{children}</button>;
}

// ─── VIEW: TODAY ─────────────────────────────────────────────────────────────
function TodayView({ entries, goals, addEntry, removeEntry, onStar }) {
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [kcalAuto, setKcalAuto] = useState(true);

  const calcKcal = (f) => {
    const total = Math.round(num(f.prot) * 4 + num(f.carbs) * 4 + num(f.fat) * 9 + num(f.fiber) * 2);
    return total > 0 ? String(total) : "";
  };

  const updateForm = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (kcalAuto && k !== "desc" && k !== "kcal") next.kcal = calcKcal(next);
      return next;
    });
  };

  const t = { kcal: sum(entries,"kcal"), prot: sum(entries,"prot"), carbs: sum(entries,"carbs"), fat: sum(entries,"fat"), fiber: sum(entries,"fiber") };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm space-y-4">
        <StatBar label="Energie" value={t.kcal} max={goals.kcal} unit="kcal" accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein" value={t.prot} max={goals.prot} unit="g" accent="#16a34a" />
          <StatBar label="Carbs" value={t.carbs} max={goals.carbs} unit="g" accent="#d97706" />
          <StatBar label="Fette" value={t.fat} max={goals.fat} unit="g" accent="#3b82f6" />
          <StatBar label="Ballaststoffe" value={t.fiber} max={goals.fiber} unit="g" accent="#9333ea" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm space-y-3">
        <Inp value={form.desc} onChange={e => updateForm("desc", e.target.value)} placeholder="Was hast du gegessen?" />
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Inp value={form.kcal} onChange={e => { setKcalAuto(false); updateForm("kcal", e.target.value); }} placeholder="kcal" type="number" />
            {kcalAuto && form.kcal && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-stone-300 uppercase">Auto</span>}
          </div>
          <Inp value={form.prot} onChange={e => updateForm("prot", e.target.value)} placeholder="Protein (g)" type="number" />
          <Inp value={form.carbs} onChange={e => updateForm("carbs", e.target.value)} placeholder="Carbs (g)" type="number" />
          <Inp value={form.fat} onChange={e => updateForm("fat", e.target.value)} placeholder="Fett (g)" type="number" />
          <Inp value={form.fiber} onChange={e => updateForm("fiber", e.target.value)} placeholder="Ballaststoffe (g)" type="number" className="col-span-2" />
        </div>
        <Btn onClick={() => { if(form.desc) { addEntry({...form, kcal: num(form.kcal)}); setForm(EMPTY_ENTRY); setKcalAuto(true); }}}>Eintrag speichern</Btn>
      </div>

      <div className="space-y-2 pb-10">
        {entries.map((item, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-3 border border-stone-100 flex justify-between items-center group">
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-800 truncate">{item.desc}</div>
              <div className="text-[10px] text-stone-400 space-x-2 font-medium">
                <span>{item.kcal} kcal</span>
                <span className="text-green-600">{item.prot}P</span>
                <span className="text-amber-600">{item.carbs}C</span>
                <span className="text-blue-500">{item.fat}F</span>
                {num(item.fiber) > 0 && <span className="text-purple-500">{item.fiber}B</span>}
              </div>
            </div>
            <div className="flex gap-1 ml-4">
              <button onClick={() => onStar(item)} className="p-2 text-stone-200 hover:text-amber-400 transition-colors text-lg">★</button>
              <button onClick={() => removeEntry(i)} className="p-2 text-stone-200 hover:text-red-400 transition-colors">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VIEW: WEIGHT ────────────────────────────────────────────────────────────
function WeightView({ weights, addWeight, removeWeight }) {
  const [val, setVal] = useState("");
  const sorted = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dataWithAvg = getMovingAverage(sorted, 7);
  const currentAvg = dataWithAvg.length > 0 ? dataWithAvg[dataWithAvg.length - 1].avg : 0;
  const startAvg = dataWithAvg.length > 0 ? dataWithAvg[0].avg : 0;
  const diff = Math.round((currentAvg - startAvg) * 10) / 10;
  const displayList = [...weights].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Ø Gewicht (7 Tage)</p>
            <div className="text-4xl font-black text-stone-900">{currentAvg || "--"} <span className="text-sm font-medium text-stone-300">kg</span></div>
            <div className={`text-xs font-bold mt-1 ${diff <= 0 ? "text-green-600" : "text-red-500"}`}>
              {diff > 0 ? "+" : ""}{diff} kg Trend
            </div>
          </div>
          <div className="flex gap-2">
            <input type="number" step="0.1" value={val} onChange={e => setVal(e.target.value)} placeholder="kg" 
              className="w-20 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-500 bg-stone-50" />
            <Btn onClick={() => { if(val) { addWeight(num(val)); setVal(""); } }} small>Log</Btn>
          </div>
        </div>

        {dataWithAvg.length > 1 ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataWithAvg}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} labelFormatter={v => fmtDate(v)} />
                <Line type="monotone" dataKey="val" stroke="#e7e5e4" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="avg" stroke="#1c1c1e" strokeWidth={4} dot={false} animationDuration={1000} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="h-48 flex items-center justify-center text-stone-300 text-xs italic">Mehr Daten benötigt...</div>}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Historie</p>
        {displayList.slice(0, 7).map((w, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-3 border border-stone-100 flex justify-between items-center group">
            <div>
              <div className="text-sm font-bold text-stone-800">{w.val} kg</div>
              <div className="text-[10px] text-stone-400">{fmtDate(w.date)}</div>
            </div>
            <button onClick={() => removeWeight(w.date)} className="text-stone-200 hover:text-red-400 px-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [favs, setFavs] = useState([]);
  const [weights, setWeights] = useState([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function init() {
      const today = todayKey();
      const [e, g, f, w] = await Promise.all([
        DB.get(`day-${today}`), DB.get("goals"), DB.get("favs"), DB.get("weights")
      ]);
      setEntries(e || []);
      setGoals({ ...DEFAULT_GOALS, ...g });
      setFavs(f || []);
      setWeights(w || []);
      setReady(true);
    }
    init();
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const addEntry = async (item) => {
    const updated = [...entries, item];
    setEntries(updated);
    await DB.set(`day-${todayKey()}`, updated);
    flash("Gespeichert ✓");
  };

  const removeEntry = async (i) => {
    const updated = entries.filter((_, idx) => idx !== i);
    setEntries(updated);
    await DB.set(`day-${todayKey()}`, updated);
  };

  const addWeight = async (val) => {
    const today = todayKey();
    const updated = [...weights.filter(w => w.date !== today), { date: today, val }];
    setWeights(updated);
    await DB.set("weights", updated);
    flash("Gewicht erfasst ✓");
  };

  const removeWeight = async (date) => {
    const updated = weights.filter(w => w.date !== date);
    setWeights(updated);
    await DB.set("weights", updated);
  };

  const addFav = async (item) => {
    if(favs.find(f => f.desc === item.desc)) return flash("Schon in Favoriten");
    const updated = [...favs, item];
    setFavs(updated);
    await DB.set("favs", updated);
    flash("Zu Favoriten hinzugefügt ★");
  };

  const TABS = [
    { id: "today", label: "Heute" },
    { id: "weight", label: "Gewicht" },
    { id: "favs", label: "Datenbank" },
    { id: "goals", label: "Ziele" },
  ];

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-24 font-sans antialiased">
      <header className="px-6 pt-12 pb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-1">Fitness Tracker</p>
        <h1 className="text-4xl font-black tracking-tight">Übersicht</h1>
      </header>

      <nav className="px-6 mb-8 sticky top-0 bg-[#fafaf8]/90 backdrop-blur-xl z-50 py-3">
        <div className="flex gap-1.5 bg-stone-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-none px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${tab === t.id ? "bg-stone-900 text-white shadow-lg" : "text-stone-400"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-6">
        {tab === "today" && <TodayView entries={entries} goals={goals} addEntry={addEntry} removeEntry={removeEntry} onStar={addFav} />}
        {tab === "weight" && <WeightView weights={weights} addWeight={addWeight} removeWeight={removeWeight} />}
        {tab === "favs" && (
          <div className="space-y-3">
            {favs.length ? favs.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm flex justify-between items-center">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{f.desc}</div>
                  <div className="text-[10px] text-stone-400 font-medium">{f.kcal} kcal | {f.prot}P | {f.carbs}C | {f.fat}F</div>
                </div>
                <Btn onClick={() => addEntry(f)} small variant="secondary">Hinzufügen</Btn>
              </div>
            )) : <p className="text-center text-stone-300 py-20 text-sm italic">Keine Favoriten gespeichert.</p>}
          </div>
        )}
        {tab === "goals" && (
          <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase text-stone-400">Tagesziele anpassen</p>
            {Object.keys(goals).map(k => (
              <div key={k}>
                <label className="text-[10px] font-bold uppercase text-stone-500 mb-1 block">{k}</label>
                <Inp value={goals[k]} type="number" onChange={e => { const g = {...goals, [k]: num(e.target.value)}; setGoals(g); DB.set("goals", g); }} />
              </div>
            ))}
            <p className="text-[10px] text-stone-300 italic pt-2">Änderungen werden sofort gespeichert.</p>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-bold uppercase tracking-widest px-6 py-3 rounded-full shadow-2xl animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
