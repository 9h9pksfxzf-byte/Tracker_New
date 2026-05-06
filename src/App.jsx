import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell, LineChart, Line, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie } from "recharts";

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
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
        <StatBar label="Kalorien" value={totals.kcal} max={goals.kcal} accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein" value={totals.prot} max={goals.prot} accent="#16a34a" />
          <StatBar label="Carbs" value={totals.carbs} max={goals.carbs} accent="#d97706" />
          <StatBar label="Fette" value={totals.fat} max={goals.fat} accent="#3b82f6" />
          <StatBar label="Ballaststoffe" value={totals.fiber} max={goals.fiber} accent="#9333ea" />
        </div>
      </div>

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

function HistoryView({ historyData, todayEntries, goals, weights }) {
  const chartData = useMemo(() => {
    const all = { ...historyData, [todayKey()]: todayEntries };
    const days = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayEntries = all[key] || [];
      const weightEntry = weights.find(w => w.date === key);
      
      days.push({
        label: fmtDate(key),
        fullDate: key,
        kcal: sum(dayEntries, "kcal"),
        prot: sum(dayEntries, "prot"),
        carbs: sum(dayEntries, "carbs"),
        fat: sum(dayEntries, "fat"),
        fiber: sum(dayEntries, "fiber"),
        weight: weightEntry ? weightEntry.val : null,
        hasData: dayEntries.length > 0
      });
    }

    return days.map((day, idx) => {
      if (idx === 0) return { ...day, tdee: goals.kcal };
      const prevWeight = days[idx-1].weight;
      if (day.weight && prevWeight && day.hasData) {
          const weightDiff = day.weight - prevWeight;
          return { ...day, tdee: Math.round(day.kcal - (weightDiff * 7700)) };
      }
      return { ...day, tdee: null };
    });
  }, [historyData, todayEntries, weights, goals]);

  // ─── ANALYSE LOGIK ───
  const analysis = useMemo(() => {
    const trackedDays = chartData.filter(d => d.hasData);
    if (trackedDays.length === 0) return null;

    const stats = ["prot", "carbs", "fat", "fiber"].map(macro => {
      const vals = trackedDays.map(d => (d[macro] / goals[macro]) * 100);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      // Konsistenz (Standardabweichung): Niedriger ist besser
      const stdDev = Math.sqrt(vals.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / vals.length);
      
      return { 
        key: macro, 
        avg: Math.round(avg), 
        consistency: Math.max(0, 100 - Math.round(stdDev * 2)), // Score 0-100
        color: macro === "prot" ? "#16a34a" : macro === "carbs" ? "#d97706" : macro === "fat" ? "#3b82f6" : "#9333ea"
      };
    });

    const totalKcal = trackedDays.reduce((s, d) => s + d.kcal, 0);
    const goalKcal = goals.kcal * trackedDays.length;
    const kcalReach = Math.round((totalKcal / goalKcal) * 100);

    return { stats, kcalReach, days: trackedDays.length };
  }, [chartData, goals]);

  return (
    <div className="space-y-6">
      {/* Makro Zielerreichung Cards */}
      {analysis && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-stone-900 rounded-3xl p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500 mb-4">7-Tage Score</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black">{analysis.kcalReach}%</span>
                <span className="text-[10px] text-stone-400 mb-2 uppercase font-bold">Zielerreichung kcal</span>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          </div>

          {analysis.stats.map(s => (
            <div key={s.key} className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase text-stone-300 tracking-tighter">{s.key}</span>
                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: s.color }} />
              </div>
              <div className="text-xl font-black text-stone-800">{s.avg}%</div>
              <div className="mt-3">
                <div className="flex justify-between text-[8px] font-black uppercase text-stone-400 mb-1">
                  <span>Konsistenz</span>
                  <span>{s.consistency}%</span>
                </div>
                <div className="h-1 bg-stone-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.consistency}%`, backgroundColor: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts (TDEE & Energie) */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">TDEE Trend</p>
        <div className="h-48 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTdee" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1c1c1e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#1c1c1e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
              <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />
              <Tooltip cursor={{stroke: '#f5f5f4'}} contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '10px', fontWeight: 'bold' }} />
              <Area type="monotone" dataKey="tdee" stroke="#1c1c1e" strokeWidth={3} fillOpacity={1} fill="url(#colorTdee)" connectNulls />
              <ReferenceLine y={goals.kcal} stroke="#d6d3d1" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
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
                {chartData.map((e, i) => <Cell key={i} fill={!e.hasData ? "#f5f5f4" : e.kcal > goals.kcal ? "#fca5a5" : "#1c1c1e"} />)}
              </Bar>
              <ReferenceLine y={goals.kcal} stroke="#fca5a5" strokeDasharray="4 4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function WeightView({ weights }) {
  const [range, setRange] = useState("Tag");

  const processedData = useMemo(() => {
    if (!weights.length) return [];
    const now = new Date();
    let daysToLookBack = 7;
    let grouping = "day";

    if (range === "Woche") { daysToLookBack = 28; grouping = "week"; }
    else if (range === "Monat") { daysToLookBack = 180; grouping = "month"; }
    else if (range === "Quartal") { daysToLookBack = 730; grouping = "quarter"; }

    const startDate = new Date();
    startDate.setDate(now.getDate() - daysToLookBack);
    const filtered = weights.filter(w => new Date(w.date) >= startDate);

    const groups = {};
    filtered.forEach(w => {
      const d = new Date(w.date);
      let key;
      if (grouping === "day") key = w.date;
      else if (grouping === "week") {
          const oneJan = new Date(d.getFullYear(), 0, 1);
          const weekNum = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
          key = `KW ${weekNum}`;
      }
      else if (grouping === "month") key = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
      else if (grouping === "quarter") {
          const q = Math.floor(d.getMonth() / 3) + 1;
          key = `Q${q} ${d.getFullYear().toString().slice(-2)}`;
      }
      if (!groups[key]) groups[key] = { label: key, sum: 0, count: 0 };
      groups[key].sum += w.val;
      groups[key].count += 1;
    });

    return Object.values(groups).map(g => ({
      label: g.label,
      val: Math.round((g.sum / g.count) * 10) / 10
    }));
  }, [weights, range]);

  return (
    <div className="space-y-6">
      <div className="flex bg-stone-100 p-1 rounded-2xl">
        {["Tag", "Woche", "Monat", "Quartal"].map(r => (
          <button key={r} onClick={() => setRange(r)} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${range === r ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"}`}>
            {r}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <div className="h-64 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{fontSize: 9, fill: '#d6d3d1'}} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '10px', fontWeight: 'bold' }} />
              <Line type="monotone" dataKey="val" stroke="#1c1c1e" strokeWidth={4} dot={{ r: 4, fill: "#1c1c1e", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
            </LineChart>
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
    setHistData(prev => ({...prev, [date]: updated}));
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
        {tab === "history" && <HistoryView historyData={histData} todayEntries={entries} goals={goals} weights={weights} />}
        {tab === "weight" && <WeightView weights={weights} />}
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
