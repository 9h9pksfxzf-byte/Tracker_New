import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, ReferenceLine, LineChart, Line,
  PieChart, Pie
} from "recharts";

// ─── UTILS & STORAGE ────────────────────────────────────────────────────────
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
const fmtDate = (k) => new Date(k + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
const num = (v) => v === "" ? 0 : parseFloat(String(v).replace(",", ".")) || 0;
const sum = (arr, key) => Math.round(arr.reduce((s, i) => s + (Number(i[key]) || 0), 0) * 10) / 10;

// Wissenschaftliche Kalorienberechnung (Atwater-Faktoren inkl. Ballaststoffe)
const calcKcalFromMacros = (g) => {
  return Math.round(num(g.prot) * 4 + num(g.carbs) * 4 + num(g.fat) * 9 + num(g.fiber) * 2);
};

const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen", "Snack"];
const EMPTY_ENTRY = { desc: "", kcal: "", prot: "", carbs: "", fat: "", fiber: "" };
const DEFAULT_GOALS = { kcal: 2000, prot: 150, carbs: 250, fat: 70, fiber: 30 };

// ─── LOGIC: TDEE & TRENDS ───────────────────────────────────────────────────
const calculateTDEE = (weights, history, days = 21) => {
  const sortedWeights = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedWeights.length < 5) return null;
  const now = new Date();
  const startLimit = new Date();
  startLimit.setDate(now.getDate() - days);
  const relevantWeights = sortedWeights.filter(w => new Date(w.date) >= startLimit);
  if (relevantWeights.length < 3) return null;
  
  const firstW = relevantWeights[0];
  const lastW = relevantWeights[relevantWeights.length - 1];
  const weightDiff = lastW.val - firstW.val;
  const daySpan = (new Date(lastW.date) - new Date(firstW.date)) / 86400000;
  
  let totalKcal = 0;
  let loggedDays = 0;
  Object.keys(history).forEach(d => {
    if (new Date(d) >= new Date(firstW.date) && new Date(d) <= new Date(lastW.date)) {
      const dailyKcal = sum(history[d], "kcal");
      if (dailyKcal > 800) { totalKcal += dailyKcal; loggedDays++; }
    }
  });

  if (loggedDays < daySpan * 0.7) return null;
  const avgIntake = totalKcal / loggedDays;
  const energyFromWeight = (weightDiff * 7700) / daySpan; // 7700 kcal pro kg Fettgewebe
  return Math.round(avgIntake - energyFromWeight);
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = {
  Today: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
  Weight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3h12l4 18H2L6 3z"/><circle cx="12" cy="12" r="3"/></svg>,
  Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  Goal: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
function StatBar({ label, value, max, accent }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1 px-0.5">
        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{label}</span>
        <span className={`text-[11px] font-bold ${value > max ? "text-red-500" : "text-stone-700"}`}>{value}<span className="text-stone-300 font-medium">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: value > max ? "#ef4444" : accent }} className="h-full rounded-full transition-all duration-700" />
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function PerformanceApp() {
  const [tab, setTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [entries, setEntries] = useState([]);
  const [weights, setWeights] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [favs, setFavs] = useState([]);
  const [history, setHistory] = useState({});
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [activeMeal, setActiveMeal] = useState(null);

  // Initial Load
  useEffect(() => {
    async function init() {
      const [g, w, f, hi] = await Promise.all([DB.get("goals"), DB.get("weights"), DB.get("favs"), DB.get("hist-index")]);
      if (g) setGoals(g);
      setWeights(w || []);
      setFavs(f || []);
      if (hi) {
        const hd = {};
        for (const k of hi) { const d = await DB.get(`day-${k}`); if (d) hd[k] = d; }
        setHistory(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  // Day Switch
  useEffect(() => {
    if (ready) {
      DB.get(`day-${selectedDate}`).then(e => setEntries(e || []));
    }
  }, [selectedDate, ready]);

  const tdee = calculateTDEE(weights, { ...history, [todayKey()]: entries });
  const currentTotals = {
    kcal: sum(entries, "kcal"),
    prot: sum(entries, "prot"),
    carbs: sum(entries, "carbs"),
    fat: sum(entries, "fat"),
    fiber: sum(entries, "fiber")
  };

  const handleAddEntry = async (item) => {
    const updated = [...entries, item];
    setEntries(updated);
    await DB.set(`day-${selectedDate}`, updated);
    const hi = await DB.get("hist-index") || [];
    if (!hi.includes(selectedDate)) await DB.set("hist-index", [...hi, selectedDate]);
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-32 font-sans antialiased">
      <header className="max-w-lg mx-auto px-8 pt-16 pb-8 flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-300 mb-1">Performance Track</p>
          <h1 className="text-4xl font-black tracking-tighter capitalize">{tab}</h1>
        </div>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-white border border-stone-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none shadow-sm" />
      </header>

      <main className="max-w-lg mx-auto px-6">
        {/* TODAY VIEW */}
        {tab === "today" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
              <StatBar label="Energie (kcal)" value={currentTotals.kcal} max={goals.kcal} accent="#1c1c1e" />
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-2">
                <StatBar label="Protein" value={currentTotals.prot} max={goals.prot} accent="#16a34a" />
                <StatBar label="Carbs" value={currentTotals.carbs} max={goals.carbs} accent="#d97706" />
                <StatBar label="Fette" value={currentTotals.fat} max={goals.fat} accent="#3b82f6" />
                <StatBar label="Fiber" value={currentTotals.fiber} max={goals.fiber} accent="#9333ea" />
              </div>
            </div>

            <div className="space-y-3">
              {MEAL_TYPES.map(type => (
                <div key={type} className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                  <button onClick={() => setActiveMeal(activeMeal === type ? null : type)} className="w-full px-6 py-5 flex justify-between items-center active:bg-stone-50">
                    <span className="text-sm font-black text-stone-800">{type}</span>
                    <span className="text-xs font-black">{sum(entries.filter(e => e.type === type), "kcal")} <span className="text-stone-300">kcal</span></span>
                  </button>
                  {activeMeal === type && (
                    <div className="px-6 pb-6 space-y-4 animate-in slide-in-from-top-2">
                      {entries.filter(e => e.type === type).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <div className="font-bold">{item.desc} <span className="text-stone-300 font-medium ml-1">({item.kcal} kcal)</span></div>
                          <button onClick={() => {
                            const updated = entries.filter(e => e !== item);
                            setEntries(updated);
                            DB.set(`day-${selectedDate}`, updated);
                          }} className="text-stone-200 hover:text-red-500">✕</button>
                        </div>
                      ))}
                      <div className="pt-2 flex gap-2">
                        <input placeholder="Was gab es?" className="flex-1 bg-stone-50 rounded-xl px-4 py-2 text-xs font-medium outline-none" onChange={e => setForm({...form, desc: e.target.value})} />
                        <input placeholder="kcal" type="number" className="w-16 bg-stone-50 rounded-xl px-2 py-2 text-xs font-bold text-center outline-none" onChange={e => setForm({...form, kcal: e.target.value})} />
                        <button onClick={() => { if(form.desc && form.kcal) { handleAddEntry({...form, type}); setForm(EMPTY_ENTRY); }}} className="bg-stone-900 text-white px-4 rounded-xl text-[10px] font-black uppercase">Log</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRENDS VIEW */}
        {tab === "history" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Energie-Bilanz (14 Tage)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={Object.keys(history).slice(-14).map(d => ({ 
                    date: fmtDate(d), 
                    val: sum(history[d], "kcal"),
                    diff: sum(history[d], "kcal") - (tdee || goals.kcal)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 800}} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="diff" radius={[4, 4, 0, 0]}>
                      {Object.keys(history).slice(-14).map((_, i) => (
                        <Cell key={i} fill={sum(history[Object.keys(history)[i]], "kcal") > (tdee || goals.kcal) ? "#fca5a5" : "#86efac"} />
                      ))}
                    </Bar>
                    <ReferenceLine y={0} stroke="#1c1c1e" strokeWidth={1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* BODY VIEW */}
        {tab === "weight" && (
          <div className="space-y-6">
            <div className="bg-stone-900 rounded-3xl p-8 text-white shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1">Aktueller TDEE</p>
                  <div className="text-4xl font-black">{tdee || goals.kcal} <span className="text-sm font-medium text-stone-600">kcal</span></div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1">Gewicht</p>
                  <div className="text-2xl font-black">{weights.length > 0 ? weights[weights.length-1].val : "--"} <span className="text-xs text-stone-600 font-medium">kg</span></div>
                </div>
              </div>
              <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-2/3" />
              </div>
              <p className="text-[8px] font-bold text-stone-600 mt-4 uppercase tracking-tighter">Wissenschaftlicher Durchschnitt der letzten 21 Tage</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Gewichtsverlauf</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer>
                  <LineChart data={weights.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{fontSize: 9, fontWeight: 800}} axisLine={false} tickLine={false} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="val" stroke="#1c1c1e" strokeWidth={3} dot={{r: 4, fill: '#1c1c1e'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {[
            { id: "today", icon: <Icon.Today />, label: "Tracker" },
            { id: "history", icon: <Icon.History />, label: "Trends" },
            { id: "weight", icon: <Icon.Weight />, label: "Body" },
            { id: "favs", icon: <Icon.Database />, label: "Bank" },
            { id: "goals", icon: <Icon.Goal />, label: "Ziele" }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-1.5 transition-all ${tab === t.id ? "text-stone-900 scale-110" : "text-stone-300"}`}>
              <div className={`p-2.5 rounded-2xl ${tab === t.id ? "bg-stone-900 text-white shadow-lg" : ""}`}>{t.icon}</div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${tab === t.id ? "opacity-100" : "opacity-0"}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
