import { useState, useEffect } from 'react';
import { fetchMasterData, generateTimetable, fetchWeeks, fetchWeek, fetchFortnightCoverageById, fetchFortnights, updateEntry, deleteWeek } from './api';
import { format, parseISO } from 'date-fns';
import { Calendar, Users, FileSpreadsheet, Plus, AlertTriangle, CheckCircle, Trash2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import clsx from 'clsx';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'batch' | 'teacher'>('batch');
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [weeks, setWeeks] = useState<any[]>([]);
  const [fortnights, setFortnights] = useState<any[]>([]);
  
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<any>(null);
  
  const [activeFortnightId, setActiveFortnightId] = useState<number | null>(null);
  const [coverage, setCoverage] = useState<any>(null);
  
  // Form State
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [adHocHolidays, setAdHocHolidays] = useState<{ teacherId: number; date: string }[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<number | null>(null);

  useEffect(() => {
    loadInit();
  }, []);

  useEffect(() => {
    if (selectedWeekId) {
      loadWeek(selectedWeekId);
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (activeFortnightId) {
      fetchFortnightCoverageById(activeFortnightId).then(setCoverage).catch(e => console.error(e));
    } else {
      setCoverage(null);
    }
  }, [activeFortnightId]);

  const loadInit = async () => {
    try {
      const md = await fetchMasterData();
      setData(md);
      
      const ws = await fetchWeeks();
      setWeeks(ws);
      
      const fns = await fetchFortnights();
      setFortnights(fns.filter((f: any) => f.weeks && f.weeks.length > 0));

      if (ws.length > 0 && !selectedWeekId) {
        setSelectedWeekId(ws[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load data');
    }
  };

  const loadWeek = async (id: number) => {
    const w = await fetchWeek(id);
    setCurrentWeek(w);
    if (w.fortnightId && w.fortnightId !== activeFortnightId) {
      setActiveFortnightId(w.fortnightId);
    }
    // If the active fortnight is already correct, we still need to refresh its data
    if (w.fortnightId === activeFortnightId) {
      const cov = await fetchFortnightCoverageById(w.fortnightId);
      setCoverage(cov);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const t = document.getElementById('adHocTeacher') as HTMLSelectElement;
      const d = document.getElementById('adHocDate') as HTMLInputElement;
      
      let finalHolidays = [...adHocHolidays];
      if (t && d && t.value && d.value) {
        if (!finalHolidays.some(h => h.teacherId === Number(t.value) && h.date === d.value)) {
           finalHolidays.push({ teacherId: Number(t.value), date: d.value });
        }
      }

      const w = await generateTimetable(startDate, finalHolidays);
      await loadInit();
      setSelectedWeekId(w.id);
      await loadWeek(w.id); // Force reload since ID might not have changed
      
      // Update state to include any auto-added holiday so it stays visible
      setAdHocHolidays(finalHolidays);
      if (d) d.value = ''; // clear input so it doesn't carry over to next gen
    } catch (e) {
      alert("Error generating timetable");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateEntry = async (entryId: number, subjectId: number | null, teacherId: number | null, unresolved: boolean) => {
    try {
      await updateEntry(entryId, { subjectId, teacherId, unresolved });
      setEditingEntryId(null);
      if (selectedWeekId) await loadWeek(selectedWeekId);
    } catch (e: any) {
      alert("Failed to update: " + e.message);
    }
  };

  const handleDeleteWeek = async (id: number) => {
    try {
      await deleteWeek(id);
      if (selectedWeekId === id) {
        setSelectedWeekId(null);
        setCurrentWeek(null);
        setActiveFortnightId(null);
      }
      await loadInit();
    } catch (e: any) {
      alert("Failed to delete week: " + e.message);
    }
  };

  const exportExcel = async () => {
    if (!currentWeek || !data) return;
    const wb = new ExcelJS.Workbook();
    
    // Batch Sheet
    const wsBatch = wb.addWorksheet('Batches');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    wsBatch.columns = [
      { header: 'Batch', key: 'batch', width: 20 },
      ...days.map(d => ({ header: d, key: d.toLowerCase(), width: 25 }))
    ];

    data.batches.forEach((b: any) => {
      const row: any = { batch: b.name };
      days.forEach(d => {
        const entry = currentWeek.entries.find((e: any) => e.batchId === b.id && e.day === d);
        if (entry) {
          row[d.toLowerCase()] = entry.unresolved 
            ? 'UNRESOLVED' 
            : `${entry.subject?.name || ''} (${entry.teacher?.name || ''})`;
        }
      });
      wsBatch.addRow(row);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Timetable_${format(parseISO(currentWeek.weekStartDate), 'yyyy-MM-dd')}.xlsx`;
    link.click();
  };
  
  // Navigation for fortnights
  const handlePrevFortnight = () => {
    if (!activeFortnightId || fortnights.length === 0) return;
    const currentIndex = fortnights.findIndex(f => f.id === activeFortnightId);
    if (currentIndex < fortnights.length - 1) {
      setActiveFortnightId(fortnights[currentIndex + 1].id);
    }
  };

  const handleNextFortnight = () => {
    if (!activeFortnightId || fortnights.length === 0) return;
    const currentIndex = fortnights.findIndex(f => f.id === activeFortnightId);
    if (currentIndex > 0) {
      setActiveFortnightId(fortnights[currentIndex - 1].id);
    }
  };

  const handleAddHoliday = async () => {
    const t = document.getElementById('adHocTeacher') as HTMLSelectElement;
    const d = document.getElementById('adHocDate') as HTMLInputElement;
    if (t.value && d.value) {
      const newHols = [...adHocHolidays];
      if (!newHols.some(h => h.teacherId === Number(t.value) && h.date === d.value)) {
        newHols.push({ teacherId: Number(t.value), date: d.value });
      }
      setAdHocHolidays(newHols);
      
      setIsGenerating(true);
      try {
        const targetStartDate = currentWeek ? format(new Date(currentWeek.weekStartDate), 'yyyy-MM-dd') : startDate;
        const w = await generateTimetable(targetStartDate, newHols);
        await loadInit();
        setSelectedWeekId(w.id);
        await loadWeek(w.id); // Force reload since ID might not have changed
        if (d) d.value = ''; 
      } catch(e) {
        alert("Error applying holiday");
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const activeFortnight = fortnights.find(f => f.id === activeFortnightId);

  if (errorMsg) return <div className="p-8 text-red-400 flex flex-col items-center justify-center min-h-screen bg-neutral-950"><AlertTriangle className="w-12 h-12 mb-4" />{errorMsg}</div>;
  if (!data) return <div className="p-8 text-white flex items-center justify-center min-h-screen bg-neutral-950">Loading data...</div>;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-indigo-500/30">
      <header className="bg-neutral-900/50 border-b border-neutral-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-indigo-400">
            <Calendar className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wide">GRADWISE<span className="text-neutral-400 font-light"> Scheduler</span></h1>
          </div>
          {currentWeek && (
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-8">
        
        {/* Sidebar Controls */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <div className="bg-neutral-900/40 rounded-xl p-5 border border-neutral-800/50 shadow-lg">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" /> Generate / Update
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Week Start (Monday)</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Ad-Hoc Holidays</label>
                <div className="flex gap-2 mb-2">
                  <select id="adHocTeacher" className="flex-1 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    {data.teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input id="adHocDate" type="date" className="w-32 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <button 
                    onClick={handleAddHoliday}
                    className="px-3 bg-neutral-700 hover:bg-neutral-600 rounded-md transition-colors"
                  >+</button>
                </div>
                {adHocHolidays.length > 0 && (
                  <ul className="text-xs space-y-1 mt-2">
                    {adHocHolidays.map((h, i) => (
                      <li key={i} className="flex justify-between items-center bg-neutral-800/50 px-2 py-1 rounded text-neutral-400">
                        <span>{data.teachers.find((t:any) => t.id === h.teacherId)?.name}</span>
                        <span>{h.date}</span>
                        <button onClick={() => setAdHocHolidays(adHocHolidays.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 px-1">&times;</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-md text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? 'Working...' : 'Generate Week'}
              </button>
            </div>
          </div>

          <div className="bg-neutral-900/40 rounded-xl p-5 border border-neutral-800/50 shadow-lg">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4">Past Weeks</h2>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {weeks.map(w => (
                <div key={w.id} className="relative group">
                  <button
                    onClick={() => setSelectedWeekId(w.id)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm rounded-md transition-all flex justify-between items-center pr-8",
                      selectedWeekId === w.id 
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                        : "text-neutral-400 hover:bg-neutral-800"
                    )}
                  >
                    <span>{format(parseISO(w.weekStartDate), 'MMM d, yyyy')}</span>
                    <span className="text-[10px] uppercase bg-neutral-800 px-1.5 py-0.5 rounded">FW {w.positionInFortnight}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setMenuOpenFor(menuOpenFor === w.id ? null : w.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpenFor === w.id && (
                    <div className="absolute right-2 top-full mt-1 w-32 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-50 overflow-hidden">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this week?')) {
                            await handleDeleteWeek(w.id);
                            setMenuOpenFor(null);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-neutral-700 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Grid View */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {currentWeek ? (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
              <div className="border-b border-neutral-800 bg-neutral-900 p-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Week of {format(parseISO(currentWeek.weekStartDate), 'MMMM do, yyyy')}
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">Fortnight Position: Week {currentWeek.positionInFortnight}</p>
                </div>
                <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <button 
                    onClick={() => setActiveTab('batch')}
                    className={clsx("px-4 py-1.5 text-sm rounded-md transition-all", activeTab === 'batch' ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white")}
                  >
                    By Batch
                  </button>
                  <button 
                    onClick={() => setActiveTab('teacher')}
                    className={clsx("px-4 py-1.5 text-sm rounded-md transition-all", activeTab === 'teacher' ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white")}
                  >
                    By Teacher
                  </button>
                </div>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950/50 text-neutral-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-semibold border-b border-r border-neutral-800 w-48 sticky left-0 z-10 bg-neutral-950">{activeTab === 'batch' ? 'Batch / Slot' : 'Teacher'}</th>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
                        const entryForDay = currentWeek.entries.find((e: any) => e.day === d);
                        const dateStr = entryForDay ? format(new Date(entryForDay.date), 'MMM d') : '';
                        return (
                          <th key={d} className="p-4 font-semibold border-b border-neutral-800 min-w-[150px]">
                            {d} {dateStr && <span className="text-xs text-neutral-500 font-normal ml-1">({dateStr})</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-neutral-800">
                    {activeTab === 'batch' 
                      ? data.batches.map((b: any) => (
                          <tr key={b.id} className="hover:bg-neutral-800/30 transition-colors group">
                            <td className="p-4 border-r border-neutral-800 sticky left-0 bg-neutral-900 group-hover:bg-neutral-800/80 transition-colors">
                              <div className="font-medium text-white">{b.name}</div>
                              <div className="text-[10px] text-neutral-500 mt-1">{b.slotStart} - {b.slotEnd}</div>
                            </td>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
                              const entry = currentWeek.entries.find((e: any) => e.batchId === b.id && e.day === d);
                              if (!entry) return <td key={d} className="p-4"></td>;
                              
                              const isEditing = editingEntryId === entry.id;
                              
                              return (
                                <td key={d} className="p-2 align-top relative">
                                  {isEditing ? (
                                    <div className="bg-neutral-900 border border-indigo-500 rounded p-2 z-20 relative shadow-xl min-w-[180px]">
                                      <select 
                                        className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded p-1.5 mb-2 text-white outline-none"
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === 'unresolved') {
                                            handleUpdateEntry(entry.id, null, null, true);
                                          } else {
                                            const [sId, tId] = val.split('-');
                                            handleUpdateEntry(entry.id, Number(sId), Number(tId), false);
                                          }
                                        }}
                                        defaultValue={entry.unresolved ? 'unresolved' : `${entry.subjectId}-${entry.teacherId}`}
                                      >
                                        <option value="unresolved">Unresolved (Leave Empty)</option>
                                        {data.mappings.filter((m: any) => m.batchId === b.id).map((m: any) => (
                                          <option key={m.id} value={`${m.subjectId}-${m.teacherId}`}>
                                            {m.subject.name} - {m.teacher.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button onClick={() => setEditingEntryId(null)} className="w-full text-[10px] text-neutral-400 hover:text-white text-center py-1 bg-neutral-800 rounded">Cancel</button>
                                    </div>
                                  ) : entry.unresolved ? (
                                    <div onClick={() => setEditingEntryId(entry.id)} className="bg-red-500/10 border border-red-500/20 text-red-400 rounded p-2 h-full flex items-center gap-2 cursor-pointer hover:bg-red-500/20 transition-all">
                                      <AlertTriangle className="w-4 h-4 shrink-0" />
                                      <span className="text-xs font-medium">Unresolved</span>
                                    </div>
                                  ) : (
                                    <div onClick={() => setEditingEntryId(entry.id)} className="bg-neutral-950 border border-neutral-800 rounded p-2 h-full shadow-sm hover:border-indigo-500/50 transition-all group/cell cursor-pointer relative">
                                      <div className="font-semibold text-indigo-300 text-xs truncate" title={entry.subject?.name}>{entry.subject?.name}</div>
                                      <div className="text-xs text-neutral-400 mt-0.5 truncate flex items-center gap-1" title={entry.teacher?.name}>
                                        <Users className="w-3 h-3" /> {entry.teacher?.name}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      : data.teachers.map((t: any) => (
                          <tr key={t.id} className="hover:bg-neutral-800/30 transition-colors group">
                            <td className="p-4 border-r border-neutral-800 sticky left-0 bg-neutral-900 group-hover:bg-neutral-800/80 transition-colors">
                              <div className="font-medium text-white">{t.name}</div>
                            </td>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
                              const entriesForTeacher = currentWeek.entries.filter((e: any) => e.teacherId === t.id && e.day === d);
                              return (
                                <td key={d} className="p-2 align-top">
                                  {entriesForTeacher.length > 0 ? (
                                    <div className="space-y-1">
                                      {entriesForTeacher.map((entry: any, i: number) => (
                                         <div key={i} className="bg-neutral-950 border border-neutral-800 rounded p-2 text-xs">
                                           <div className="font-semibold text-emerald-400">{entry.batch?.name}</div>
                                           <div className="text-neutral-500">{entry.subject?.name}</div>
                                         </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
             <div className="h-64 border-2 border-dashed border-neutral-800 rounded-xl flex items-center justify-center text-neutral-500">
               Select or generate a week to view timetable
             </div>
          )}

          {/* Coverage Report */}
          {activeFortnight && coverage && activeTab === 'batch' && (
            <div className="bg-neutral-900/40 rounded-xl p-5 border border-neutral-800/50 shadow-lg relative">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" /> Fortnight Coverage Report
                </h2>
                
                <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-lg">
                  <button onClick={handlePrevFortnight} disabled={fortnights.findIndex(f => f.id === activeFortnightId) === fortnights.length - 1} className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 disabled:hover:text-neutral-400 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-xs font-semibold text-neutral-300 w-32 text-center">
                    {format(parseISO(activeFortnight.startDate), 'MMM d')} - {format(parseISO(activeFortnight.endDate), 'MMM d, yy')}
                  </div>
                  <button onClick={handleNextFortnight} disabled={fortnights.findIndex(f => f.id === activeFortnightId) === 0} className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 disabled:hover:text-neutral-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.batches.map((b: any) => {
                  const mappings = data.mappings.filter((m: any) => m.batchId === b.id);
                  return (
                    <div key={b.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                      <div className="font-semibold text-sm text-indigo-400 mb-2 border-b border-neutral-800 pb-1">{b.name}</div>
                      <div className="space-y-1.5">
                        {mappings.map((m: any) => {
                          const count = coverage[b.id]?.[m.subjectId] || 0;
                          const min = m.subject?.type === 'language' ? 1 : 2;
                          const max = 3;
                          const isShortfall = count < min;
                          return (
                            <div key={m.id} className="flex justify-between items-center text-xs">
                              <span className="text-neutral-400 truncate w-24" title={m.subject?.name}>{m.subject?.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  "px-1.5 py-0.5 rounded font-medium",
                                  isShortfall ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                                )}>
                                  {count} / {min}-{max}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
