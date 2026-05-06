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

function TodayView({ entries, goals, weights, selectedDate, addEntry, removeEntry, updateEntry, saveFav, addWeight }) {
  const [activeType, setActiveType] = useState(null);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [editingIdx, setEditingIdx] = useState(null);
  const [wInput, setWInput] = useState("");

  const currentWeight = weights.find(w => w.date === selectedDate)?.val;

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
      {/* Makro Stats Card */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
        <StatBar label="Kalorien" value={totals.kcal} max={goals.kcal} accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein" value={totals.prot} max={goals.prot} accent="#16a34a" />
          <StatBar label="Carbs" value={totals.carbs} max={goals.carbs} accent="#d97706" />
          <StatBar label="Fette" value={totals.fat} max={goals.fat} accent="#3b82f6" />
          <StatBar label="Ballaststoffe" value={totals.fiber} max={goals.fiber} accent="#9333ea" />
        </div>
      </div>

      {/* Gewichtseingabe direkt auf Hauptseite */}
      <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-stone-300">Gewicht</p>
          <div className="text-xl font-black text-stone-800">{currentWeight ? `${currentWeight} kg` : "--"}</div>
        </div>
        <div className="flex gap-2">
          <input 
            type="number" step="0.1" value={wInput} onChange={e => setWInput(e.target.value)}
            placeholder="0.0" className="w-16 bg-stone-50 rounded-xl px-3 py-2 text-xs font-bold outline-none text-center"
          />
          <button onClick={() => { if(wInput) { addWeight(num(wInput)); setWInput(""); } }} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Log</button>
        </div>
      </div>

      {/* Mahlzeiten-Liste */}
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
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayEntries = all[key] || [];
      days.push({
        label: fmtDate(key), kcal: sum(dayEntries, "kcal"),
        prot: sum(dayEntries, "prot"), carbs: sum(dayEntries, "carbs"), 
        fat: sum(dayEntries, "fat"), fiber: sum(dayEntries, "fiber")
      });
    }
    return days;
  }, [historyData, todayEntries]);

  const weeklyTotals = useMemo(() => {
    const totalKcal = chartData.reduce((acc, d) => acc + d.kcal, 0);
    const goalKcal = goals.kcal * 7;
    const diff = totalKcal - goalKcal;
    return { total: totalKcal, diff, status: diff <= 0 ? "Defizit" : "Überschuss" };
  }, [chartData, goals]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-stone-900 rounded-3xl p-6 text-white shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500 mb-1">Wochen-Gesamt</p>
          <div className="text-2xl font-black">{weeklyTotals.total.toLocaleString()} <span className="text-[10px] text-stone-500">kcal</span></div>
        </div>
        <div className={`rounded-3xl p-6 border shadow-sm ${weeklyTotals.diff <= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1">{weeklyTotals.status}</p>
          <div className={`text-2xl font-black ${weeklyTotals.diff <= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {weeklyTotals.diff > 0 ? `+${weeklyTotals.diff}` : weeklyTotals.diff} <span className="text-[10px] opacity-50">kcal</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">7-Tage Energie</p>
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
      
      {/* Makro-Zusammensetzung Chart */}
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
    setEntries(updated); await DB.set(`day-${date}`, updated);
    const hi = await DB.get("hist-index") || [];
    if (!hi.includes(date)) await DB.set("hist-index", [...hi, date]);
  };

  const addWeight = async (v) => {
    const filtered = weights.filter(w => w.date !== selectedDate);
    const updated = [...filtered, { date: selectedDate, val: v }].sort((a,b)=>new Date(a.date)-new Date(b.date));
    setWeights(updated); await DB.set("weights", updated);
    flash(`${v} kg geloggt`);
  };

  const addEntry = (item) => { saveToDB(selectedDate, [...entries, item]); flash("Log gespeichert"); };
  const removeEntry = (idx) => saveToDB(selectedDate, entries.filter((_, i) => i !== idx));
  const updateEntry = (idx, item) => {
    const next = [...entries]; next[idx] = item;
    saveToDB(selectedDate, next); flash("Aktualisiert");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-32 font-sans antialiased">
      <header className="px-8 pt-16 pb-8 flex justify-between items-end max-w-lg mx-auto">
        <h1 className="text-4xl font-black tracking-tighter text-stone-900 capitalize">{tab === "today" ? "Tracker" : tab}</h1>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-stone-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none" />
      </header>

      <main className="px-6 max-w-lg mx-auto">
        {tab === "today" && (
          <TodayView 
            entries={entries} goals={goals} weights={weights} selectedDate={selectedDate}
            addEntry={addEntry} removeEntry={removeEntry} updateEntry={updateEntry} addWeight={addWeight}
            saveFav={f => { const u = [...favs, f]; setFavs(u); DB.set("favs", u); flash("Favorit ★"); }} 
          />
        )}
        {tab === "history" && <HistoryView historyData={histData} todayEntries={entries} goals={goals} />}
        {tab === "weight" && (
          <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
             <p className="text-[10px] font-black uppercase text-stone-300 mb-4">Gewichtshistorie</p>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weights.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{fontSize: 9, fill: '#d6d3d1'}} axisLine={false} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{fontSize: 9, fill: '#d6d3d1'}} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="val" stroke="#1c1c1e" strokeWidth={3} dot={{ r: 4, fill: "#1c1c1e" }} />
                  </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
        )}
        {tab === "favs" && (
          <div className="space-y-3">
            {favs.map((f, i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-stone-50 flex justify-between items-center">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="text-sm font-black truncate">{f.desc}</div>
                  <div className="text-[10px] font-bold text-stone-300 uppercase">{f.kcal} kcal | {f.prot}P | {f.fiber}B</div>
                </div>
                <div className="flex gap-1">
                  {MEAL_TYPES.map(t => <button key={t} onClick={() => addEntry({...f, type: t})} className="bg-stone-50 text-[8px] font-black p-2 rounded-lg hover:bg-stone-900 hover:text-white">{t[0]}</button>)}
                  <button onClick={() => { const u = favs.filter((_, idx)=>idx!==i); setFavs(u); DB.set("favs", u); }} className="text-stone-200 ml-2">✕</button>
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
                <input value={goals[k]} type="number" className="w-full bg-stone-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none" onChange={e => {
                  const g = {...goals, [k]: e.target.value}; g.kcal = calcKcalFromMacros(g);
                  setGoals(g); DB.set("goals", g);
                }} />
              </div>
            ))}
            <div className="pt-4 border-t border-stone-50"><p className="text-[10px] font-black uppercase text-stone-400 mb-1">Ziel</p><p className="text-2xl font-black text-stone-900">{goals.kcal} kcal</p></div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-3xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {[{id:"today", i:<Icon.Today />}, {id:"history", i:<Icon.History />}, {id:"weight", i:<Icon.Weight />}, {id:"favs", i:<Icon.Database />}, {id:"goals", i:<Icon.Goal />}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`p-3 rounded-2xl transition-all ${tab === t.id ? "bg-stone-900 text-white shadow-lg" : "text-stone-300"}`}>{t.i}</button>
          ))}
        </div>
      </nav>
      {toast && <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-black uppercase px-8 py-3 rounded-full z-50 shadow-2xl">{toast}</div>}
    </div>
  );
}
