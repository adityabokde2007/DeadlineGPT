import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Bell, 
  MapPin, 
  Clock, 
  Users, 
  RefreshCcw,
  Sparkles,
  Sun,
  Moon,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import Footer from '../components/Footer';
import TaskBreakdownModal from '../components/TaskBreakdownModal';
import { useAuth } from '../hooks/useAuth';
import { subscribeToScheduleByUser, subscribeToTasksByUser, subscribeToUserPrefs, saveUserPrefs, UserPrefs, ScheduleItem, Task, createTask } from '../services/firestoreService';
import toast from 'react-hot-toast';
import { database } from '../firebase/config';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const daysOfWeekNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 8;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  return h + m / 60;
}

function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mFormatted = m < 10 ? `0${m}` : m;
  return `${h}:${mFormatted} ${ampm}`;
}

export default function CalendarView() {
  const { currentUser, googleAccessToken, userPrefs, connectGoogleCalendar } = useAuth();
  
  const [selectedTag, setSelectedTag] = useState({
    main: true,
    meetings: true,
    personal: true
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);

  // AI Breakdown states
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null);
  const [breakdownLoadingTask, setBreakdownLoadingTask] = useState<string | null>(null);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<{title: string, estimatedMinutes: number}[]>([]);
  const [isGeneratingBreakdown, setIsGeneratingBreakdown] = useState(false);
  const [isAddingSubtasks, setIsAddingSubtasks] = useState(false);

  const generateBreakdown = async (task: Task) => {
    setIsGeneratingBreakdown(true);
    setGeneratedSubtasks([]);
    
    try {
      const response = await fetch('/api/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskTitle: task.title, 
          dueDate: task.deadline ? (task.deadline as any).toString() : null, // quick format
          priority: task.priority,
          estimatedMinutes: task.estimatedEffort
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate breakdown');
      
      const data = await response.json();
      setGeneratedSubtasks(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Couldn't generate breakdown, please try again");
    } finally {
      setIsGeneratingBreakdown(false);
      setBreakdownLoadingTask(null);
    }
  };

  const handleBreakdownTask = (taskId: string) => {
    const task = userTasks.find(t => t.id === taskId);
    if (!task) return;
    setBreakdownTask(task);
    setBreakdownLoadingTask(task.id!);
    setBreakdownModalOpen(true);
    generateBreakdown(task);
  };

  const handleAddSubtasks = async (subtasks: {title: string, estimatedMinutes: number}[]) => {
    if (!breakdownTask || !currentUser) return;
    setIsAddingSubtasks(true);
    try {
      for (const st of subtasks) {
        await createTask(currentUser.uid, {
          title: st.title,
          description: `Subtask of: ${breakdownTask.title}`,
          deadline: breakdownTask.deadline,
          estimatedEffort: st.estimatedMinutes,
          priority: breakdownTask.priority,
          category: breakdownTask.category,
          status: 'pending',
          subtasks: [],
          parentTaskId: breakdownTask.id
        });
      }
      toast.success("Subtasks added successfully");
      setBreakdownModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add subtasks");
    } finally {
      setIsAddingSubtasks(false);
    }
  };

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

  const isOverdue = (taskId: string) => {
    const task = userTasks.find(t => t.id === taskId);
    if (!task) return false;
    if (task.status === 'completed' || task.parentTaskId) return false;

    // Check if task has any schedule items that end in the future
    const taskSchedules = scheduleItems.filter(s => s.taskId === task.id);
    if (taskSchedules.length > 0) {
      const latestScheduleTime = Math.max(...taskSchedules.map(s => {
        return new Date(`${s.date}T${s.endTime}`).getTime();
      }));
      // If the latest schedule time is in the future, it's not overdue
      if (latestScheduleTime >= Date.now()) return false;
    }

    const d = toLocalDate(task.deadline);
    if (!d) return false;
    return d.getTime() < Date.now();
  };

  const [now, setNow] = useState<Date>(new Date());

  const hours = [
    '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM', 
    '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', 
    '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
  ];

  // Sync current time indicator every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real schedule and tasks from Firestore
  useEffect(() => {
    if (!currentUser) return;
    
    setLoading(true);

    const unsubscribeScheds = subscribeToScheduleByUser(currentUser.uid, (scheds) => {
      setScheduleItems(scheds || []);
    });

    const unsubscribeTasks = subscribeToTasksByUser(currentUser.uid, (tasks) => {
      setUserTasks(tasks || []);
      setLoading(false);
    });

    return () => {
      unsubscribeScheds();
      unsubscribeTasks();
    };
  }, [currentUser]);

  const handleToggle = (key: 'main' | 'meetings' | 'personal') => {
    setSelectedTag({ ...selectedTag, [key]: !selectedTag[key] });
  };

  const toggleGoogleSync = async () => {
    if (!currentUser) return;
    const currentSync = userPrefs?.googleCalendarSync ?? true;
    const updatedPrefs = { 
      ...(userPrefs || {}), 
      googleCalendarSync: !currentSync 
    } as UserPrefs;
    
    try {
      await saveUserPrefs(currentUser.uid, updatedPrefs);
      toast.success(`Google Calendar Sync ${!currentSync ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.error("Failed to toggle Google Sync:", error);
      toast.error("Failed to update sync settings");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Date helper calculations
  const getMonday = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const monday = getMonday(currentDate);
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const getYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getEventCategory = (item: ScheduleItem): 'main' | 'meetings' | 'personal' => {
    const task = userTasks.find(t => t.id === item.taskId);
    if (task && task.category) {
      const cat = task.category.toLowerCase();
      if (cat.includes('meet') || cat.includes('call') || cat.includes('review')) {
        return 'meetings';
      }
      if (cat.includes('personal') || cat.includes('wellness') || cat.includes('break')) {
        return 'personal';
      }
    }
    // Check aiNote/title
    const text = (item.aiNote || '').toLowerCase() + ' ' + (task?.title || '').toLowerCase();
    if (text.includes('meeting') || text.includes('call') || text.includes('review')) {
      return 'meetings';
    }
    if (text.includes('personal') || text.includes('wellness') || text.includes('break') || text.includes('lunch')) {
      return 'personal';
    }
    return 'main';
  };

  const getEventColor = (category: 'main' | 'meetings' | 'personal'): string => {
    if (category === 'meetings') {
      return 'bg-[#e6c185]/20 border-[#e6c185] text-on-surface';
    }
    if (category === 'personal') {
      return 'bg-surface-variant/40 border-outline-variant text-on-surface-variant/80';
    }
    return 'bg-primary/20 border-primary text-primary font-semibold';
  };

  const getTaskTitle = (taskId: string) => {
    const task = userTasks.find(t => t.id === taskId);
    return task ? task.title : "Scheduled Block";
  };

  const formatEventWeekdayAndTime = (dateStr: string, startTime: string): string => {
    try {
      const parts = dateStr.split('-');
      const dCorrect = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const weekday = dCorrect.toLocaleDateString('en-US', { weekday: 'long' });
      return `${weekday} ${formatTime12h(startTime)}`;
    } catch (e) {
      return `${dateStr} ${formatTime12h(startTime)}`;
    }
  };

  // Navigation handlers
  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  // Mini calendar days calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = Array.from({ length: firstDayIndex }).map((_, i) => {
    return daysInPrevMonth - firstDayIndex + 1 + i;
  });
  const currentMonthDays = Array.from({ length: daysInMonth }).map((_, i) => i + 1);

  // Upcoming Events calculations
  const upcomingEvents = scheduleItems
    .filter(item => {
      const todayStr = getYYYYMMDD(new Date());
      return item.date >= todayStr;
    })
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });

  const isCurrentWeek = weekDays.some(d => d.toDateString() === new Date().toDateString());

  const getTodayTimeIndicatorTop = () => {
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const elapsedMins = currentHour * 60 + currentMin;
    return (elapsedMins / 60) * 64;
  };

  const todayTimeIndicatorTop = getTodayTimeIndicatorTop();
  const formattedNowTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="bg-background text-on-surface flex flex-col min-h-screen pl-0 md:pl-[260px] relative transition-colors duration-200">
      
      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-8 py-5 border-b border-outline-variant flex justify-between items-center transition-all duration-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface select-none">Calendar</h2>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-md border border-outline-variant bg-surface-container overflow-hidden h-[38px] items-stretch">
            <button 
              onClick={handlePrevWeek}
              className="px-2.5 hover:bg-surface-variant transition-colors cursor-pointer text-on-surface-variant hover:text-on-surface flex items-center justify-center"
              title="Previous Week"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={handleGoToToday}
              className="px-3 hover:bg-surface-variant text-xs font-bold transition-colors cursor-pointer text-on-surface-variant hover:text-on-surface flex items-center justify-center border-x border-outline-variant"
            >
              Today
            </button>
            <button 
              onClick={handleNextWeek}
              className="px-2.5 hover:bg-surface-variant transition-colors cursor-pointer text-on-surface-variant hover:text-on-surface flex items-center justify-center"
              title="Next Week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {googleAccessToken ? (
            <button 
              onClick={toggleGoogleSync}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider select-none h-[38px] cursor-pointer transition-colors ${
                (userPrefs?.googleCalendarSync ?? true)
                  ? 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
                  : 'border-outline-variant text-on-surface-variant bg-surface-container hover:bg-surface-variant'
              }`} 
              title={(userPrefs?.googleCalendarSync ?? true) ? "Click to disable Google Sync" : "Click to enable Google Sync"}
            >
              <RefreshCcw size={10} className={(userPrefs?.googleCalendarSync ?? true) ? "animate-spin-slow" : ""} />
              {(userPrefs?.googleCalendarSync ?? true) ? 'Google Sync Active' : 'Google Sync Paused'}
            </button>
          ) : (
            <button 
              onClick={connectGoogleCalendar}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-outline-variant text-on-surface-variant bg-surface-container hover:bg-surface-variant text-[10px] font-bold uppercase tracking-wider select-none h-[38px] cursor-pointer transition-colors"
              title="Connect to Google Calendar to sync your schedule"
            >
              <RefreshCcw size={10} />
              Connect Google Calendar
            </button>
          )}
        </div>
      </header>

      {/* Grid container with secondary sidebar on right side on wide layouts */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch">
        
        {/* Left Side: Calendar Workspace */}
        <div className="flex-1 flex flex-col p-8 min-w-0">
          
          {/* Sub Header Search Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative flex-1 sm:flex-initial w-full sm:w-auto">
              <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={14} />
              <input 
                type="text" 
                placeholder="Search events..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-lg border border-outline-variant bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary w-full sm:w-48 h-[34px]"
              />
            </div>
            
            {/* Legend/Filters toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={() => handleToggle('main')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  selectedTag.main 
                    ? 'bg-primary/10 border-primary/30 text-primary' 
                    : 'bg-surface-container border-outline-variant text-on-surface-variant'
                }`}
              >
                Deliverables
              </button>
              <button 
                onClick={() => handleToggle('meetings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  selectedTag.meetings 
                    ? 'bg-secondary/10 border-secondary/30 text-secondary' 
                    : 'bg-surface-container border-outline-variant text-on-surface-variant'
                }`}
              >
                Meetings
              </button>
              <button 
                onClick={() => handleToggle('personal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  selectedTag.personal 
                    ? 'bg-tertiary/10 border-tertiary/30 text-tertiary' 
                    : 'bg-surface-container border-outline-variant text-on-surface-variant'
                }`}
              >
                Personal
              </button>
            </div>
          </div>

          {/* Timetable Week view Container */}
          <div className="flex-1 border border-outline-variant rounded-xl bg-surface-container overflow-x-auto custom-scrollbar shadow-sm">
            <div className="min-w-[800px] flex flex-col h-full relative">
              
              {/* Day Headers */}
              <div className="grid grid-cols-[80px_repeat(7,_1fr)] border-b border-outline-variant text-center bg-surface-container-high/40 select-none divide-x divide-outline-variant">
                <div className="p-3"></div>
                {weekDays.map((d, idx) => {
                  const isToday = d.toDateString() === new Date().toDateString();
                  const isCurrentDate = d.toDateString() === currentDate.toDateString();
                  return (
                    <div 
                      key={idx} 
                      className="p-3 flex flex-col items-center gap-1 justify-center cursor-pointer hover:bg-surface-variant/20 transition-colors"
                      onClick={() => setCurrentDate(d)}
                    >
                      <span className="text-[10px] font-bold tracking-wider text-on-surface-variant">
                        {daysOfWeekNames[idx]} {d.getDate()}
                      </span>
                      <span className={`text-sm font-extrabold w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday 
                          ? 'bg-red-500 text-white shadow-sm' 
                          : isCurrentDate 
                            ? 'bg-primary text-on-primary shadow-sm' 
                            : 'text-on-surface'
                      }`}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Grid content columns containing timetable cell blocks */}
              <div className="flex-1 grid grid-cols-[80px_repeat(7,_1fr)] divide-x divide-outline-variant/60 relative select-none">
                
                {/* Time indicators column (left scale) */}
                <div className="divide-y divide-outline-variant/30 text-right pr-3 font-mono text-[9px] font-bold text-on-surface-variant/75 uppercase select-none">
                  {hours.map((h) => (
                    <div key={h} className="h-16 pt-1 flex justify-end items-start pr-1">{h}</div>
                  ))}
                </div>

                {/* Day data grids */}
                {weekDays.map((d, dayIdx) => {
                  const dateStr = getYYYYMMDD(d);
                  const dayEventsUnsorted = scheduleItems.filter(item => {
                    if (item.date !== dateStr) return false;
                    const cat = getEventCategory(item);
                    if (!selectedTag[cat]) return false;
                    
                    if (searchQuery) {
                      const title = getTaskTitle(item.taskId).toLowerCase();
                      const note = (item.aiNote || '').toLowerCase();
                      const queryText = searchQuery.toLowerCase();
                      return title.includes(queryText) || note.includes(queryText);
                    }
                    return true;
                  });

                  // Layout logic for overlapping events
                  const dayEvents = [...dayEventsUnsorted].sort((a, b) => parseTimeToHours(a.startTime) - parseTimeToHours(b.startTime));
                  const layouts = new Map<string, { width: string, left: string }>();
                  
                  let currentGroup: typeof dayEvents = [];
                  let groupEnd = 0;

                  const assignColumns = (group: typeof dayEvents) => {
                    const cols: (typeof dayEvents)[] = [];
                    for (const ev of group) {
                      let placed = false;
                      for (const col of cols) {
                        if (parseTimeToHours(col[col.length - 1].endTime) <= parseTimeToHours(ev.startTime)) {
                          col.push(ev);
                          placed = true;
                          break;
                        }
                      }
                      if (!placed) cols.push([ev]);
                    }
                    const numCols = cols.length;
                    cols.forEach((col, colIdx) => {
                      col.forEach(ev => {
                        layouts.set(ev.id, {
                          width: `calc(${100 / numCols}% - 4px)`,
                          left: `calc(${colIdx * (100 / numCols)}% + 2px)`
                        });
                      });
                    });
                  };

                  for (const ev of dayEvents) {
                    const s = parseTimeToHours(ev.startTime);
                    const e = parseTimeToHours(ev.endTime);

                    if (currentGroup.length > 0 && s >= groupEnd) {
                      assignColumns(currentGroup);
                      currentGroup = [];
                      groupEnd = 0;
                    }
                    currentGroup.push(ev);
                    groupEnd = Math.max(groupEnd, e);
                  }
                  if (currentGroup.length > 0) {
                    assignColumns(currentGroup);
                  }

                  return (
                    <div key={dayIdx} className="relative h-full divide-y divide-outline-variant/20">
                      
                      {/* Hour divisions */}
                      {hours.map((h) => (
                        <div key={h} className="h-16"></div>
                      ))}

                      {/* Placing Events elements inside appropriate slots */}
                      {dayEvents.map((ev) => {
                        const startHour = parseTimeToHours(ev.startTime);
                        const endHour = parseTimeToHours(ev.endTime);
                        const duration = Math.max(0.5, endHour - startHour);

                        // calculate top offset inside timetable scale (baseline 12:00 AM)
                        const elapsedMins = startHour * 60;
                        const topPx = (elapsedMins / 60) * 64; // each hour is 64px high
                        const heightPx = duration * 64;

                        const cat = getEventCategory(ev);
                        const colorClass = getEventColor(cat);
                        const taskTitle = getTaskTitle(ev.taskId);
                        
                        const layout = layouts.get(ev.id) || { width: 'calc(100% - 8px)', left: '4px' };

                        return (
                          <div
                            key={ev.id}
                            style={{ top: `${topPx}px`, height: `${heightPx}px`, width: layout.width, left: layout.left }}
                            className={`absolute p-1 sm:p-1.5 rounded-md border flex flex-col font-medium cursor-pointer overflow-hidden leading-tight transition-all hover:scale-[1.02] hover:z-50 active:scale-95 shadow-sm z-10 ${colorClass}`}
                            title={`${taskTitle}\n${formatTime12h(ev.startTime)} - ${formatTime12h(ev.endTime)}\n${ev.aiNote || ''}`}
                            onClick={() => setSelectedEvent(ev)}
                          >
                            <div className="h-full overflow-hidden">
                              <p className="text-[10px] sm:text-xs font-bold leading-tight break-words flex items-center gap-1 flex-wrap" style={{ display: '-webkit-box', WebkitLineClamp: Math.max(1, Math.floor(heightPx / 16) - 1), WebkitBoxOrient: 'vertical' }}>
                                {isOverdue(ev.taskId) && <AlertTriangle size={10} className="text-error inline shrink-0" />}
                                {taskTitle}
                              </p>
                              {duration >= 0.75 && (
                                <p className="text-[9px] opacity-90 mt-0.5 truncate">
                                  {formatTime12h(ev.startTime)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Real-time horizontal indicator (only shown if today is in the current week and within 8 AM - 9 PM) */}
                {isCurrentWeek && todayTimeIndicatorTop !== null && (
                  <div 
                    style={{ top: `${todayTimeIndicatorTop}px` }} 
                    className="absolute inset-x-0 h-0.5 bg-red-500/80 pointer-events-none flex items-center z-20"
                  >
                    <div className="absolute left-[70px] -translate-y-1/2 bg-red-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                      {formattedNowTime}
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>

        </div>

        {/* Right Side: Secondary workspace sidebar containing upcoming alerts, toggle checkboxes and a Mini Monthly grid */}
        <aside className="w-full lg:w-[320px] bg-surface-container-low border-l border-outline-variant p-6 flex flex-col gap-8 flex-shrink-0">
          
          {/* Mini Calendar Node */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <div className="flex gap-1">
                <button 
                  onClick={handlePrevMonth}
                  className="p-1 rounded hover:bg-surface-variant text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="p-1 rounded hover:bg-surface-variant text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            
            {/* Week Headers */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>

            {/* Monthly mini grids */}
            <div className="grid grid-cols-7 text-center gap-y-2 text-xs font-semibold select-none">
              {/* Padding days from previous month */}
              {prevMonthDays.map((d, i) => (
                <span key={`prev-${i}`} className="text-on-surface-variant/30 font-normal">
                  {d}
                </span>
              ))}
              
              {currentMonthDays.map((day) => {
                const isActive = day === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear();
                
                // check if this day has events
                const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasEvents = scheduleItems.some(item => item.date === dayDateStr);

                return (
                  <button 
                    key={day} 
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setFullYear(year);
                      newDate.setMonth(month);
                      newDate.setDate(day);
                      setCurrentDate(newDate);
                    }}
                    className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center relative cursor-pointer ${
                      isActive 
                        ? 'bg-primary text-on-primary font-bold shadow-sm' 
                        : 'text-on-surface hover:bg-surface-variant'
                    }`}
                  >
                    {day}
                    {!isActive && hasEvents && (
                      <span className="absolute bottom-1 w-1 h-1 bg-primary/65 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Checkbox Filters */}
          <div className="space-y-4 border-t border-outline-variant/40 pt-6">
            <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase">My Calendars</h3>
            <div className="space-y-3">
              
              <label className="flex items-center gap-3 text-xs font-semibold text-on-surface cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={selectedTag.main}
                  onChange={() => handleToggle('main')}
                  className="accent-primary w-4 h-4 rounded border-outline-variant focus:ring-0 cursor-pointer" 
                />
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                  Deliverables
                </span>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-on-surface cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={selectedTag.meetings} 
                  onChange={() => handleToggle('meetings')}
                  className="accent-secondary w-4 h-4 rounded border-outline-variant focus:ring-0 cursor-pointer" 
                />
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>
                  Meetings
                </span>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-on-surface cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={selectedTag.personal} 
                  onChange={() => handleToggle('personal')}
                  className="accent-tertiary w-4 h-4 rounded border-outline-variant focus:ring-0 cursor-pointer" 
                />
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary inline-block"></span>
                  Personal
                </span>
              </label>

            </div>
          </div>

          {/* Upcoming Event items list */}
          <div className="space-y-4 border-t border-outline-variant/40 pt-6 flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase">Upcoming Events</h3>
            <div className="space-y-4">
              {loading ? (
                <div className="text-xs text-on-surface-variant/75 text-center py-4">
                  Loading schedule...
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-xs text-on-surface-variant/75 text-center py-4">
                  No upcoming events scheduled.
                </div>
              ) : (
                upcomingEvents.slice(0, 5).map((item) => {
                  const taskTitle = getTaskTitle(item.taskId);
                  const formattedDayTime = formatEventWeekdayAndTime(item.date, item.startTime);
                  const cat = getEventCategory(item);
                  const colorTextClass = 
                    cat === 'meetings' ? 'text-secondary' :
                    cat === 'personal' ? 'text-[#e6c185]' : 'text-primary';

                  return (
                    <div key={item.id} className="p-3.5 bg-surface-container rounded-lg border border-outline-variant/30 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-bold font-mono uppercase ${colorTextClass}`}>
                          {formattedDayTime}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-on-surface">{taskTitle}</h4>
                      <div className="space-y-1 text-[10px] text-on-surface-variant font-medium">
                        <p className="flex items-center gap-1.5"><Clock size={12} /> {formatTime12h(item.startTime)} - {formatTime12h(item.endTime)}</p>
                        {item.aiNote && (
                          <p className="flex items-start gap-1.5"><Sparkles size={12} className="mt-0.5 flex-shrink-0 text-primary/70" /> <span>{item.aiNote}</span></p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </aside>

      </div>

      {/* Dynamic Toast Element */}
      {toastMessage && (
        <div className="fixed bottom-24 left-6 right-6 md:left-auto md:max-w-sm z-50 bg-surface-container-high border border-outline-variant text-on-surface px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in transition-all">
          <Sparkles size={15} className="text-primary animate-pulse shrink-0" />
          <span className="truncate whitespace-normal leading-relaxed">{toastMessage}</span>
        </div>
      )}

      {/* Task Details Dialog */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-outline">
            <div className={`p-4 border-b border-outline flex justify-between items-start ${getEventColor(getEventCategory(selectedEvent))}`}>
              <div>
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  {getTaskTitle(selectedEvent.taskId)}
                  {isOverdue(selectedEvent.taskId) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-error text-on-error flex items-center gap-1 shadow-sm">
                      <AlertTriangle size={10} /> Overdue
                    </span>
                  )}
                  <button
                    onClick={() => handleBreakdownTask(selectedEvent.taskId)}
                    disabled={breakdownLoadingTask === selectedEvent.taskId}
                    className="flex items-center justify-center w-6 h-6 rounded-md bg-surface/30 hover:bg-surface/50 text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                    title="AI Task Breakdown"
                  >
                    {breakdownLoadingTask === selectedEvent.taskId ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  </button>
                </h3>
                <p className="text-xs text-on-surface-variant font-medium mt-1 flex items-center gap-1.5">
                  <Clock size={12} />
                  {formatEventWeekdayAndTime(selectedEvent.date, selectedEvent.startTime)} - {formatTime12h(selectedEvent.endTime)}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {selectedEvent.aiNote ? (
                <div>
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">AI Note</h4>
                  <p className="text-sm text-on-surface whitespace-pre-wrap">{selectedEvent.aiNote}</p>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant italic">No AI note available.</p>
              )}
            </div>
            <div className="p-4 bg-surface-container flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-5 py-2 bg-primary text-on-primary font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {breakdownTask && (
        <TaskBreakdownModal
          isOpen={breakdownModalOpen}
          onClose={() => setBreakdownModalOpen(false)}
          task={breakdownTask}
          generatedSubtasks={generatedSubtasks}
          isGenerating={isGeneratingBreakdown}
          onAddSubtasks={handleAddSubtasks}
          isAdding={isAddingSubtasks}
        />
      )}

    </div>
  );
}
