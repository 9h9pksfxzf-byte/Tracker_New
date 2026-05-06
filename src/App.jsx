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

const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen", "Snack"];
const EMPTY_ENTRY = { desc: "", kcal: "", prot: "", carbs: "", fat: "", fiber: "" };
const DEFAULT_GOALS = { kcal: 2000, prot: 150, carbs: 250, fat: 70, fiber: 30 };

const sum = (arr, key) => Math.round(arr.reduce((s, i) => s + (Number(i[key]) || 0), 0) * 10) / 10;
const num = (v) => v === "" ? 0 : parseFloat(String(v).replace(",", ".")) || 0;

const getMovingAverage = (data, windowSize = 7) => {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const subset = data.slice(start, index + 1);
    const average = subset.reduce((acc, p) => acc + p.val, 0) / subset.length;
    return { ...point, avg: Math.round(average * 10) / 10 };
  });
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
function StatBar({ label, value, max, unit, accent }) {
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

// ─── VIEW: TODAY (MEAL CATEGORIES + WEIGHT) ──────────────────────────────────
function TodayView({ entries, goals, weights, addEntry, removeEntry, addWeight, activeDate }) {
  const [activeType, setActiveType] = useState(null);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [weightInput, setWeightInput] = useState("");

  const currentWeight = weights.find(w => w.date === activeDate)?.val || "--";

  const updateForm = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (!["desc", "kcal"].includes(k)) {
        next.kcal = String(Math.round(num(next.prot) * 4 + num(next.carbs) * 4 + num(next.fat) * 9 + num(next.fiber) * 2));
      }
      return next;
    });
  };

  const t = { kcal: sum(entries,"kcal"), prot: sum(entries,"prot"), carbs: sum(entries,"carbs"), fat: sum(entries,"fat"), fiber: sum(entries,"fiber") };

  return (
    <div className="space-y-6">
      {/* GEWICHT LOGGING HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">Gewicht heute</p>
          <div className="text-3xl font-black text-stone-900">{currentWeight} <span className="text-sm font-medium text-stone-300 uppercase">kg</span></div>
        </div>
        <div className="flex gap-2">
          <input type="number" step="0.1" value={weightInput} onChange={e => setWeightInput(e.target.value)} placeholder="0.0" className="w-16 bg-stone-50 rounded-xl px-3 py-2 text-sm outline-none font-bold text-center" />
          <button onClick={() => { if(weightInput) { addWeight(num(weightInput)); setWeightInput(""); } }} className="bg-stone-900 text-white px-4 rounded-xl font-bold text-xs active:scale-95 transition-all">OK</button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
        <StatBar label="Kalorien" value={t.kcal} max={goals.kcal} unit="kcal" accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein" value={t.prot} max={goals.prot} unit="g" accent="#16a34a" />
          <StatBar label="Carbs" value={t.carbs} max={goals.carbs} unit="g" accent="#d97706" />
          <StatBar label="Fette" value={t.fat} max={goals.fat} unit="g" accent="#3b82f6" />
          <StatBar label="Ballaststoffe" value={t.fiber} max={goals.fiber} unit="g" accent="#9333ea" />
        </div>
      </div>

      {/* MEAL CATEGORIES */}
      <div className="space-y-3">
        {MEAL_TYPES.map(type => {
          const typeEntries = entries.filter(e => e.type === type);
          const typeKcal = sum(typeEntries, "kcal");
          const isOpen = activeType === type;

          return (
            <div key={type} className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden transition-all">
              <button onClick={() => setActiveType(isOpen ? null : type)} className="w-full px-6 py-5 flex justify-between items-center active:bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${typeKcal > 0 ? 'bg-green-500' : 'bg-stone-200'}`} />
                  <span className="text-sm font-black text-stone-800">{type}</span>
                </div>
                <div className="text-right">
                   <span className="text-xs font-black text-stone-900">{typeKcal}</span>
                   <span className="text-[10px] font-bold text-stone-300 ml-1 uppercase">kcal</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="h-px bg-stone-50 w-full mb-4" />
                  {typeEntries.map((item, i) => (
                    <div key={i} className="flex justify-between items-center group">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-stone-700 truncate">{item.desc}</div>
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">
                          {item.kcal} kcal · {item.prot}P · {item.carbs}C · {item.fat}F
                        </div>
                      </div>
                      <button onClick={() => removeEntry(entries.indexOf(item))} className="p-2 text-stone-200 hover:text-red-400 transition-colors text-xs">✕</button>
                    </div>
                  ))}
                  
                  <div className="space-y-3 pt-2">
                    <input value={form.desc} onChange={e => updateForm("desc", e.target.value)} placeholder="Was hast du gegessen?" className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-[13px] outline-none font-medium" />
                    <div className="grid grid-cols-4 gap-2">
                      <input value={form.kcal} onChange={e => updateForm("kcal", e.target.value)} placeholder="kcal" type="number" className="bg-stone-50 border-none rounded-xl py-2 text-center text-xs outline-none font-bold" />
                      <input value={form.prot} onChange={e => updateForm("prot", e.target.value)} placeholder="P" type="number" className="bg-stone-50 border-none rounded-xl py-2 text-center text-xs outline-none font-bold" />
                      <input value={form.carbs} onChange={e => updateForm("carbs", e.target.value)} placeholder="C" type="number" className="bg-stone-50 border-none rounded-xl py-2 text-center text-xs outline-none font-bold" />
                      <input value={form.fat} onChange={e => updateForm("fat", e.target.value)} placeholder="F" type="number" className="bg-stone-50 border-none rounded-xl py-2 text-center text-xs outline-none font-bold" />
                    </div>
                    <button onClick={() => { if(form.desc) { addEntry({...form, type}); setForm(EMPTY_ENTRY); }}} className="w-full bg-stone-900 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest active:scale-[0.98] transition-transform">Speichern</button>
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

// ─── VIEW: WEIGHT (DETAILS) ──────────────────────────────────────────────────
function WeightView({ weights, removeWeight }) {
  const sorted = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dataWithAvg = getMovingAverage(sorted, 7);
  const currentAvg = dataWithAvg.length > 0 ? dataWithAvg[dataWithAvg.length - 1].avg : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-6">Gewichtsverlauf (kg)</p>
        {dataWithAvg.length > 1 ? (
          <div className="h-64 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataWithAvg} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="date" hide />
                <YAxis orientation="right" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none' }} labelFormatter={v => fmtDate(v)} />
                <Line type="monotone" dataKey="val" stroke="#f5f5f4" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="avg" stroke="#1c1c1e" strokeWidth={5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="h-48 flex items-center justify-center text-stone-300 text-xs italic bg-stone-50 rounded-2xl border-2 border-dashed border-stone-100">Mind. 2 Logs nötig...</div>}
      </div>

      <div className="space-y-2">
        {[...weights].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 10).map((w, i) => (
          <div key={i} className="bg-white rounded-2xl px-5 py-4 border border-stone-50 flex justify-between items-center">
            <div>
              <div className="text-sm font-black text-stone-800">{w.val} kg</div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{fmtDate(w.date)}</div>
            </div>
            <button onClick={() => removeWeight(w.date)} className="text-stone-200 hover:text-red-400 px-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VIEW: ANALYSE ───────────────────────────────────────────────────────────
function AnalyseView({ historyData, todayEntries, weights, goals }) {
  const [view, setView] = useState('month');
  const allFood = { ...historyData, [todayKey()]: todayEntries };
  const stats = (() => {
    const groups = {};
    Object.keys(allFood).forEach(dateStr => {
      const d = new Date(dateStr + "T12:00:00");
      let key = view === 'week' ? `KW ${Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7)}` : d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = { label: key, kcal: [], w: [], days: 0, dateObj: d };
      if (allFood[dateStr].length > 0) { groups[key].kcal.push(sum(allFood[dateStr], "kcal")); groups[key].days++; }
    });
    return Object.values(groups).map(g => ({ ...g, avgKcal: g.days > 0 ? Math.round(g.kcal.reduce((a, b) => a + b, 0) / g.days) : 0 })).sort((a, b) => b.dateObj - a.dateObj);
  })();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 mb-6">Energie Trend (kcal)</p>
        <div className="h-48 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...stats].slice(0, 6).reverse()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
              <YAxis orientation="right" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} domain={[0, 'dataMax + 500']} />
              <ReferenceLine y={goals.kcal} stroke="#fca5a5" strokeDasharray="6 6" />
              <Bar dataKey="avgKcal" radius={[8, 8, 8, 8]} barSize={24}>
                {[...stats].slice(0, 6).reverse().map((entry, index) => (
                  <Cell key={index} fill={entry.avgKcal > goals.kcal ? "#f87171" : "#1c1c1e"} />
                ))}
              </Bar>
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
  const [favs, setFavs] = useState([]);
  const [weights, setWeights] = useState([]);
  const [histData, setHistData] = useState({});
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function init() {
      const [g, f, w, hi] = await Promise.all([DB.get("goals"), DB.get("favs"), DB.get("weights"), DB.get("hist-index")]);
      setGoals({ ...DEFAULT_GOALS, ...g });
      setFavs(f || []);
      setWeights(w || []);
      if (hi) {
        const hd = {};
        for (const k of hi) { const d = await DB.get(`day-${k}`); if (d) hd[k] = d; }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    async function loadDay() {
      const e = await DB.get(`day-${selectedDate}`);
      setEntries(e || []);
    }
    if (ready) loadDay();
  }, [selectedDate, ready]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const addEntry = async (item) => {
    const updated = [...entries, item]; 
    setEntries(updated);
    await DB.set(`day-${selectedDate}`, updated);
    const hi = await DB.get("hist-index") || [];
    if (!hi.includes(selectedDate)) await DB.set("hist-index", [...hi, selectedDate]);
    flash(`Log gespeichert ✓`);
  };

  const removeEntry = async (index) => {
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
    await DB.set(`day-${selectedDate}`, updated);
  };

  const addWeight = async (v) => {
    const filtered = weights.filter(w => w.date !== selectedDate);
    const updated = [...filtered, { date: selectedDate, val: v }];
    setWeights(updated);
    await DB.set("weights", updated);
    flash(`Gewicht: ${v}kg`);
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
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-32 font-sans antialiased selection:bg-stone-200">
      <header className="px-8 pt-16 pb-8 flex justify-between items-end max-w-lg mx-auto">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-300 mb-1">Performance Track</p>
          <h1 className="text-4xl font-black tracking-tighter text-stone-900">{TABS.find(t=>t.id===tab).label}</h1>
        </div>
        <div className="flex flex-col items-end">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-stone-100 border-none rounded-xl px-3 py-2 text-[10px] font-black text-stone-600 outline-none" />
          {selectedDate !== todayKey() && (
            <button onClick={() => setSelectedDate(todayKey())} className="text-[9px] font-black text-amber-600 mt-2 uppercase">Heute</button>
          )}
        </div>
      </header>

      <main className="px-6 max-w-lg mx-auto">
        {tab === "today" && <TodayView entries={entries} goals={goals} weights={weights} addEntry={addEntry} removeEntry={removeEntry} addWeight={addWeight} activeDate={selectedDate} />}
        {tab === "history" && <AnalyseView historyData={histData} todayEntries={entries} weights={weights} goals={goals} />}
        {tab === "weight" && <WeightView weights={weights} removeWeight={async(d)=>{const u=weights.filter(w=>w.date!==d); setWeights(u); await DB.set("weights",u);}} />}
        {tab === "favs" && (
          <div className="space-y-3">
            {favs.map((f, i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-stone-50 flex justify-between items-center">
                <div className="min-w-0 flex-1 mr-4">
                  <div className="text-sm font-black truncate">{f.desc}</div>
                  <div className="text-[10px] font-bold text-stone-300 uppercase">{f.kcal} kcal | {f.prot}P</div>
                </div>
                <div className="flex gap-1">
                  {MEAL_TYPES.map(type => (
                    <button key={type} onClick={() => addEntry({...f, type})} className="bg-stone-50 text-[8px] font-black p-2 rounded-lg hover:bg-stone-100">{type[0]}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "goals" && (
          <div className="bg-white rounded-3xl p-8 border border-stone-50 shadow-sm space-y-6">
            {Object.keys(goals).map(k => (
              <div key={k}>
                <label className="text-[10px] font-black uppercase text-stone-400 mb-2 block">{k}</label>
                <input value={goals[k]} type="number" className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none" onChange={e => { const g = {...goals, [k]: num(e.target.value)}; setGoals(g); DB.set("goals", g); }} />
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-3xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-1.5 transition-all ${tab === t.id ? "text-stone-900" : "text-stone-300"}`}>
              <div className={`p-2.5 rounded-2xl ${tab === t.id ? "bg-stone-900 text-white" : ""}`}>{t.icon}</div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${tab === t.id ? "opacity-100" : "opacity-0"}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-full z-50">{toast}</div>}
    </div>
  );
}
