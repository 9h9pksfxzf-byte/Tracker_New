import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell, LineChart, Line, YAxis, Tooltip, CartesianGrid } from "recharts";

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

const calculateTDEE = (weights, history, days = 21) => {
  const sortedWeights = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedWeights.length < 5) return null;
  const now = new Date();
  const startLimit = new Date();
  startLimit.setDate(now.getDate() - days);
  const relevantWeights = sortedWeights.filter(w => new Date(w.date) >= startLimit);
  if (relevantWeights.length < 3) return null;
  const weightDiff = relevantWeights[relevantWeights.length - 1].val - relevantWeights[0].val;
  const daySpan = (new Date(relevantWeights[relevantWeights.length - 1].date) - new Date(relevantWeights[0].date)) / 86400000;
  let totalKcal = 0, loggedDays = 0;
  Object.keys(history).forEach(d => {
    if (new Date(d) >= new Date(relevantWeights[0].date)) {
      const dailyKcal = sum(history[d], "kcal");
      if (dailyKcal > 800) { totalKcal += dailyKcal; loggedDays++; }
    }
  });
  if (loggedDays < daySpan * 0.7) return null;
  return Math.round((totalKcal / loggedDays) - ((weightDiff * 7700) / daySpan));
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = {
  Today: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>,
  Weight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m11 2 9 22M13 2l-9 22M2 2h20"/></svg>,
  Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/></svg>,
  Goal: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
function StatBar({ label, value, max, accent }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5 px-0.5">
        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{label}</span>
        <span className={`text-[11px] font-bold ${value > max ? "text-red-500" : "text-stone-700"}`}>{value}<span className="font-medium text-stone-300">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: value > max ? "#ef4444" : accent, transition: "width 0.6s ease" }} className="h-full rounded-full" />
      </div>
    </div>
  );
}

function TodayView({ entries, goals, addEntry, removeEntry, updateEntry, saveFav }) {
  const [activeType, setActiveType] = useState(null);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [editingIdx, setEditingIdx] = useState(null);

  const handleLog = (type) => {
    if (!form.desc) return;
    editingIdx !== null ? updateEntry(editingIdx, { ...form, type }) : addEntry({ ...form, type });
    setForm(EMPTY_ENTRY); setEditingIdx(null);
  };

  const totals = useMemo(() => ({
    kcal: sum(entries, "kcal"), prot: sum(entries, "prot"), carbs: sum(entries, "carbs"), fat: sum(entries, "fat"), fiber: sum(entries, "fiber")
  }), [entries]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
        <StatBar label="Kalorien" value={totals.kcal} max={goals.kcal} accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein" value={totals.prot} max={goals.prot} accent="#16a34a" />
          <StatBar label="Carbs" value={totals.carbs} max={goals.carbs} accent="#d97706" />
          <StatBar label="Fette" value={totals.fat} max={goals.fat} accent="#3b82f6" />
          <StatBar label="Ballaststoffe" value={totals.fiber} max={goals.fiber} accent="#9333ea" />
        </div>
      </div>

      <div className="space-y-3">
        {MEAL_TYPES.map(type => {
          const typeEntries = entries.map((e, idx) => ({ ...e, originalIndex: idx })).filter(e => e.type === type);
          const isOpen = activeType === type;
          return (
            <div key={type} className={`bg-white rounded-3xl border transition-all ${editingIdx !== null && activeType === type ? "border-stone-900 ring-4 ring-stone-900/5" : "border-stone-100"}`}>
              <button onClick={() => { setActiveType(isOpen ? null : type); setEditingIdx(null); setForm(EMPTY_ENTRY); }} className="w-full px-6 py-5 flex justify-between items-center active:bg-stone-50">
                <span className="text-sm font-black text-stone-800">{type}</span>
                <span className="text-xs font-black text-stone-900">{sum(typeEntries, "kcal")} <span className="text-[10px] text-stone-300">kcal</span></span>
              </button>
              {isOpen && (
                <div className="px-6 pb-6 space-y-4">
                  {typeEntries.map(item => (
                    <div key={item.originalIndex} className={`flex justify-between items-center p-2 -mx-2 rounded-xl ${editingIdx === item.originalIndex ? "bg-stone-50" : ""}`}>
                      <button onClick={() => { setForm(item); setEditingIdx(item.originalIndex); }} className="text-left flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-stone-700 truncate">{item.desc}</div>
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{item.kcal} kcal · {item.prot}P · {item.carbs}C · {item.fat}F</div>
                      </button>
                      <button onClick={() => removeEntry(item.originalIndex)} className="text-stone-200 hover:text-red-400 px-2 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-stone-50 space-y-3">
                    <input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Was hast du gegessen?" className="w-full bg-stone-50 rounded-2xl px-4 py-3 text-[13px] outline-none font-bold" />
                    <div className="grid grid-cols-5 gap-1.5">
                      {["kcal", "prot", "carbs", "fat", "fiber"].map(k => (
                        <input key={k} value={form[k]} type="number" placeholder={k} onChange={e => {
                          const next = { ...form, [k]: e.target.value };
                          if (k !== "kcal") next.kcal = String(calcKcalFromMacros(next));
                          setForm(next);
                        }} className="bg-stone-50 rounded-xl py-2 text-center text-xs outline-none font-bold" />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLog(type)} className={`flex-1 text-white font-black py-3 rounded-2xl text-xs uppercase ${editingIdx !== null ? "bg-blue-600" : "bg-stone-900"}`}>{editingIdx !== null ? "Update" : "Log"}</button>
                      <button onClick={() => form.desc && saveFav(form)} className="bg-stone-100 text-stone-400 px-4 rounded-2xl">★</button>
                    </div>
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

function HistoryView({ historyData, todayEntries, goals }) {
  const chartData = useMemo(() => {
    const all = { ...historyData, [todayKey()]: todayEntries };
    return Object.keys(all).slice(-7).map(d => ({
      label: fmtDate(d),
      kcal: sum(all[d], "kcal"), prot: sum(all[d], "prot"), carbs: sum(all[d], "carbs"), fat: sum(all[d], "fat"), fiber: sum(all[d], "fiber")
    }));
  }, [historyData, todayEntries]);

  const avgPerf = useMemo(() => {
    if (!chartData.length) return {};
    const getAvg = (k) => chartData.reduce((a, b) => a + b[k], 0) / chartData.length;
    return {
      prot: Math.round((getAvg("prot") / goals.prot) * 100),
      carbs: Math.round((getAvg("carbs") / goals.carbs) * 100),
      fat: Math.round((getAvg("fat") / goals.fat) * 100),
      fiber: Math.round((getAvg("fiber") / goals.fiber) * 100)
    };
  }, [chartData, goals]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Energie Trend (kcal)</p>
        <div className="h-48 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 'dataMax + 500']} />
              <Bar dataKey="kcal" radius={[6, 6, 6, 6]} barSize={32}>
                {chartData.map((e, i) => <Cell key={i} fill={e.kcal > goals.kcal ? "#fca5a5" : "#1c1c1e"} />)}
              </Bar>
              <ReferenceLine y={goals.kcal} stroke="#fca5a5" strokeDasharray="4 4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Makro-Erfüllung (7-Tage Ø)</p>
        <div className="grid grid-cols-2 gap-6">
          {[{k:"prot", l:"Protein", c:"#16a34a"}, {k:"carbs", l:"Carbs", c:"#d97706"}, {k:"fat", l:"Fett", c:"#3b82f6"}, {k:"fiber", l:"Fiber", c:"#9333ea"}].map(m => (
            <div key={m.k} className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase"><span>{m.l}</span><span className="text-stone-400">{avgPerf[m.k]}%</span></div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div style={{ width: `${Math.min(avgPerf[m.k], 100)}%`, backgroundColor: m.c }} className="h-full rounded-full transition-all duration-1000" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Zusammensetzung (g)</p>
        <div className="h-56 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 9, fill: '#d6d3d1'}} axisLine={false} />
              <Tooltip cursor={{fill: '#fafaf8'}} contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '10px', fontWeight: 'bold' }} />
              <Bar dataKey="prot" stackId="a" fill="#16a34a" />
              <Bar dataKey="carbs" stackId="a" fill="#d97706" />
              <Bar dataKey="fat" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [weights, setWeights] = useState([]);
  const [favs, setFavs] = useState([]);
  const [histData, setHistData] = useState({});
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function init() {
      const [g, w, f, hi] = await Promise.all([DB.get("goals"), DB.get("weights"), DB.get("favs"), DB.get("hist-index")]);
      if (g) setGoals(g); setWeights(w || []); setFavs(f || []);
      if (hi) {
        const hd = {};
        for (const k of hi.slice(-30)) { const d = await DB.get(`day-${k}`); if (d) hd[k] = d; }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => { if (ready) DB.get(`day-${selectedDate}`).then(e => setEntries(e || [])); }, [selectedDate, ready]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const saveToDB = async (date, updated) => {
    setEntries(updated);
    await DB.set(`day-${date}`, updated);
    const hi = await DB.get("hist-index") || [];
    if (!hi.includes(date)) await DB.set("hist-index", [...hi, date]);
  };

  const addEntry = (item) => { saveToDB(selectedDate, [...entries, item]); flash("Log gespeichert"); };
  const removeEntry = (idx) => saveToDB(selectedDate, entries.filter((_, i) => i !== idx));
  const updateEntry = (idx, item) => {
    const next = [...entries]; next[idx] = item;
    saveToDB(selectedDate, next); flash("Eintrag aktualisiert");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-32 font-sans antialiased">
      <header className="px-8 pt-16 pb-8 flex justify-between items-end max-w-lg mx-auto">
        <h1 className="text-4xl font-black tracking-tighter text-stone-900 capitalize">{tab === "today" ? "Tracker" : tab}</h1>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-stone-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none" />
      </header>

      <main className="px-6 max-w-lg mx-auto">
        {tab === "today" && <TodayView entries={entries} goals={goals} addEntry={addEntry} removeEntry={removeEntry} updateEntry={updateEntry} saveFav={f => { setFavs([...favs, f]); DB.set("favs", [...favs, f]); flash("Favorit ★"); }} />}
        {tab === "history" && <HistoryView historyData={histData} todayEntries={entries} goals={goals} />}
        {tab === "weight" && (
          <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
             <p className="text-[10px] font-black uppercase text-stone-300 mb-4">Wissenschaftlicher TDEE</p>
             <div className="text-3xl font-black">{calculateTDEE(weights, histData) || "---"} <span className="text-sm font-medium text-stone-300 uppercase">kcal</span></div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-3xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {[{id:"today", i:<Icon.Today />}, {id:"history", i:<Icon.History />}, {id:"weight", i:<Icon.Weight />}, {id:"favs", i:<Icon.Database />}, {id:"goals", i:<Icon.Goal />}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`p-3 rounded-2xl transition-all ${tab === t.id ? "bg-stone-900 text-white" : "text-stone-300"}`}>{t.i}</button>
          ))}
        </div>
      </nav>
      {toast && <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-black uppercase px-8 py-3 rounded-full z-50 shadow-2xl">{toast}</div>}
    </div>
  );
}
