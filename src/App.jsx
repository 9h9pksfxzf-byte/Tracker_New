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
  new Date(k + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

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

const getMovingAverage = (data, windowSize = 7) => {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const subset = data.slice(start, index + 1);
    const average = subset.reduce((acc, p) => acc + p.val, 0) / subset.length;
    return { ...point, avg: Math.round(average * 10) / 10 };
  });
};

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
  if (daySpan <= 0) return null;
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
  const energyFromWeight = (weightDiff * 7700) / daySpan;
  return Math.round(avgIntake - energyFromWeight);
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = {
  Today: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  History: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>,
  Weight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m11 2 9 22"/><path d="m13 2-9 22"/><path d="M2 2h20"/></svg>,
  Database: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>,
  Goal: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
};

// ─── UI ATOMS ────────────────────────────────────────────────────────────────
function StatBar({ label, value, max, accent }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5 px-0.5">
        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{label}</span>
        <span className={`text-[11px] font-bold ${value > max ? "text-red-500" : "text-stone-700"}`}>
          {value}<span className="font-medium text-stone-300">/{max}</span>
        </span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: value > max ? "#ef4444" : accent, transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }} className="h-full rounded-full" />
      </div>
    </div>
  );
}

// ─── VIEW: TODAY ─────────────────────────────────────────────────────────────
function TodayView({ entries, goals, addEntry, removeEntry, updateEntry, saveFav }) {
  const [activeType, setActiveType] = useState(null);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [editingIndex, setEditingIndex] = useState(null);

  const updateForm = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (["prot", "carbs", "fat", "fiber"].includes(k)) next.kcal = String(calcKcalFromMacros(next));
      return next;
    });
  };

  const handleLog = (type) => {
    if (!form.desc) return;
    if (editingIndex !== null) {
      updateEntry(editingIndex, { ...form, type });
    } else {
      addEntry({ ...form, type });
    }
    setForm(EMPTY_ENTRY);
    setEditingIndex(null);
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
          const typeKcal = sum(typeEntries, "kcal");
          const isOpen = activeType === type;
          return (
            <div key={type} className={`bg-white rounded-3xl border transition-all ${editingIndex !== null && activeType === type ? "border-stone-900 ring-4 ring-stone-900/5" : "border-stone-100 shadow-sm"}`}>
              <button onClick={() => { setActiveType(isOpen ? null : type); setEditingIndex(null); setForm(EMPTY_ENTRY); }} className="w-full px-6 py-5 flex justify-between items-center active:bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${typeKcal > 0 ? 'bg-green-500' : 'bg-stone-200'}`} />
                  <span className="text-sm font-black text-stone-800">{type}</span>
                </div>
                <div className="text-right"><span className="text-xs font-black text-stone-900">{typeKcal}</span><span className="text-[10px] font-bold text-stone-300 ml-1 uppercase">kcal</span></div>
              </button>
              {isOpen && (
                <div className="px-6 pb-6 space-y-4">
                  {typeEntries.map((item) => (
                    <div key={item.originalIndex} className={`flex justify-between items-center p-2 -mx-2 rounded-xl transition-colors ${editingIndex === item.originalIndex ? "bg-stone-50" : ""}`}>
                      <button onClick={() => { setForm(item); setEditingIndex(item.originalIndex); }} className="min-w-0 flex-1 text-left mr-2 group">
                        <div className="text-[13px] font-bold text-stone-700 truncate group-hover:text-stone-900">{item.desc}</div>
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{item.kcal} kcal · {item.prot}P · {item.carbs}C · {item.fat}F · {item.fiber}B</div>
                      </button>
                      <button onClick={() => removeEntry(item.originalIndex)} className="text-stone-200 hover:text-red-400 text-xs px-2">✕</button>
                    </div>
                  ))}
                  <div className="space-y-3 pt-4 border-t border-stone-50">
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-black uppercase text-stone-400">{editingIndex !== null ? "Eintrag bearbeiten" : "Neuer Eintrag"}</span>
                       {editingIndex !== null && <button onClick={() => {setEditingIndex(null); setForm(EMPTY_ENTRY);}} className="text-[9px] font-black uppercase text-red-400">Abbrechen</button>}
                    </div>
                    <input value={form.desc} onChange={e => updateForm("desc", e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLog(type)} placeholder="Name..." className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-[13px] outline-none font-bold" />
                    <div className="grid grid-cols-5 gap-1.5">
                      {["kcal", "prot", "carbs", "fat", "fiber"].map(k => (
                        <div key={k} className="flex flex-col gap-1">
                          <span className="text-[7px] font-black uppercase text-stone-300 text-center">{k}</span>
                          <input value={form[k]} onChange={e => updateForm(k, e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLog(type)} placeholder="0" type="number" className="bg-stone-50 border-none rounded-xl py-2 text-center text-xs outline-none font-bold" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLog(type)} className={`flex-1 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all ${editingIndex !== null ? "bg-blue-600" : "bg-stone-900"}`}>{editingIndex !== null ? "Update" : "Log"}</button>
                      <button onClick={() => form.desc && saveFav(form)} className="bg-stone-100 text-stone-400 px-4 rounded-2xl active:scale-95">★</button>
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

// ─── VIEW: HISTORY ───────────────────────────────────────────────────────────
function HistoryView({ historyData, todayEntries, goals }) {
  const chartData = useMemo(() => {
    const allHistory = { ...historyData, [todayKey()]: todayEntries };
    return Object.keys(allHistory).slice(-7).map(d => ({ label: fmtDate(d), val: sum(allHistory[d], "kcal") }));
  }, [historyData, todayEntries]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Energie Trend (kcal)</p>
      <div className="h-48 w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 'dataMax + 500']} />
            <Bar dataKey="val" radius={[6, 6, 6, 6]} barSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.val > goals.kcal ? "#fca5a5" : "#1c1c1e"} />
              ))}
            </Bar>
            <ReferenceLine y={goals.kcal} stroke="#fca5a5" strokeDasharray="4 4" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── VIEW: BODY ──────────────────────────────────────────────────────────────
function BodyView({ weights, addWeight, activeDate, removeWeight, historyData, todayEntries }) {
  const [weightInput, setWeightInput] = useState("");
  const currentWeight = useMemo(() => weights.find(w => w.date === activeDate)?.val || "--", [weights, activeDate]);
  const tdee = useMemo(() => {
    const allHistory = { ...historyData, [todayKey()]: todayEntries };
    return calculateTDEE(weights, allHistory);
  }, [weights, historyData, todayEntries]);
  const chartData = useMemo(() => getMovingAverage(weights, 7).slice(-14), [weights]);
  const { minW, maxW } = useMemo(() => {
    const vals = weights.map(w => w.val);
    if (vals.length === 0) return { minW: 0, maxW: 100 };
    return { minW: Math.floor(Math.min(...vals) - 1), maxW: Math.ceil(Math.max(...vals) + 1) };
  }, [weights]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex justify-between items-center">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">Gewicht Heute</p>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-black text-stone-900">{currentWeight} <span className="text-sm font-medium text-stone-300 uppercase">kg</span></div>
            {currentWeight !== "--" && <button onClick={() => removeWeight(activeDate)} className="text-stone-200 hover:text-red-400 p-1">✕</button>}
          </div></div>
          <div className="flex gap-2">
            <input type="number" step="0.1" value={weightInput} onChange={e => setWeightInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && weightInput && (addWeight(num(weightInput)), setWeightInput(""))} placeholder="0.0" className="w-16 bg-stone-50 rounded-xl px-3 py-2 text-sm outline-none font-bold text-center" />
            <button onClick={() => { if(weightInput) { addWeight(num(weightInput)); setWeightInput(""); } }} className="bg-stone-900 text-white px-4 rounded-xl font-bold text-xs active:scale-95 transition-all">Log</button>
          </div>
        </div>
        {tdee && (
          <div className="bg-stone-900 rounded-3xl p-6 shadow-sm text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1">Wiss. Verbrauch (TDEE)</p>
            <div className="text-3xl font-black">{tdee} <span className="text-sm font-medium text-stone-500 uppercase">kcal</span></div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{fontSize: 9, fill: '#d6d3d1'}} axisLine={false} />
            <YAxis domain={[minW, maxW]} tick={{fontSize: 9, fill: '#d6d3d1'}} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
            <Line type="monotone" dataKey="val" stroke="#e7e5e4" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="avg" stroke="#1c1c1e" strokeWidth={4} dot={false} />
          </LineChart>
        </ResponsiveContainer>
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
      if (g) setGoals({ ...DEFAULT_GOALS, ...g });
      setWeights(w || []);
      setFavs(f || []);
      if (hi) {
        const hd = {};
        for (const k of hi.slice(-30)) {
          const d = await DB.get(`day-${k}`); if (d) hd[k] = d;
        }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => { if (ready) DB.get(`day-${selectedDate}`).then(e => setEntries(e || [])); }, [selectedDate, ready]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const addEntry = async (item) => {
    const updated = [...entries, item]; setEntries(updated);
    await DB.set(`day-${selectedDate}`, updated);
    const hi = await DB.get("hist-index") || [];
    if (!hi.includes(selectedDate)) await DB.set("hist-index", [...hi, selectedDate]);
    flash("Log gespeichert");
  };

  const removeEntry = async (idx) => {
    const updated = entries.filter((_, i) => i !== idx);
    setEntries(updated);
    await DB.set(`day-${selectedDate}`, updated);
  };

  const updateEntry = async (idx, item) => {
    const updated = [...entries]; updated[idx] = item;
    setEntries(updated);
    await DB.set(`day-${selectedDate}`, updated);
    flash("Eintrag aktualisiert");
  };

  const saveFav = async (f) => {
    const updated = [...favs, f]; setFavs(updated);
    await DB.set("favs", updated);
    flash("Favorit ★");
  };

  const addWeight = async (v) => {
    const filtered = weights.filter(w => w.date !== selectedDate);
    const updated = [...filtered, { date: selectedDate, val: v }].sort((a,b)=>new Date(a.date)-new Date(b.date));
    setWeights(updated); await DB.set("weights", updated);
    flash(`${v}kg geloggt`);
  };

  const removeWeight = async (d) => {
    const updated = weights.filter(w => w.date !== d);
    setWeights(updated); await DB.set("weights", updated);
  };

  const TABS = [
    { id: "today", label: "Tracker", icon: <Icon.Today /> },
    { id: "history", label: "Trends", icon: <Icon.History /> },
    { id: "weight", label: "Körper", icon: <Icon.Weight /> },
    { id: "favs", label: "Bank", icon: <Icon.Database /> },
    { id: "goals", label: "Ziele", icon: <Icon.Goal /> },
  ];

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-32 font-sans antialiased">
      <header className="px-8 pt-16 pb-8 flex justify-between items-end max-w-lg mx-auto">
        <div><p className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-300 mb-1">Performance Track</p>
        <h1 className="text-4xl font-black tracking-tighter text-stone-900">{TABS.find(t=>t.id===tab).label}</h1></div>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-stone-100 border-none rounded-xl px-3 py-2 text-[10px] font-black text-stone-600 outline-none" />
      </header>

      <main className="px-6 max-w-lg mx-auto">
        {tab === "today" && <TodayView entries={entries} goals={goals} addEntry={addEntry} removeEntry={removeEntry} updateEntry={updateEntry} saveFav={saveFav} />}
        {tab === "history" && <HistoryView historyData={histData} todayEntries={entries} goals={goals} />}
        {tab === "weight" && <BodyView weights={weights} addWeight={addWeight} activeDate={selectedDate} removeWeight={removeWeight} historyData={histData} todayEntries={entries} />}
        {tab === "favs" && (
          <div className="space-y-3">
            {favs.map((f, i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-stone-50 flex justify-between items-center">
                <div className="min-w-0 flex-1 mr-4">
                  <div className="text-sm font-black truncate">{f.desc}</div>
                  <div className="text-[10px] font-bold text-stone-300 uppercase">{f.kcal} kcal | {f.prot}P | {f.fiber}B</div>
                </div>
                <div className="flex gap-1">
                  {MEAL_TYPES.map(type => <button key={type} onClick={() => addEntry({...f, type})} className="bg-stone-50 text-[8px] font-black p-2 rounded-lg hover:bg-stone-900 hover:text-white transition-all">{type[0]}</button>)}
                  <button onClick={() => { const u = favs.filter((_, idx)=>idx!==i); setFavs(u); DB.set("favs", u); }} className="text-stone-200 ml-2 hover:text-red-400">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "goals" && (
          <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm space-y-6">
            {["prot", "carbs", "fat", "fiber"].map(k => (
              <div key={k}>
                <label className="text-[10px] font-black uppercase text-stone-400 mb-2 block">{k}</label>
                <input value={goals[k]} type="number" className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none" onChange={e => { const g = {...goals, [k]: e.target.value}; g.kcal = calcKcalFromMacros(g); setGoals(g); DB.set("goals", g); }} />
              </div>
            ))}
            <div className="pt-4 border-t border-stone-50"><p className="text-[10px] font-black uppercase text-stone-400 mb-1">Ziel</p><p className="text-2xl font-black text-stone-900">{goals.kcal} kcal</p></div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-3xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-1.5 transition-all ${tab === t.id ? "text-stone-900" : "text-stone-300"}`}>
              <div className={`p-2.5 rounded-2xl transition-all ${tab === t.id ? "bg-stone-900 text-white shadow-lg scale-110" : ""}`}>{t.icon}</div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${tab === t.id ? "opacity-100" : "opacity-0"}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-black uppercase px-8 py-3 rounded-full z-50 shadow-2xl animate-in fade-in zoom-in-95">{toast}</div>}
    </div>
  );
}
