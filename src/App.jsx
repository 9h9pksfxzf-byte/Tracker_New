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

// ─── ICONS (SVG Components) ──────────────────────────────────────────────────
const Icon = {
  Today: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  History: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>,
  Weight: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m11 2 9 22"/><path d="m13 2-9 22"/><path d="M2 2h20"/></svg>,
  Database: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>,
  Goal: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
};

// ─── VIEW: ANALYSE (GRUPPIERT NACH ZEITRÄUMEN) ──────────────────────────────
function AnalyseView({ historyData, todayEntries, weights, goals }) {
  const [view, setView] = useState('month');
  
  const groupAllData = (hData, tEntries, wData, period) => {
    const allFood = { ...hData, [todayKey()]: tEntries };
    const groups = {};

    Object.keys(allFood).forEach(dateStr => {
      const d = new Date(dateStr + "T12:00:00");
      let key;
      if (period === 'week') {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
        key = `KW ${week} ${d.getFullYear()}`;
      } else if (period === 'quarter') {
        key = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      } else if (period === 'year') {
        key = `${d.getFullYear()}`;
      } else {
        key = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      }

      if (!groups[key]) groups[key] = { label: key, kcal: [], w: [], days: 0, dateObj: d };
      const day = allFood[dateStr];
      if (day.length > 0) {
        groups[key].kcal.push(sum(day, "kcal"));
        groups[key].days++;
      }
    });

    wData.forEach(w => {
      const d = new Date(w.date + "T12:00:00");
      let key;
      if (period === 'week') {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
        key = `KW ${week} ${d.getFullYear()}`;
      } else if (period === 'quarter') {
        key = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      } else if (period === 'year') {
        key = `${d.getFullYear()}`;
      } else {
        key = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      }
      if (groups[key]) groups[key].w.push({ date: w.date, val: w.val });
    });

    return Object.values(groups).map(g => {
      const avgKcal = g.days > 0 ? Math.round(g.kcal.reduce((a, b) => a + b, 0) / g.days) : 0;
      let wDiff = 0;
      if (g.w.length > 1) {
        const sortedW = g.w.sort((a, b) => new Date(a.date) - new Date(b.date));
        wDiff = Math.round((sortedW[sortedW.length - 1].val - sortedW[0].val) * 10) / 10;
      }
      return { label: g.label, avgKcal, wDiff, count: g.days, dateObj: g.dateObj };
    }).sort((a, b) => b.dateObj - a.dateObj);
  };

  const stats = groupAllData(historyData, todayEntries, weights, view);

  return (
    <div className="space-y-6">
      <div className="flex bg-stone-100 p-1 rounded-2xl gap-1">
        {['week', 'month', 'quarter', 'year'].map(p => (
          <button key={p} onClick={() => setView(p)}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${view === p ? "bg-white shadow-sm text-stone-900" : "text-stone-400"}`}>
            {p === 'week' ? 'Woche' : p === 'month' ? 'Monat' : p === 'quarter' ? 'Quartal' : 'Jahr'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300 mb-6">Energie Trend (Ø kcal)</p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...stats].slice(0, 6).reverse()}>
              <XAxis dataKey="label" tick={{fontSize: 9, fill: '#d6d3d1', fontWeight: 600}} axisLine={false} tickLine={false} />
              <ReferenceLine y={goals.kcal} stroke="#fca5a5" strokeDasharray="4 4" />
              <Bar dataKey="avgKcal" radius={[6, 6, 6, 6]} barSize={32}>
                {[...stats].slice(0, 6).reverse().map((entry, index) => (
                  <Cell key={index} fill={entry.avgKcal > goals.kcal ? "#f87171" : "#1c1c1e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-stone-100 flex justify-between items-center shadow-sm">
            <div className="space-y-1">
              <div className="text-sm font-black text-stone-800">{s.label}</div>
              <div className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full inline-block">{s.count} Tage</div>
            </div>
            <div className="flex gap-6 items-center">
              <div className="text-right">
                <div className={`text-sm font-black ${s.avgKcal > goals.kcal ? 'text-red-500' : 'text-stone-900'}`}>{s.avgKcal}</div>
                <p className="text-[9px] font-bold text-stone-300 uppercase tracking-widest">Ø kcal</p>
              </div>
              <div className="text-right min-w-[60px]">
                <div className={`text-sm font-black ${s.wDiff <= 0 ? 'text-green-600' : 'text-red-500'}`}>{s.wDiff > 0 ? `+${s.wDiff}` : s.wDiff}</div>
                <p className="text-[9px] font-bold text-stone-300 uppercase tracking-widest">kg Δ</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// (Restliche Views: TodayView, WeightView, FavsView, GoalsView - analog zu vorherigen Versionen)

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [favs, setFavs] = useState([]);
  const [weights, setWeights] = useState([]);
  const [histData, setHistData] = useState({});
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function init() {
      const today = todayKey();
      const [e, g, f, w, hi] = await Promise.all([
        DB.get(`day-${today}`), DB.get("goals"), DB.get("favs"), DB.get("weights"), DB.get("hist-index")
      ]);
      
      setEntries(e || []);
      setGoals({ ...DEFAULT_GOALS, ...g });
      setFavs(f || []);
      setWeights(w || []);
      
      if (hi) {
        const hd = {};
        for (const k of hi) { if (k !== today) { const d = await DB.get(`day-${k}`); if (d) hd[k] = d; } }
        setHistData(hd);
      }
      setReady(true);
    }
    init();
  }, []);

  const TABS = [
    { id: "today", label: "Heute", icon: <Icon.Today /> },
    { id: "history", label: "Trends", icon: <Icon.History /> },
    { id: "weight", label: "Gewicht", icon: <Icon.Weight /> },
    { id: "favs", label: "Bank", icon: <Icon.Database /> },
    { id: "goals", label: "Ziele", icon: <Icon.Goal /> },
  ];

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#fafaf8] text-stone-900 pb-28 font-sans antialiased">
      <header className="px-6 pt-12 pb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-1">Performance Hub</p>
        <h1 className="text-4xl font-black tracking-tight">{TABS.find(t=>t.id===tab).label}</h1>
      </header>

      <main className="px-6">
        {tab === "today" && <TodayView entries={entries} goals={goals} addEntry={async(i)=>{const u=[...entries,i]; setEntries(u); await DB.set(`day-${todayKey()}`,u);}} removeEntry={async(i)=>{const u=entries.filter((_,x)=>x!==i); setEntries(u); await DB.set(`day-${todayKey()}`,u);}} onStar={async(f)=>{setFavs([...favs,f]); await DB.set("favs",[...favs,f]);}} />}
        {tab === "history" && <AnalyseView historyData={histData} todayEntries={entries} weights={weights} goals={goals} />}
        {tab === "weight" && <WeightView weights={weights} addWeight={async(v)=>{const u=[...weights.filter(w=>w.date!==todayKey()),{date:todayKey(),val:v}]; setWeights(u); await DB.set("weights",u);}} removeWeight={async(d)=>{const u=weights.filter(w=>w.date!==d); setWeights(u); await DB.set("weights",u);}} />}
        {/* ... Favs & Goals Views ... */}
      </main>

      {/* FIXED NAVIGATION WITH ICONS */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-stone-100 px-6 pt-3 pb-8 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1.5 transition-all ${tab === t.id ? "text-stone-900 scale-110" : "text-stone-300"}`}>
              <div className={`${tab === t.id ? "bg-stone-900 text-white p-2.5 rounded-2xl shadow-lg" : ""}`}>
                {t.icon}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-tighter ${tab === t.id ? "opacity-100" : "opacity-0"}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
