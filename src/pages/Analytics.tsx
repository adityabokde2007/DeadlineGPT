import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  AlertCircle, 
  Download, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Calendar,
  Sparkle,
  Sun,
  Moon
} from 'lucide-react';
import Footer from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { subscribeToTasksByUser, Task } from '../services/firestoreService';

export default function Analytics() {
  const { currentUser } = useAuth();
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [compTimeRange, setCompTimeRange] = useState<'week' | 'month'>('week');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    const unsubscribe = subscribeToTasksByUser(currentUser.uid, (tasks) => {
      setUserTasks(tasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Date parsing / timezone helper
  const toLocalDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'object' && 'seconds' in dateInput) {
      return new Date(dateInput.seconds * 1000);
    }
    if (typeof dateInput === 'string') {
      return new Date(dateInput);
    }
    return null;
  };

  // --- KPI STATS CALCULATIONS ---

  // 1. Streak = consecutive days where all tasks due that day were completed
  const calculateStreak = (tasks: Task[]): number => {
    if (!tasks || tasks.length === 0) return 0;

    // Group tasks by local date YYYY-MM-DD
    const dayMap: { [dateStr: string]: { completed: number; total: number } } = {};
    
    tasks.forEach(task => {
      const d = toLocalDate(task.deadline);
      if (!d) return;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (!dayMap[dateStr]) {
        dayMap[dateStr] = { completed: 0, total: 0 };
      }
      dayMap[dateStr].total += 1;
      if (task.status === 'completed') {
        dayMap[dateStr].completed += 1;
      }
    });

    const today = new Date();
    let streak = 0;
    let foundFirstTaskDay = false;

    // Search backwards for up to 60 days
    for (let i = 0; i < 60; i++) {
      const currentCheckDate = new Date();
      currentCheckDate.setDate(today.getDate() - i);
      const year = currentCheckDate.getFullYear();
      const month = String(currentCheckDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentCheckDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayData = dayMap[dateStr];
      if (dayData) {
        foundFirstTaskDay = true;
        if (dayData.completed === dayData.total) {
          streak++;
        } else {
          // If we find a day with incomplete tasks, the streak breaks
          break;
        }
      } else {
        // If we haven't found any task day yet, we can keep looking back.
        // Once a streak has started, skip empty days (neutral) without breaking.
        if (foundFirstTaskDay) {
          continue;
        }
      }
    }
    return streak;
  };

  const streakDays = calculateStreak(userTasks);

  // 2. Completion rate = completed tasks / total tasks, for selectable time ranges (week/month)
  const getCompletionRateData = () => {
    const limitDays = compTimeRange === 'week' ? 7 : 30;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - limitDays);
    limitDate.setHours(0, 0, 0, 0);

    const rangeTasks = userTasks.filter(t => {
      const d = toLocalDate(t.deadline);
      return d && d.getTime() >= limitDate.getTime();
    });

    const total = rangeTasks.length;
    const completed = rangeTasks.filter(t => t.status === 'completed').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : null;

    return { rate, completed, total };
  };

  const { rate: completionRate, completed: rangeCompleted, total: rangeTotal } = getCompletionRateData();

  // 3. Deadlines Met percentage
  const getDeadlinesMetRate = () => {
    const now = new Date();
    const pastTasks = userTasks.filter(t => {
      const d = toLocalDate(t.deadline);
      return d && d.getTime() <= now.getTime();
    });
    const completedPastTasks = pastTasks.filter(t => t.status === 'completed');
    return pastTasks.length > 0 
      ? Math.round((completedPastTasks.length / pastTasks.length) * 100) 
      : (userTasks.length > 0 ? Math.round((userTasks.filter(t => t.status === 'completed').length / userTasks.length) * 100) : null);
  };

  const deadlinesMetRate = getDeadlinesMetRate();

  // 4. Overdue tasks
  const getOverdueTasksCount = () => {
    const now = new Date();
    return userTasks.filter(t => {
      const d = toLocalDate(t.deadline);
      return t.status !== 'completed' && d && d.getTime() < now.getTime();
    }).length;
  };

  const overdueCount = getOverdueTasksCount();

  // --- DYNAMIC CHART DATA GENERATION ---

  // Productivity trend chart = daily completed-task counts over the last 14 days
  const getLast14DaysData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayTasks = userTasks.filter(t => {
        const td = toLocalDate(t.deadline);
        if (!td) return false;
        const ty = td.getFullYear();
        const tm = String(td.getMonth() + 1).padStart(2, '0');
        const tday = String(td.getDate()).padStart(2, '0');
        return `${ty}-${tm}-${tday}` === dateStr;
      });

      const completed = dayTasks.filter(t => t.status === 'completed').length;
      const scheduled = dayTasks.length;
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      data.push({
        day: label,
        completed,
        scheduled
      });
    }
    return data;
  };

  const trendData = getLast14DaysData();
  const maxTrendVal = Math.max(...trendData.map(d => d.scheduled), 5); // Default min peak of 5 to keep layout visually stable

  // Category breakdown = task counts grouped by category field
  const getCategoryBreakdown = () => {
    const counts: { [key: string]: number } = {};
    userTasks.forEach(t => {
      const cat = t.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    let cat1 = "General";
    let count1 = 0;
    let cat2 = "Work";
    let count2 = 0;
    let cat3 = "Other";
    let count3 = 0;

    if (sorted.length > 0) {
      cat1 = sorted[0][0];
      count1 = sorted[0][1];
    }
    if (sorted.length > 1) {
      cat2 = sorted[1][0];
      count2 = sorted[1][1];
    }
    if (sorted.length > 2) {
      if (sorted.length === 3) {
        cat3 = sorted[2][0];
        count3 = sorted[2][1];
      } else {
        cat3 = "Other";
        count3 = sorted.slice(2).reduce((sum, item) => sum + item[1], 0);
      }
    }

    const total = count1 + count2 + count3;
    const p1 = total > 0 ? count1 / total : 0;
    const p2 = total > 0 ? count2 / total : 0;
    const p3 = total > 0 ? count3 / total : 0;

    const circ = 282.7;
    const offset1 = circ * (1 - p1);
    const offset2 = circ * (1 - p2);
    const offset3 = circ * (1 - p3);

    const rot2 = -90 + (p1 * 360);
    const rot3 = -90 + ((p1 + p2) * 360);

    return {
      total,
      cat1, count1, p1: Math.round(p1 * 100), offset1,
      cat2, count2, p2: Math.round(p2 * 100), offset2, rot2,
      cat3, count3, p3: Math.round(p3 * 100), offset3, rot3
    };
  };

  const catData = getCategoryBreakdown();

  // Report CSV downloader
  const downloadCSV = () => {
    if (userTasks.length === 0) {
      alert("No analytics data available to download.");
      return;
    }
    
    const lines: string[] = [];
    
    // 1. Task Completion Trends
    lines.push("Task Completion Trends");
    lines.push("Date,Scheduled Count,Completed Count");
    trendData.forEach(d => {
      lines.push(`"${d.day}",${d.scheduled},${d.completed}`);
    });
    
    lines.push(""); // Empty line separator
    
    // 2. Category Breakdown
    lines.push("Category Breakdown");
    lines.push("Category,Count,Percentage");
    if (catData.total > 0) {
      if (catData.count1 > 0) lines.push(`"${catData.cat1}",${catData.count1},${catData.p1}%`);
      if (catData.count2 > 0) lines.push(`"${catData.cat2}",${catData.count2},${catData.p2}%`);
      if (catData.count3 > 0) lines.push(`"${catData.cat3}",${catData.count3},${catData.p3}%`);
    } else {
      lines.push("No category data available,0,0%");
    }
    
    const csvString = lines.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `deadlinegpt_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-background text-on-surface flex flex-col min-h-screen pl-0 md:pl-[260px] transition-colors duration-200 justify-center items-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <p className="text-xs font-bold text-on-surface-variant tracking-wider uppercase font-mono">Loading Performance Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface flex flex-col min-h-screen pl-0 md:pl-[260px] transition-colors duration-200">
      
      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-8 py-5 border-b border-outline-variant flex justify-between items-center transition-all duration-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">Analytics</h2>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Real-time visual performance data for your workspace.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadCSV}
            className="bg-primary text-on-primary font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm h-[38px]"
          >
            <Download size={14} />
            <span>Download CSV</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-8 max-w-[1280px] w-full mx-auto space-y-12">
        
        {/* KPI Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Stat 1 */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col justify-between group shadow-sm min-h-[140px]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Active Streak</span>
              <TrendingUp size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-on-surface tracking-tight">
                {streakDays} {streakDays === 1 ? 'day' : 'days'}
              </p>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                {streakDays > 0 ? "Daily completions met!" : "Start checking off tasks!"}
              </p>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col justify-between group shadow-sm min-h-[140px]">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Completion Rate</span>
              <div className="flex bg-surface-container-high rounded p-0.5 border border-outline-variant/30 shrink-0">
                <button 
                  onClick={() => setCompTimeRange('week')} 
                  className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded cursor-pointer transition-all ${compTimeRange === 'week' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  7D
                </button>
                <button 
                  onClick={() => setCompTimeRange('month')} 
                  className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded cursor-pointer transition-all ${compTimeRange === 'month' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  30D
                </button>
              </div>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-on-surface tracking-tight">{completionRate !== null ? `${completionRate}%` : '-'}</p>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                {rangeCompleted} / {rangeTotal} tasks completed
              </p>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col justify-between group shadow-sm min-h-[140px]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Deadlines Met</span>
              <Award size={16} className="text-tertiary" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#ffb4a1] tracking-tight">{deadlinesMetRate !== null ? `${deadlinesMetRate}%` : '-'}</p>
              <p className="text-xs text-on-surface-variant font-medium mt-1">On-time milestone completions</p>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col justify-between group shadow-sm min-h-[140px]">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Tasks Overdue</span>
              <AlertCircle size={16} className="text-error" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-error tracking-tight">{overdueCount}</p>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                {overdueCount > 0 ? "Immediate attention required" : "All clear, no overdue tasks!"}
              </p>
            </div>
          </div>

        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Task Completion Bar Chart (8 Columns) */}
          <div className="lg:col-span-8 bg-surface-container p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col">
            <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase mb-8">Task Completion Trends (Last 14 Days)</h3>
            
            {/* SVG Interactive Chart Canvas */}
            <div className="flex-1 relative min-h-[240px] flex items-end justify-between px-2 pb-2 pt-6 select-none overflow-x-auto gap-2">
              
              {/* Backgrid horizontal lines */}
              <div className="absolute inset-x-0 top-6 bottom-8 border-t border-b border-dashed border-outline-variant/20 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-t border-dashed border-outline-variant/20 h-0"></div>
                <div className="w-full border-t border-dashed border-outline-variant/20 h-0"></div>
              </div>

              {trendData.map((d, index) => {
                const completedPct = maxTrendVal > 0 ? (d.completed / maxTrendVal) * 100 : 0;
                const scheduledPct = maxTrendVal > 0 ? (d.scheduled / maxTrendVal) * 100 : 0;

                return (
                  <div 
                    key={index} 
                    className="flex-1 min-w-[28px] flex flex-col items-center h-full relative cursor-pointer group"
                    onMouseEnter={() => setHoveredBar(index)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    
                    {/* Tooltip on hover */}
                    {hoveredBar === index && (
                      <div className="absolute top-[-36px] bg-secondary-container text-on-secondary-container px-2.5 py-1.5 rounded text-[10px] font-semibold border border-outline shadow-md z-10 flex flex-col whitespace-nowrap min-w-[100px]">
                        <span>Done: {d.completed} Tasks</span>
                        <span className="opacity-75">Scheduled: {d.scheduled}</span>
                      </div>
                    )}

                    <div className="w-full h-full flex items-end justify-center relative min-h-[160px] gap-0.5">
                      {/* Scheduled Column */}
                      <div 
                        style={{ height: `${scheduledPct}%` }} 
                        className="w-1/2 bg-surface-container-high border border-outline-variant/20 rounded-t-sm group-hover:opacity-80 transition-all"
                      ></div>
                      {/* Completed Column */}
                      <div 
                        style={{ height: `${completedPct}%` }} 
                        className="w-1/2 bg-primary rounded-t-sm group-hover:brightness-110 transition-all shadow-sm"
                      ></div>
                    </div>
                    
                    <span className="text-[10px] font-bold text-on-surface-variant mt-3 uppercase tracking-tight text-center truncate w-full">
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Chart Legend */}
            <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-outline-variant/30 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-surface-container-high border border-outline-variant/20 rounded-sm"></div>
                <span>Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-primary rounded-sm"></div>
                <span>Completed</span>
              </div>
            </div>

          </div>

          {/* Doughnut distribution Mix Chart (4 Columns) */}
          <div className="lg:col-span-4 bg-surface-container p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase mb-6">Category Breakdown</h3>
            
            <div className="relative flex items-center justify-center p-4">
              {/* Doughnut SVG representation */}
              <svg className="w-48 h-48 transform -rotate-90">
                {catData.total > 0 ? (
                  <>
                    {/* Category 1 Slice */}
                    {catData.count1 > 0 && (
                      <circle 
                        className="text-primary" 
                        cx="96" cy="96" fill="transparent" r="45" stroke="currentColor" strokeWidth="8"
                        strokeDasharray="282.7"
                        strokeDashoffset={catData.offset1}
                      ></circle>
                    )}
                    {/* Category 2 Slice */}
                    {catData.count2 > 0 && (
                      <circle 
                        className="text-secondary" 
                        cx="96" cy="96" fill="transparent" r="45" stroke="currentColor" strokeWidth="8"
                        strokeDasharray="282.7"
                        strokeDashoffset={catData.offset2}
                        style={{ transform: `rotate(${catData.rot2}deg)`, transformOrigin: '96px 96px' }}
                      ></circle>
                    )}
                    {/* Category 3 Slice */}
                    {catData.count3 > 0 && (
                      <circle 
                        className="text-surface-variant" 
                        cx="96" cy="96" fill="transparent" r="45" stroke="currentColor" strokeWidth="8"
                        strokeDasharray="282.7"
                        strokeDashoffset={catData.offset3}
                        style={{ transform: `rotate(${catData.rot3}deg)`, transformOrigin: '96px 96px' }}
                      ></circle>
                    )}
                  </>
                ) : (
                  /* Gray placeholder circle if no categories exist */
                  <circle 
                    className="text-outline-variant/30" 
                    cx="96" cy="96" fill="transparent" r="45" stroke="currentColor" strokeWidth="8"
                    strokeDasharray="282.7"
                    strokeDashoffset="0"
                  ></circle>
                )}
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-on-surface">{catData.total}</span>
                <span className="text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">Total Tasks</span>
              </div>
            </div>

            {/* Breakdown Tags list */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
                  <span>{catData.cat1}</span>
                </div>
                <span>{catData.total > 0 ? `${catData.p1}%` : '0%'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-secondary rounded-full"></div>
                  <span>{catData.cat2}</span>
                </div>
                <span>{catData.total > 0 ? `${catData.p2}%` : '0%'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-surface-variant rounded-full"></div>
                  <span>{catData.cat3}</span>
                </div>
                <span>{catData.total > 0 ? `${catData.p3}%` : '0%'}</span>
              </div>
            </div>

          </div>

        </section>

        <Footer />
      </div>

    </div>
  );
}
