import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer, LineChart, Line, YAxis } from "recharts";

// ─── MINIMAL STORAGE ────────────────────────────────────────────────────────
const DB = {
  get: (key) => JSON.parse(localStorage.getItem(key) || "null"),
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

export default function App() {
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState([]);
  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState([]);

  // Daten beim Start laden
  useEffect(() => {
    const savedEntries = DB.get("today-entries") || [];
    const savedHistory = DB.get("weight-history") || [];
    setEntries(savedEntries);
    setHistory(savedHistory);
  }, []);

  // Hilfsfunktion zum Summieren
  const totalKcal = entries.reduce((acc, curr) => acc + Number(curr.kcal || 0), 0);

  const addEntry = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newEntry = {
      desc: formData.get("desc"),
      kcal: formData.get("kcal"),
      id: Date.now()
    };
    const updated = [...entries, newEntry];
    setEntries(updated);
    DB.set("today-entries", updated);
    e.target.reset();
  };

  const addWeight = () => {
    if(!weight) return;
    const newHistory = [...history, { date: new Date().toLocaleDateString(), val: Number(weight) }];
    setHistory(newHistory);
    DB.set("weight-history", newHistory);
    setWeight("");
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter">TRACKER</h1>
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Status: Online</p>
      </header>

      {/* Navigation */}
      <nav className="flex gap-4 mb-8">
        {["today", "weight"].map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === t ? 'bg-stone-900 text-white' : 'bg-white text-stone-400'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "today" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <p className="text-[10px] font-black uppercase text-stone-300 mb-1">Energie Heute</p>
            <div className="text-4xl font-black">{totalKcal} <span className="text-sm text-stone-300">kcal</span></div>
          </div>

          <form onSubmit={addEntry} className="grid gap-2">
            <input name="desc" placeholder="Was hast du gegessen?" className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-sm" required />
            <div className="flex gap-2">
              <input name="kcal" type="number" placeholder="kcal" className="w-1/3 p-4 rounded-2xl bg-white border-none shadow-sm text-sm font-bold" required />
              <button type="submit" className="flex-1 bg-stone-900 text-white rounded-2xl font-black uppercase text-xs">Hinzufügen</button>
            </div>
          </form>

          <div className="space-y-2">
            {entries.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                <span className="text-sm font-bold">{item.desc}</span>
                <span className="text-xs font-black text-stone-400">{item.kcal} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "weight" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <div className="flex gap-2 mb-6">
              <input 
                value={weight} 
                onChange={e => setWeight(e.target.value)} 
                type="number" 
                placeholder="kg" 
                className="w-1/2 p-4 rounded-2xl bg-stone-50 border-none text-sm font-bold" 
              />
              <button onClick={addWeight} className="flex-1 bg-stone-900 text-white rounded-2xl font-black uppercase text-xs">Log Weight</button>
            </div>
            
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <LineChart data={history}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                  <Line type="monotone" dataKey="val" stroke="#1c1c1e" strokeWidth={3} dot={{r: 4, fill: '#1c1c1e'}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
