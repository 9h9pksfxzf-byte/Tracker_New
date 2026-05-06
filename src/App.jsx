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

// ─── VIEW: TODAY ─────────────────────────────────────────────────────────────
function TodayView({ entries, goals, addEntry, removeEntry, onStar }) {
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [kcalAuto, setKcalAuto] = useState(true);

  const updateForm = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (kcalAuto && !["desc", "kcal"].includes(k)) {
        next.kcal = String(Math.round(num(next.prot) * 4 + num(next.carbs) * 4 + num(next.fat) * 9 + num(next.fiber) * 2));
      }
      return next;
    });
  };

  const t = { kcal: sum(entries,"kcal"), prot: sum(entries,"prot"), carbs: sum(entries,"carbs"), fat: sum(entries,"fat"), fiber: sum(entries,"fiber") };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
        <StatBar label="Kalorien" value={t.kcal} max={goals.kcal} unit="kcal" accent="#1c1c1e" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <StatBar label="Protein" value={t.prot} max={goals.prot} unit="g" accent="#16a34a" />
          <StatBar label="Carbs" value={t.carbs} max={goals.carbs} unit="g" accent="#d97706" />
          <StatBar label="Fette" value={t.fat} max={goals.fat} unit="g" accent="#3b82f6" />
          <StatBar label="Ballaststoffe" value={t.fiber} max={goals.fiber} unit="g" accent="#9333ea" />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-3">
        <input value={form.desc} onChange={e => updateForm("desc", e.target.value)} placeholder="Mahlzeit-Bezeichnung..." className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-stone-100 outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.kcal} onChange={e => { setKcalAuto(false); updateForm("kcal", e.target.value); }} placeholder="kcal" type="number" className="bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm outline-none" />
          <input value={form.prot} onChange={e => updateForm("prot", e.target.value)} placeholder="Protein g" type="number" className="bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm outline-none" />
          <input value={form.carbs} onChange={e => updateForm("carbs", e.target.value)} placeholder="Carbs g" type="number" className="bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm outline-none" />
          <input value={form.fat} onChange={e => updateForm("fat", e.target.value)} placeholder="Fett g" type="number" className="bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm outline-none" />
          <input value={form.fiber} onChange={e => updateForm("fiber", e.target.value)} placeholder="Ballaststoffe g" type="number" className="col-span-2 bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm outline-none" />
        </div>
        <button onClick={() => { if(form.desc) { addEntry({...form, kcal: num(form.kcal)}); setForm(EMPTY_ENTRY); setKcalAuto(true); }}} className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-stone-200">Loggen</button>
      </div>

      <div className="space-y-2">
        {entries.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl px-5 py-4 border border-stone-50 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
            <div className="min-w-0">
              <div className="text-sm font-black text-stone-800 truncate">{item.desc}</div>
              <div className="text-[10px] font-bold text-stone-400 space-x-2 mt-0.5">
                <span>{item.kcal} kcal</span>
                <span className="text-green-600">{item.prot}P</span>
                <span className="text-amber-600">{item.carbs}C</span>
                <span className="text-blue-500">{item.fat}F</span>
              </div>
            </div>
            <div className="flex gap-1 ml-4">
              <button onClick={() => onStar(item)} className="p-2 text-stone-200 hover:text-amber-400 text-xl">★</button>
              <button onClick={() => removeEntry(i)} className="p-2 text-stone-200 hover:text-red-400">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VIEW: WEIGHT ────────────────────────────────────────────────────────────
function WeightView({ weights, addWeight, removeWeight, activeDate }) {
  const [val, setVal] = useState("");
  const sorted = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dataWithAvg = getMovingAverage(sorted, 7);
  const currentAvg = dataWithAvg.length > 0 ? dataWithAvg[dataWithAvg.length - 1].avg : 0;
  const startAvg = dataWithAvg.length > 0 ? dataWithAvg[0].avg : 0;
  const diff = Math.round((currentAvg - startAvg) * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">Ø Gewicht (7-Tage)</p>
            <div className="text-4xl font-black text-stone-900">{currentAvg || "--"} <span className="text-sm font-medium text-stone-300 uppercase">kg</span></div>
            <div className={`text-xs font-bold mt-1.5 ${diff <= 0 ? "text-green-600" : "text-red-500"}`}>
              {diff > 0 ? "+" : ""}{diff} kg Trend
            </div>
          </div>
          <div className="flex gap-2">
            <input type="number" step="0.1" value={val} onChange={e => setVal(e.target.value)} placeholder="0.0" className="w-20 bg-stone-50 rounded-2xl px-3 py-3 text-sm outline-none font-bold" />
            <button onClick={() => { if(val) { addWeight(num(val)); setVal(""); } }} className="bg-stone-900 text-white px-5 rounded-2xl font-bold active:scale-95 transition-all shadow-md">Log</button>
          </div>
        </div>

        {dataWithAvg.length > 1 ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataWithAvg}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} labelFormatter={v => fmtDate(v)} />
                <Line type="monotone" dataKey="val" stroke="#f5f5f4" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="avg" stroke="#1c1c1e" strokeWidth={5} dot={false} animationDuration={1500} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="h-48 flex items-center justify-center text-stone-300 text-xs italic bg-stone-50 rounded-2xl border-2 border-dashed border-stone-100">Mind. 2 Logs nötig...</div>}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 px-1">Historie (Zuletzt)</p>
        {[...weights].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 5).map((w, i) => (
          <div key={i} className="bg-white rounded-2xl px-5 py-4 border border-stone-50 flex justify-between items-center group">
            <div>
              <div className="text-sm font-black text-stone-800">{w.val.toLocaleString('de-DE')} kg</div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{fmtDate(w.date)}</div>
            </div>
            <button onClick={() => removeWeight(w.date)} className="text-stone-200 hover:text-red-400 px-2 transition-colors">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VIEW: ANALYSE ───────────────────────────────────────────────────────────
function AnalyseView({ historyData, todayEntries, weights, goals, activeDate }) {
  const [view, setView] = useState('month');
  
  const stats = (() => {
    const allFood = { ...historyData, [todayKey()]: todayEntries };
    const groups = {};

    Object.keys(allFood).forEach(dateStr => {
      const d = new Date(dateStr + "T12:00:00");
      let key = view === 'week' ? `KW ${Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7)}` :
                view === 'quarter' ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` :
                view === 'year' ? `${d.getFullYear()}` : d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

      if (!groups[key]) groups[key] = { label: key, kcal: [], w: [], days: 0, dateObj: d };
      if (allFood[dateStr].length > 0) {
        groups[key].kcal.push(sum(allFood[dateStr], "kcal"));
        groups[key].days++;
      }
    });

    weights.forEach(w => {
      const d = new Date(w.date + "T12:00:00");
      let key = view === 'week' ? `KW ${Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7)}` :
                view === 'quarter' ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}` :
                view === 'year' ? `${d.getFullYear()}` : d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      if (groups[key]) groups[key].w.push(w);
    });

    return Object.values(groups).map(g => {
      const avgKcal = g.days > 0 ? Math.round(g.kcal.reduce((a, b) => a + b, 0) / g.days) : 0;
      let wDiff = 0;
      if (g.w.length > 1) {
        const sw = g.w.sort((a, b) => new Date(a.date) - new Date(b.date));
        wDiff = Math.round((sw[sw.length - 1].val - sw[0].val) * 10) / 10;
      }
      return { ...g, avgKcal, wDiff };
    }).sort((a, b) => b.dateObj - a.dateObj);
  })();

  return (
    <div className="space-y-6">
      <div className="flex bg-stone-100 p-1.5 rounded-2xl gap-1.5">
        {['week', 'month', 'quarter', 'year'].map(p => (
          <button key={p} onClick={() => setView(p)} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${view === p ? "bg-white shadow-sm text-stone-900" : "text-stone-400"}`}>
            {p === 'week' ? 'Woche' : p === 'month' ? 'Monat' : p === 'quarter' ? 'Quartal' : 'Jahr'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 mb-6">Energie Trend</p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...stats].slice(0, 6).reverse()}>
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 800}} axisLine={false} tickLine={false} />
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

      <div className="space-y-3 pb-10">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 border border-stone-50 flex justify-between items-center shadow-sm">
            <div>
              <div className="text-sm font-black text-stone-800">{s.label}</div>
              <div className="text-[10px] font-bold text-stone-300 uppercase">{s.count} Tage getrackt</div>
            </div>
            <div className="flex gap-5">
              <div className="text-right">
                <div className={`text-sm font-black ${s.avgKcal > goals.kcal ? 'text-red-500' : 'text-stone-900'}`}>{s.avgKcal}</div>
                <p className="text-[8px] font-black text-stone-300 uppercase">Ø kcal</p>
              </div>
              <div className="text-right min-w-[50px]">
                <div className={`text-sm font-black ${s.wDiff <= 0 ? 'text-green-600' : 'text-red-500'}`}>{s.wDiff > 0 ? `+${s.wDiff}` : s.wDiff}</div>
                <p className="text-[8px] font-black text-stone-300 uppercase">kg Δ</p>
              </div>
            </div>
          </div>
        ))}
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

  // Initiales Laden
  useEffect(() => {
    async function init() {
      const [g, f, w, hi] = await Promise.all([
        DB.get("goals"), DB.get("favs"), DB.get("weights"), DB.get("hist-index")
      ]);
      setGoals({ ...DEFAULT_GOALS, ...g });
      setFavs(f || []);
      setWeights(w || []);
      
      if (hi) {
        const hd = {};
        for (const k of hi) { 
           const d = await DB.get(`day-${k}`); 
           if (d) hd[k] = d; 
        }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  // Daten laden wenn Datum wechselt
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
    if (!hi.includes(selectedDate)) {
      const newHi = [...hi, selectedDate];
      await DB.set("hist-index", newHi);
    }
    flash(`Log für ${fmtDate(selectedDate)} ✓`);
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
    flash(`Gewicht für ${fmtDate(selectedDate)}`);
  };

  const TABS = [
    { id: "today", label: "Heute", icon: <Icon.Today /> },
    { id: "history", label: "Trends", icon: <Icon.History /> },
    { id: "weight", label: "Körper", icon: <Icon.Weight /> },
    { id: "favs", label: "Bank", icon: <Icon.Database /> },
    { id: "goals", label: "Ziele", icon: <Icon.Goal /> },
  ];

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-32 font-sans antialiased selection:bg-stone-200">
      
      {/* HEADER WITH DATE PICKER */}
      <header className="px-8 pt-16 pb-8 flex justify-between items-end max-w-lg mx-auto">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-300 mb-1">Performance Track</p>
          <h1 className="text-4xl font-black tracking-tighter text-stone-900">{TABS.find(t=>t.id===tab).label}</h1>
        </div>
        <div className="flex flex-col items-end">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-stone-100 border-none rounded-xl px-3 py-2 text-[10px] font-black text-stone-600 outline-none focus:ring-2 ring-stone-200"
          />
          {selectedDate !== todayKey() && (
            <button onClick={() => setSelectedDate(todayKey())} className="text-[9px] font-black text-amber-600 mt-2 uppercase tracking-widest animate-pulse">
              Zu Heute
            </button>
          )}
        </div>
      </header>

      <main className="px-6 max-w-lg mx-auto">
        {tab === "today" && (
          <TodayView 
            entries={entries} 
            goals={goals} 
            addEntry={addEntry} 
            removeEntry={removeEntry} 
            onStar={async(f)=>{setFavs([...favs,f]); await DB.set("favs",[...favs,f]); flash("★ Favorit");}} 
          />
        )}
        {tab === "history" && <AnalyseView historyData={histData} todayEntries={entries} weights={weights} goals={goals} activeDate={selectedDate} />}
        {tab === "weight" && <WeightView weights={weights} addWeight={addWeight} removeWeight={async(d)=>{const u=weights.filter(w=>w.date!==d); setWeights(u); await DB.set("weights",u);}} activeDate={selectedDate} />}
        {tab === "favs" && (
          <div className="space-y-3">
            {favs.length ? favs.map((f, i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-stone-50 flex justify-between items-center shadow-sm">
                <div className="min-w-0">
                  <div className="text-sm font-black truncate">{f.desc}</div>
                  <div className="text-[10px] font-bold text-stone-300 uppercase">{f.kcal} kcal | {f.prot}P | {f.carbs}C</div>
                </div>
                <button onClick={() => addEntry(f)} className="bg-stone-50 text-stone-900 text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition-all">Hinzufügen</button>
              </div>
            )) : <p className="text-center text-stone-300 py-20 text-xs font-bold uppercase tracking-widest">Keine Favoriten</p>}
          </div>
        )}
        {tab === "goals" && (
          <div className="bg-white rounded-3xl p-8 border border-stone-50 shadow-sm space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-300">Konfiguration</p>
            {Object.keys(goals).map(k => (
              <div key={k}>
                <label className="text-[10px] font-black uppercase text-stone-400 mb-2 block">{k}</label>
                <input value={goals[k]} type="number" className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none" onChange={e => { const g = {...goals, [k]: num(e.target.value)}; setGoals(g); DB.set("goals", g); }} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BOTTOM NAV BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-3xl border-t border-stone-100 px-8 pt-4 pb-10 z-50">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-1.5 transition-all ${tab === t.id ? "text-stone-900 scale-110" : "text-stone-300 hover:text-stone-400"}`}>
              <div className={`p-2.5 rounded-2xl transition-all ${tab === t.id ? "bg-stone-900 text-white shadow-xl shadow-stone-200" : ""}`}>
                {t.icon}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest transition-all ${tab === t.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-full shadow-2xl z-50 animate-in zoom-in-90 duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}
