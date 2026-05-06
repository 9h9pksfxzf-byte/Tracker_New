import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell, LineChart, Line, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";

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
  new Date(k + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit" });

const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen", "Snack"];
const EMPTY_ENTRY = { desc: "", kcal: "", prot: "", carbs: "", fat: "", fiber: "" };
const DEFAULT_GOALS = { kcal: 2000, prot: 150, carbs: 250, fat: 70, fiber: 30 };

const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const parsed = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return isNaN(parsed) ? 0 : parsed;
};

const sum = (arr, key) => {
  const total = arr.reduce((s, i) => s + num(i[key]), 0);
  return Math.round(total * 10) / 10;
};

const calcKcalFromMacros = (g) => {
  return Math.round(num(g.prot) * 4 + num(g.carbs) * 4 + num(g.fat) * 9 + num(g.fiber) * 2);
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  Log: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" /></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>,
  Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/></svg>,
  Weight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m11 2 9 22M13 2l-9 22M2 2h20"/></svg>,
  Plus: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M12 5v14M5 12h14"/></svg>,
};

// ─── UI COMPONENTS ──────────────────────────────────────────────────────────
const KcalArc = ({ consumed, target }) => {
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(consumed / (target || 1), 1);
  const offset = circ - (pct * circ);

  return (
    <div className="relative flex flex-col items-center justify-center py-6">
      <svg width="200" height="200" className="transform -rotate-90">
        <circle cx="100" cy="100" r={radius} stroke="#f5f5f4" strokeWidth="12" fill="transparent" />
        <circle cx="100" cy="100" r={radius} stroke="#3b82f6" strokeWidth="12" fill="transparent"
          strokeDasharray={circ} style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.8s ease", strokeLinecap: "round" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-stone-900">{Math.round(consumed)}</span>
        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Consumed</span>
      </div>
      <div className="absolute w-full flex justify-between px-2 top-1/2 -translate-y-1/2">
        <div className="text-center">
          <p className="text-lg font-black text-stone-800">{Math.max(0, Math.round(target - consumed))}</p>
          <p className="text-[8px] font-black text-stone-400 uppercase">Left</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-stone-800">{Math.round(target)}</p>
          <p className="text-[8px] font-black text-stone-400 uppercase">Target</p>
        </div>
      </div>
    </div>
  );
};

// ─── VIEWS ──────────────────────────────────────────────────────────────────
function DashboardView({ entries, goals, weights, historyData }) {
  const totals = useMemo(() => ({
    kcal: sum(entries, "kcal"), prot: sum(entries, "prot"), carbs: sum(entries, "carbs"), fat: sum(entries, "fat"), fiber: sum(entries, "fiber")
  }), [entries]);

  const weightTrend = weights.slice(-1)[0]?.val || "--";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-white rounded-[40px] p-6 shadow-sm border border-stone-50">
        <KcalArc consumed={totals.kcal} target={goals.kcal} />
        <div className="grid grid-cols-3 gap-4 mt-4 px-2">
          {[{l:"Protein", v:totals.prot, g:goals.prot, c:"#f87171"}, {l:"Fat", v:totals.fat, g:goals.fat, c:"#fbbf24"}, {l:"Carbs", v:totals.carbs, g:goals.carbs, c:"#34d399"}].map(m => (
            <div key={m.l} className="text-center">
              <div className="h-1 w-full bg-stone-100 rounded-full mb-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(m.v/m.g)*100}%`, backgroundColor: m.c }} />
              </div>
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-tighter">{m.l}</p>
              <p className="text-[11px] font-bold text-stone-800">{Math.round(m.v)}/{m.g}g</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-stone-50 shadow-sm">
          <p className="text-xs font-black text-stone-400 uppercase mb-1">Expenditure</p>
          <p className="text-xl font-black text-stone-900">2.842 <span className="text-[10px]">kcal</span></p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-stone-50 shadow-sm">
          <p className="text-xs font-black text-stone-400 uppercase mb-1">Weight Trend</p>
          <p className="text-xl font-black text-stone-900">{weightTrend} <span className="text-[10px]">kg</span></p>
        </div>
      </div>
    </div>
  );
}

function TodayView({ entries, goals, weights, selectedDate, addEntry, removeEntry, updateEntry, addWeight }) {
  const [activeType, setActiveType] = useState(null);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [editingIdx, setEditingIdx] = useState(null);
  const [wInput, setWInput] = useState("");

  const currentWeight = weights.find(w => w.date === selectedDate)?.val;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex items-center justify-between">
        <div><p className="text-[9px] font-black uppercase text-stone-300">Tagesgewicht</p><div className="text-xl font-black text-stone-800">{currentWeight ? `${currentWeight} kg` : "--"}</div></div>
        <div className="flex gap-2">
          <input type="number" step="0.1" value={wInput} onChange={e => setWInput(e.target.value)} placeholder="0.0" className="w-16 bg-stone-50 rounded-xl px-3 py-2 text-xs font-bold outline-none text-center" />
          <button onClick={() => { if(wInput) { addWeight(num(wInput)); setWInput(""); } }} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Log</button>
        </div>
      </div>

      <div className="space-y-3">
        {MEAL_TYPES.map(type => {
          const typeEntries = entries.map((e, idx) => ({ ...e, originalIndex: idx })).filter(e => e.type === type);
          const isOpen = activeType === type;
          return (
            <div key={type} className={`bg-white rounded-3xl border transition-all ${isOpen ? "border-stone-900 ring-4 ring-stone-900/5" : "border-stone-100"}`}>
              <button onClick={() => setActiveType(isOpen ? null : type)} className="w-full px-6 py-5 flex justify-between items-center">
                <span className="text-sm font-black text-stone-800">{type}</span>
                <span className="text-xs font-black text-stone-900">{sum(typeEntries, "kcal")} kcal</span>
              </button>
              {isOpen && (
                <div className="px-6 pb-6 space-y-4">
                  {typeEntries.map(item => (
                    <div key={item.originalIndex} className="flex justify-between items-center p-2 bg-stone-50/50 rounded-xl">
                      <button onClick={() => { setForm(item); setEditingIdx(item.originalIndex); }} className="text-left flex-1">
                        <div className="text-[13px] font-bold text-stone-700">{item.desc}</div>
                        <div className="text-[10px] font-bold text-stone-400 uppercase">{item.kcal} kcal · {item.prot}P · {item.carbs}C</div>
                      </button>
                      <button onClick={() => removeEntry(item.originalIndex)} className="text-stone-300 px-2">✕</button>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-stone-100 space-y-3">
                    <input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Beschreibung" className="w-full bg-stone-50 rounded-2xl px-4 py-3 text-[13px] outline-none font-bold" />
                    <div className="grid grid-cols-5 gap-1">
                      {["kcal", "prot", "carbs", "fat", "fiber"].map(k => (
                        <input key={k} value={form[k]} type="number" placeholder={k} onChange={e => {
                          const next = { ...form, [k]: e.target.value };
                          if (k !== "kcal") next.kcal = String(calcKcalFromMacros(next));
                          setForm(next);
                        }} className="bg-stone-50 rounded-xl py-2 text-center text-[10px] outline-none font-bold" />
                      ))}
                    </div>
                    <button onClick={() => { if(!form.desc) return; editingIdx !== null ? updateEntry(editingIdx, {...form, type}) : addEntry({...form, type}); setForm(EMPTY_ENTRY); setEditingIdx(null); }} className="w-full bg-stone-900 text-white font-black py-3 rounded-2xl text-[10px] uppercase">Speichern</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [weights, setWeights] = useState([]);
  const [favs, setFavs] = useState([]);
  const [histData, setHistData] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const [g, w, f, hi] = await Promise.all([DB.get("goals"), DB.get("weights"), DB.get("favs"), DB.get("hist-index")]);
      if (g) setGoals(g); setWeights(w || []); setFavs(f || []);
      if (hi) {
        const hd = {};
        for (const k of hi.slice(-14)) { const d = await DB.get(`day-${k}`); if (d) hd[k] = d; }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => { if (ready) DB.get(`day-${selectedDate}`).then(e => setEntries(e || [])); }, [selectedDate, ready]);

  const saveToDB = async (date, updated) => {
    setEntries(updated); await DB.set(`day-${date}`, updated);
    const hi = await DB.get("hist-index") || [];
    if (!hi.includes(date)) await DB.set("hist-index", [...hi, date]);
    setHistData(prev => ({...prev, [date]: updated}));
  };

  const addWeight = async (v) => {
    const updated = [...weights.filter(w => w.date !== selectedDate), { date: selectedDate, val: v }].sort((a,b)=>new Date(a.date)-new Date(b.date));
    setWeights(updated); await DB.set("weights", updated);
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 pb-32 font-sans antialiased">
      <header className="px-8 pt-16 pb-4 flex justify-between items-center max-w-lg mx-auto">
        <h1 className="text-2xl font-black tracking-tight text-stone-900 capitalize">{tab}</h1>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-stone-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none border-none" />
      </header>

      <main className="px-6 max-w-lg mx-auto">
        {tab === "dashboard" && <DashboardView entries={entries} goals={goals} weights={weights} historyData={histData} />}
        {tab === "today" && <TodayView entries={entries} goals={goals} weights={weights} selectedDate={selectedDate} addEntry={(i) => saveToDB(selectedDate, [...entries, i])} removeEntry={(idx) => saveToDB(selectedDate, entries.filter((_, i) => i !== idx))} updateEntry={(idx, item) => { const n = [...entries]; n[idx] = item; saveToDB(selectedDate, n); }} addWeight={addWeight} />}
        {tab === "database" && <DatabaseView favs={favs} addEntry={(i) => saveToDB(selectedDate, [...entries, i])} removeFav={(idx) => {}} selectedDate={selectedDate} />}
        {tab === "goals" && (
            <div className="bg-white rounded-3xl p-8 border border-stone-100 space-y-6">
                {["prot", "carbs", "fat", "fiber"].map(k => (
                    <div key={k} className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">{k} (g)</span>
                        <input value={goals[k]} type="number" className="w-20 bg-stone-50 rounded-xl px-3 py-2 text-sm font-bold outline-none text-right" onChange={e => {
                            const g = {...goals, [k]: e.target.value}; g.kcal = calcKcalFromMacros(g);
                            setGoals(g); DB.set("goals", g);
                        }} />
                    </div>
                ))}
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-3xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <button onClick={() => setTab("dashboard")} className={`p-4 rounded-2xl ${tab === "dashboard" ? "bg-stone-900 text-white shadow-xl" : "text-stone-300"}`}><Icon.Dashboard /></button>
          <button onClick={() => setTab("today")} className={`p-4 rounded-2xl ${tab === "today" ? "bg-stone-900 text-white shadow-xl" : "text-stone-300"}`}><Icon.Log /></button>
          <div className="relative -top-6">
            <button onClick={() => setTab("today")} className="w-14 h-14 bg-stone-900 rounded-[22px] flex items-center justify-center shadow-2xl ring-8 ring-[#fafaf9]"><Icon.Plus /></button>
          </div>
          <button onClick={() => setTab("database")} className={`p-4 rounded-2xl ${tab === "database" ? "bg-stone-900 text-white shadow-xl" : "text-stone-300"}`}><Icon.Database /></button>
          <button onClick={() => setTab("goals")} className={`p-4 rounded-2xl ${tab === "goals" ? "bg-stone-900 text-white shadow-xl" : "text-stone-300"}`}><Icon.History /></button>
        </div>
      </nav>
    </div>
  );
}

// Hilfskomponente für Database (falls nicht vorhanden im User Code)
function DatabaseView({ favs, addEntry, selectedDate }) {
    return (
        <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-stone-50 shadow-sm">
                <p className="text-xs font-black text-stone-300 uppercase mb-4">Deine Favoriten</p>
                {favs.length === 0 ? <p className="text-sm font-bold text-stone-400">Noch keine Favoriten gespeichert.</p> : 
                favs.map((f, i) => (
                    <div key={i} className="flex justify-between items-center mb-2 p-2 bg-stone-50 rounded-xl">
                        <span>{f.desc}</span>
                        <button onClick={() => addEntry({...f, type: "Snack"})} className="bg-stone-900 text-white px-3 py-1 rounded-lg text-[10px] font-black">LOG</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
