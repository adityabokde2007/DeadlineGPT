import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  CheckCircle2, 
  TrendingUp, 
  MoreVertical, 
  Flag, 
  Sparkles, 
  Lightbulb, 
  AlertTriangle, 
  History, 
  Check, 
  Edit, 
  UserPlus, 
  Timer, 
  Headphones, 
  ChevronRight, 
  Play, 
  Bell, 
  ArrowRight,
  Sparkle,
  Sun,
  Moon,
  X,
  Trash2,
  Loader2
} from 'lucide-react';
import Footer from '../components/Footer';
import TaskBreakdownModal from '../components/TaskBreakdownModal';
import FocusModeModal from '../components/FocusModeModal';
import SmartRescheduleBanner from '../components/SmartRescheduleBanner';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { 
  subscribeToTasksByUser, 
  subscribeToScheduleByUser, 
  subscribeToActivityLogsByUser, 
  updateTaskStatus, 
  logActivity,
  createTask,
  updateTask,
  deleteTask,
  createScheduleItem,
  Task,
  ScheduleItem,
  ActivityLogItem
} from '../services/firestoreService';
import { deleteEventFromGoogleCalendar, addEventToGoogleCalendar } from '../services/googleCalendarService';
import { database } from '../firebase/config';

export default function Dashboard() {
  const { currentUser, googleAccessToken, getValidGoogleAccessToken, userPrefs } = useAuth();
  
  // Real Firestore and API data state
  const [allUserTasks, setAllUserTasks] = useState<Task[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [nudges, setNudges] = useState<{
    lightbulb: { title: string; subtitle: string };
    alert: { title: string; subtitle: string };
  }>({
    lightbulb: {
      title: "You're 20% faster on writing tasks today.",
      subtitle: "Consider moving the \"Whitepaper Draft\" to this afternoon."
    },
    alert: {
      title: "Upcoming deadline clash.",
      subtitle: "Project Atlas and Client X both have milestones on Friday."
    }
  });

  const [loading, setLoading] = useState(true);
  const [loadingLong, setLoadingLong] = useState(false);
  const [nudgesLoading, setNudgesLoading] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setLoadingLong(true);
      }, 10000);
    } else {
      setLoadingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const [floatingNotification, setFloatingNotification] = useState<string | null>(null);

  // Filter/Sort States
  const [taskViewFilter, setTaskViewFilter] = useState<'today' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Task Modal states
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [activeTaskMenuId, setActiveTaskMenuId] = useState<string | null>(null);
  const [modalSubtasks, setModalSubtasks] = useState<{ title: string; estimatedMinutes: number; completed: boolean }[]>([]);

  // AI Breakdown states
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null);
  const [breakdownLoadingTask, setBreakdownLoadingTask] = useState<string | null>(null);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<{title: string, estimatedMinutes: number}[]>([]);
  const [isGeneratingBreakdown, setIsGeneratingBreakdown] = useState(false);
  const [isAddingSubtasks, setIsAddingSubtasks] = useState(false);

  // Focus Mode states
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  const handleDismissReschedule = async (task: Task) => {
    if (!task.id) return;
    try {
      await updateTask(task.id, { lastSuggestedAt: new Date() });
    } catch (e) {
      console.error("Failed to dismiss reschedule suggestion", e);
    }
  };

  const handleConfirmReschedule = async (task: Task, newDate: Date) => {
    if (!task.id) return;
    try {
      await updateTask(task.id, { 
        deadline: newDate, 
        lastSuggestedAt: new Date() 
      });
      toast.success("Task rescheduled successfully");
    } catch (e) {
      console.error("Failed to confirm reschedule", e);
      toast.error("Failed to reschedule task");
    }
  };

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

  const getLocalYYYYMMDD = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (dateInput: any) => {
    const d = toLocalDate(dateInput);
    if (!d) return false;
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && 
           d.getMonth() === today.getMonth() && 
           d.getDate() === today.getDate();
  };

  const isOverdue = (task: Task) => {
    if (task.status === 'completed' || task.parentTaskId) return false;
    
    // Check if task has any schedule items that end in the future
    const taskSchedules = scheduleItems.filter(s => s.taskId === task.id);
    if (taskSchedules.length > 0) {
      const latestScheduleTime = Math.max(...taskSchedules.map(s => {
        // Parse the schedule date and time in local time
        return new Date(`${s.date}T${s.endTime}`).getTime();
      }));
      // If the latest schedule time is in the future, it's not overdue
      if (latestScheduleTime >= Date.now()) return false;
    }

    const d = toLocalDate(task.deadline);
    if (!d) return false;
    
    // If the task has no schedule items, or they are all in the past,
    // fallback to checking the exact deadline time.
    // Ensure we are comparing the exact timestamp.
    return d.getTime() < Date.now();
  };

  const shouldShowRescheduleSuggestion = (task: Task) => {
    if (!isOverdue(task)) return false;
    // Don't show if we already suggested it in the last 12 hours
    if (task.lastSuggestedAt) {
      const lastSuggested = toLocalDate(task.lastSuggestedAt);
      if (lastSuggested && Date.now() - lastSuggested.getTime() < 12 * 60 * 60 * 1000) {
        return false;
      }
    }
    return true;
  };

  const formatTime = (dateInput: any) => {
    const d = toLocalDate(dateInput);
    if (!d) return "ASAP";
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDeadlineLabel = (dateInput: any) => {
    const d = toLocalDate(dateInput);
    if (!d) return "";
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
      return "Today";
    }
    if (d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate()) {
      return "Tomorrow";
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatActivityTime = (dateInput: any) => {
    const d = toLocalDate(dateInput);
    if (!d) return "Just now";
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const triggerNotification = (message: string) => {
    setFloatingNotification(message);
    setTimeout(() => {
      setFloatingNotification(null);
    }, 3000);
  };

  // Daily Summary Toast
  useEffect(() => {
    if (loading) return; // wait until initial tasks load
    
    // Only show if we actually have a valid state and haven't seen it yet
    if (currentUser?.uid && !sessionStorage.getItem('hasSeenDailyToast')) {
      const todayTasks = allUserTasks.filter(t => !t.parentTaskId && t.status !== "completed" && isToday(t.deadline));
      const highPriorityCount = todayTasks.filter(t => ['high', 'urgent', 'critical'].includes(t.priority)).length;
      const totalMinutes = todayTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0);
      const hours = (totalMinutes / 60).toFixed(1).replace(/\.0$/, '');
      
      const hourStr = totalMinutes > 0 ? ` and ${hours} hour${hours !== '1' ? 's' : ''} of estimated work` : '';
      const taskStr = highPriorityCount === 1 ? '1 high-priority task' : `${highPriorityCount} high-priority tasks`;
      
      let greeting = 'Good morning';
      const currentHour = new Date().getHours();
      if (currentHour >= 12 && currentHour < 17) greeting = 'Good afternoon';
      else if (currentHour >= 17) greeting = 'Good evening';

      toast.success(`${greeting}! You have ${taskStr} today${hourStr}.`, {
        icon: '👋',
        duration: 6000,
        style: {
          borderRadius: '16px',
          background: '#e07a5f',
          color: '#ffffff',
          border: '1px solid #e07a5f'
        },
      });

      sessionStorage.setItem('hasSeenDailyToast', 'true');
    }
  }, [loading, currentUser?.uid, allUserTasks]);

  // Fetch Schedules and Activity Logs on Auth or Trigger
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribeSchedules = subscribeToScheduleByUser(currentUser.uid, (schedules) => {
      setScheduleItems(schedules);
    });

    const unsubscribeLogs = subscribeToActivityLogsByUser(currentUser.uid, (logs) => {
      setActivityLogs(logs);
    });

    return () => {
      unsubscribeSchedules();
      unsubscribeLogs();
    };
  }, [currentUser]);

  // Fetch all tasks once (unfiltered) to prevent composite index issues and provide offline-friendly states
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    const unsubscribeTasks = subscribeToTasksByUser(currentUser.uid, (tasks) => {
      // Detect externally deleted tasks by comparing old state to new state
      setAllUserTasks(prevTasks => {
        if (prevTasks.length > 0 && googleAccessToken && userPrefs?.googleCalendarSync !== false) {
          const newTaskIds = new Set(tasks.map(t => t.id));
          const deletedTasks = prevTasks.filter(t => !newTaskIds.has(t.id));
          
          deletedTasks.forEach(async (deletedTask) => {
            // Delete associated Google Calendar events for tasks deleted externally
            const validToken = await getValidGoogleAccessToken();
            if (validToken) {
              if (deletedTask.googleEventIds && deletedTask.googleEventIds.length > 0) {
                for (const eventId of deletedTask.googleEventIds) {
                  await deleteEventFromGoogleCalendar(validToken, eventId);
                }
              } else if (deletedTask.googleEventId) {
                await deleteEventFromGoogleCalendar(validToken, deletedTask.googleEventId);
              }
            }
          });
        }
        return tasks;
      });
      
      // Extract categories dynamically
      const cats = new Set<string>();
      tasks.forEach((t) => {
        if (t.category) cats.add(t.category);
      });
      setCategories(Array.from(cats));
      
      setLoading(false);
    });

    return () => {
      unsubscribeTasks();
    };
  }, [currentUser]);

  const generateBreakdown = async (task: Task) => {
    setIsGeneratingBreakdown(true);
    setGeneratedSubtasks([]);
    
    try {
      const response = await fetch('/api/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskTitle: task.title, 
          dueDate: task.deadline ? formatDeadlineLabel(task.deadline) : null,
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

  const handleBreakdownTask = (task: Task) => {
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

  // Derive the active, filtered, and sorted task list purely client-side
  const userTasks = useMemo(() => {
    let tasks = [...allUserTasks].filter(t => !t.parentTaskId);

    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === priorityFilter);
    }

    if (categoryFilter !== 'all') {
      tasks = tasks.filter(t => t.category === categoryFilter);
    }

    if (taskViewFilter === 'today') {
      tasks = tasks.filter(t => isToday(t.deadline));
    }

    // Sort by deadline
    tasks.sort((a, b) => {
      const da = toLocalDate(a.deadline)?.getTime() || 0;
      const db = toLocalDate(b.deadline)?.getTime() || 0;
      return da - db;
    });

    return tasks;
  }, [allUserTasks, statusFilter, priorityFilter, categoryFilter, taskViewFilter]);

  // Fetch Smart Nudges from Gemini
  useEffect(() => {
    if (allUserTasks.length === 0 || nudgesLoading) return;

    const pendingTasks = allUserTasks.filter(t => t.status !== "completed");
    if (pendingTasks.length === 0) return;

    async function fetchNudges() {
      try {
        setNudgesLoading(true);
        const res = await fetch("/api/nudge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: pendingTasks.map(t => ({
              title: t.title,
              deadline: t.deadline,
              priority: t.priority,
              category: t.category
            }))
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.lightbulb && data.alert) {
            setNudges(data);
          }
        }
      } catch (err) {
        console.error("Error fetching nudges:", err);
      } finally {
        setNudgesLoading(false);
      }
    }

    fetchNudges();
  }, [allUserTasks.length]);

  const toggleTask = async (taskId: string, currentStatus: "pending" | "in-progress" | "completed", title: string) => {
    if (!currentUser?.uid) return;
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await updateTaskStatus(taskId, newStatus);
      if (newStatus === "completed") {
        await logActivity(currentUser.uid, "completed", title);
      }
      
      triggerNotification(newStatus === "completed" ? `Completed: "${title}"` : `Reopened: "${title}"`);
    } catch (err) {
      console.error("Error toggling task status:", err);
      triggerNotification("Failed to update task status.");
    }
  };

  const handleOpenNewTaskModal = () => {
    setEditingTask(null);
    setModalSubtasks([]);
    setTaskModalOpen(true);
  };

  const handleQuickAddTask = handleOpenNewTaskModal;

  const handleOpenEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setModalSubtasks(task.subtasks || []);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const deadlineDate = formData.get('deadlineDate') as string;
    const deadlineTime = formData.get('deadlineTime') as string;
    const estimatedEffort = parseInt(formData.get('estimatedEffort') as string) || 0;
    const priority = formData.get('priority') as Task['priority'];
    const category = formData.get('category') as string;
    const status = formData.get('status') as Task['status'];

    // Combine deadlineDate and deadlineTime into a Date object
    const deadline = new Date(`${deadlineDate}T${deadlineTime || '23:59'}`);

    // Overlap check
    const existingTask = allUserTasks.find(t => {
      if (editingTask && t.id === editingTask.id) return false;
      const tDate = toLocalDate(t.deadline);
      return tDate && tDate.getTime() === deadline.getTime();
    });

    if (existingTask) {
      alert(`This time slot overlaps with '${existingTask.title}'. Please choose a different time.`);
      return;
    }

    const taskData = {
      title,
      description: description || '',
      deadline,
      estimatedEffort,
      priority,
      category: category || 'General',
      status,
      subtasks: modalSubtasks,
    };

    try {
      let finalTaskId: string;
      if (editingTask) {
        await updateTask(editingTask.id!, taskData);
        finalTaskId = editingTask.id!;
        triggerNotification(`Task "${title}" updated successfully.`);
      } else {
        finalTaskId = await createTask(currentUser.uid, taskData);
        await logActivity(currentUser.uid, "created", title);
        triggerNotification(`Task "${title}" created successfully.`);
        
        // Auto-create schedule item for the deadline so it appears in calendars
        if (deadlineDate && deadlineTime) {
          const durationMins = estimatedEffort > 0 ? estimatedEffort : 60;
          let sH = parseInt(deadlineTime.split(':')[0] || '09');
          let sM = parseInt(deadlineTime.split(':')[1] || '00');
          let eH = sH + Math.floor((sM + durationMins) / 60);
          let eM = (sM + durationMins) % 60;
          if (eH >= 24) eH = 23; // cap at 11pm
          
          const endTime = `${eH.toString().padStart(2, '0')}:${eM.toString().padStart(2, '0')}`;
          const startTime = `${sH.toString().padStart(2, '0')}:${sM.toString().padStart(2, '0')}`;

          const schedItem = {
            userId: currentUser.uid,
            taskId: finalTaskId,
            date: deadlineDate,
            startTime: startTime,
            endTime: endTime,
            aiNote: "Scheduled task block"
          };

          await createScheduleItem(schedItem);

          if (userPrefs?.googleCalendarSync !== false) {
            const validToken = await getValidGoogleAccessToken();
            if (validToken) {
               const googleEvent = await addEventToGoogleCalendar(validToken, {
                  title: `DeadlineGPT: ${title}`,
                  date: deadlineDate,
                  startTime: startTime,
                  endTime: endTime,
                  description: description || "Manually scheduled task"
               });
               if (googleEvent && googleEvent.id) {
                  await updateTask(finalTaskId, { ...taskData, googleEventId: googleEvent.id });
               }
            }
          }
        }
      }
      setTaskModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error saving task:", err);
      triggerNotification("Failed to save task.");
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      const taskToDelete = allUserTasks.find(t => t.id === deletingTaskId);

      await deleteTask(deletingTaskId);

      // Clean up Google Calendar events if any
      if (taskToDelete && googleAccessToken && userPrefs?.googleCalendarSync !== false) {
        const validToken = await getValidGoogleAccessToken();
        if (validToken) {
          if (taskToDelete.googleEventIds && taskToDelete.googleEventIds.length > 0) {
            for (const eventId of taskToDelete.googleEventIds) {
              await deleteEventFromGoogleCalendar(validToken, eventId);
            }
          } else if (taskToDelete.googleEventId) {
            await deleteEventFromGoogleCalendar(validToken, taskToDelete.googleEventId);
          }
        }
      }

      triggerNotification("Task deleted successfully.");
      setDeletingTaskId(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error deleting task:", err);
      triggerNotification("Failed to delete task.");
    }
  };

  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#tasks') {
      const el = document.getElementById('tasks');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [location]);

  // Derived dashboard analytics
  const activeTasksCount = allUserTasks.filter(t => t.status !== "completed").length;

  const getProductivityScore = () => {
    if (allUserTasks.length === 0) return -1;
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const last7DaysTasks = allUserTasks.filter(task => {
      const d = toLocalDate(task.deadline);
      if (!d) return false;
      return d >= sevenDaysAgo && d <= today;
    });

    const completedCount = last7DaysTasks.filter(t => t.status === "completed").length;
    const totalCount = last7DaysTasks.length;

    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
  };

  const currentScore = getProductivityScore();

  const last7DaysList = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const completedCountsByDay = last7DaysList.map(date => {
    const dateStr = getLocalYYYYMMDD(date);
    return allUserTasks.filter(task => {
      if (task.status !== 'completed') return false;
      const d = toLocalDate(task.deadline);
      return d && getLocalYYYYMMDD(d) === dateStr;
    }).length;
  });

  const maxCount = Math.max(...completedCountsByDay, 1);
  const heightClasses = completedCountsByDay.map(count => {
    const pct = (count / maxCount) * 100;
    if (pct === 0) return "h-[10%] bg-surface-variant/40";
    if (pct <= 20) return "h-[20%] bg-primary/30";
    if (pct <= 40) return "h-[40%] bg-primary/45";
    if (pct <= 60) return "h-[60%] bg-primary/60";
    if (pct <= 80) return "h-[80%] bg-primary/80";
    return "h-full bg-primary";
  });

  const dueTodayTasks = allUserTasks
    .filter(t => !t.parentTaskId && t.status !== "completed" && isToday(t.deadline))
    .sort((a, b) => {
      const da = toLocalDate(a.deadline)?.getTime() || 0;
      const db = toLocalDate(b.deadline)?.getTime() || 0;
      return da - db;
    });

  const highPriorityTasks = allUserTasks
    .filter(t => !t.parentTaskId && (t.priority === "high" || t.priority === "urgent" || t.priority === "critical") && t.status !== "completed")
    .sort((a, b) => {
      const da = toLocalDate(a.deadline)?.getTime() || 0;
      const db = toLocalDate(b.deadline)?.getTime() || 0;
      return da - db;
    });

  const todayDateStr = getLocalYYYYMMDD();
  const todaySchedules = scheduleItems
    .filter(s => s.date === todayDateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const getTaskTitle = (taskId: string) => {
    const task = allUserTasks.find(t => t.id === taskId);
    return task ? task.title : "Scheduled Block";
  };

  const allTasksCount = useMemo(() => {
    return allUserTasks.filter(t => {
      if (t.parentTaskId) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    }).length;
  }, [allUserTasks, statusFilter, priorityFilter, categoryFilter]);

  const recentActivities = [...activityLogs]
    .sort((a, b) => {
      const ta = toLocalDate(a.timestamp)?.getTime() || 0;
      const tb = toLocalDate(b.timestamp)?.getTime() || 0;
      return tb - ta;
    })
    .slice(0, 5);

  const getEditingDateValues = () => {
    if (!editingTask) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        date: tomorrow.toISOString().split('T')[0],
        time: "23:59"
      };
    }
    const d = toLocalDate(editingTask.deadline);
    if (!d) return { date: "", time: "" };
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const parts = localDate.toISOString().split('T');
    return {
      date: parts[0],
      time: parts[1].substring(0, 5)
    };
  };

  const editingDateValues = getEditingDateValues();

  return (
    <>
      <AnimatePresence>
        {loading && (
          <motion.div
            key="dashboard-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-on-surface select-none"
          >
            <div className="flex flex-col items-center gap-6 px-6 text-center">
              <motion.div 
                className="relative flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative">
                   <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin" style={{ animationDuration: '3s' }}></div>
                   <Sparkles size={24} className="text-primary animate-pulse" />
                </div>
              </motion.div>
              <div>
                <h4 className="text-xl font-bold tracking-tight text-on-surface mb-2">DeadlineGPT</h4>
                <p className="text-sm font-semibold text-on-surface-variant/80">
                  {loadingLong ? "Still setting things up..." : "Organizing your workspace..."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-background text-on-surface flex flex-col min-h-screen relative pl-0 md:pl-[260px] transition-colors duration-200">
      
      {/* Floating Action Notifications */}
      {floatingNotification && (
        <div className="fixed top-6 right-6 z-50 bg-secondary-container text-on-secondary-container border border-outline px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
          <Sparkles size={16} />
          <span className="text-xs font-semibold">{floatingNotification}</span>
        </div>
      )}

      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-8 py-5 border-b border-outline-variant flex justify-between items-center transition-all duration-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface select-none">Overview</h2>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Welcome, {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
          </p>
        </div>
        <div className="flex items-center gap-4">
        </div>
      </header>

      {/* Stats row */}
      <div className="p-8 max-w-[1280px] w-full mx-auto space-y-12">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Productivity Score */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col items-center justify-center relative overflow-hidden group shadow-sm">
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Score SVG circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-surface-variant/40" cx="64" cy="64" fill="transparent" r="54" stroke="currentColor" strokeWidth="6"></circle>
                <circle 
                  className="text-primary transition-all duration-700 ease-out" 
                  cx="64" 
                  cy="64" 
                  fill="transparent" 
                  r="54" 
                  stroke="currentColor" 
                  strokeWidth="6"
                  strokeDasharray="339.2"
                  strokeDashoffset={339.2 - (339.2 * (currentScore === -1 ? 0 : currentScore)) / 100}
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-primary tracking-tight">{currentScore === -1 ? "—" : currentScore}</span>
                <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">SCORE</span>
              </div>
            </div>
            <h3 className="text-xs font-bold text-on-surface-variant tracking-wider uppercase mt-4">Productivity Score</h3>
            {currentScore === -1 && (
              <p className="text-[10px] text-on-surface-variant text-center mt-1">Complete tasks to see your score.</p>
            )}
          </div>

          {/* Active Tasks */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col justify-between group shadow-sm min-h-[176px]">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-surface-variant rounded-lg border border-outline-variant/30 text-primary">
                <CheckCircle2 size={18} />
              </div>
              <span className="text-xs font-bold text-on-tertiary-container bg-tertiary-container/20 px-2.5 py-1 rounded-full">
                Real-time Sync
              </span>
            </div>
            <div className="mt-4 flex flex-col items-start">
              <span className="text-5xl font-extrabold text-on-surface tracking-tighter leading-none">{activeTasksCount}</span>
              <h3 className="text-xs font-bold text-on-surface-variant tracking-wider uppercase mt-1">Active Tasks</h3>
              {activeTasksCount === 0 && allUserTasks.length === 0 && (
                <button 
                  onClick={handleOpenNewTaskModal}
                  className="mt-2 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Add your first task to get started &rarr;
                </button>
              )}
            </div>
          </div>

          {/* Weekly Streak */}
          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant flex flex-col justify-between overflow-hidden shadow-sm min-h-[176px]">
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Weekly Burn-Up</h3>
              <TrendingUp size={18} className="text-on-surface-variant" />
            </div>
            <div className="h-14 flex items-end gap-1.5 select-none py-2">
              {heightClasses.map((hClass, i) => (
                <div key={i} className={`flex-1 rounded-sm ${hClass}`} title={`${completedCountsByDay[i]} tasks completed`}></div>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant font-medium">
              {completedCountsByDay[6] > 0 ? "Active productivity streak! Keep it up." : "Complete tasks to heat up your streak."}
            </p>
          </div>
        </section>

        {/* Middle row details */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Due today list (8 Columns) */}
          <div id="tasks" className="lg:col-span-8 space-y-6">
            <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
              <div className="p-4 border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-high/30">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setTaskViewFilter('today')}
                    className={`text-xs font-bold tracking-widest uppercase pb-1 border-b-2 transition-all cursor-pointer ${
                      taskViewFilter === 'today' ? 'text-primary border-primary' : 'text-on-surface-variant/65 border-transparent hover:text-on-surface'
                    }`}
                  >
                    Due Today
                  </button>
                  <button 
                    onClick={() => setTaskViewFilter('all')}
                    className={`text-xs font-bold tracking-widest uppercase pb-1 border-b-2 transition-all cursor-pointer ${
                      taskViewFilter === 'all' ? 'text-primary border-primary' : 'text-on-surface-variant/65 border-transparent hover:text-on-surface'
                    }`}
                  >
                    All Tasks ({allTasksCount})
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-xs bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs bg-surface-container-low border border-outline-variant rounded px-2.5 py-1 text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <button 
                    onClick={handleOpenNewTaskModal}
                    className="text-xs font-bold bg-primary text-on-primary px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1.5 shadow-sm transition-transform cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>New Task</span>
                  </button>
                </div>
              </div>
              <div className="divide-y divide-outline-variant">
                {userTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant">
                    {taskViewFilter === 'today' ? "No tasks due today. Hooray!" : "No tasks found with active filters."}
                  </div>
                ) : (
                  userTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="hover:bg-surface-variant/20 transition-all group border-b border-outline-variant last:border-0"
                    >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          task.priority === 'critical' || task.priority === 'urgent' || task.priority === 'high'
                            ? 'bg-orange-500'
                            : task.priority === 'medium'
                            ? 'bg-amber-500'
                            : 'bg-outline'
                        }`} title={`Priority: ${task.priority}`} />
                        <button 
                          onClick={() => toggleTask(task.id!, task.status, task.title)}
                          className={`w-5 h-5 rounded border border-outline-variant hover:border-primary flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            task.status === 'completed' ? 'bg-primary border-primary' : 'bg-transparent'
                          }`}
                        >
                          {task.status === 'completed' && <Check size={12} className="text-on-primary font-bold" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold text-on-surface transition-all ${task.status === 'completed' ? 'line-through text-on-surface-variant/50' : ''}`}>
                              {task.title}
                            </p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                              task.priority === 'critical' || task.priority === 'urgent'
                                ? 'bg-error-container/20 text-error'
                                : task.priority === 'high'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-surface-variant text-on-surface-variant'
                            }`}>
                              {task.priority}
                            </span>
                            {isOverdue(task) && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-error/10 text-error flex items-center gap-1">
                                <AlertTriangle size={10} /> Overdue
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBreakdownTask(task);
                              }}
                              disabled={breakdownLoadingTask === task.id}
                              className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 ml-1 cursor-pointer"
                              title="AI Task Breakdown"
                            >
                              {breakdownLoadingTask === task.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            </button>
                          </div>
                          {task.description && (
                            <p className="text-xs text-on-surface-variant/80 mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                          <p className="text-[11px] text-on-surface-variant font-medium mt-1">
                            {task.category} • {formatDeadlineLabel(task.deadline)} • {formatTime(task.deadline)} • {task.estimatedEffort}m
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 relative">
                        {/* Start Execution Button for High Priority Tasks */}
                        {(task.priority === 'high' || task.priority === 'urgent' || task.priority === 'critical') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocusTask(task);
                              setFocusModalOpen(true);
                            }}
                            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors cursor-pointer"
                            title="Start Focus Mode"
                          >
                            <Play size={10} fill="currentColor" />
                            EXECUTE
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTaskMenuId(prev => prev === task.id ? null : task.id || null);
                          }}
                          className="p-1 rounded hover:bg-surface-variant text-on-surface-variant hover:text-on-surface cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeTaskMenuId === task.id && (
                          <div className="absolute right-0 mt-1 w-28 bg-surface-container-high border border-outline rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTaskMenuId(null);
                                handleOpenEditTaskModal(task);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-on-surface hover:bg-surface-variant flex items-center gap-2 cursor-pointer"
                            >
                              <Edit size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTaskMenuId(null);
                                setDeletingTaskId(task.id!);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={14} className="text-red-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                      </div>
                      
                      {/* Subtasks rendering */}
                      {(() => {
                        const subtasks = allUserTasks.filter(t => t.parentTaskId === task.id);
                        if (subtasks.length === 0) return null;
                        const completedCount = subtasks.filter(t => t.status === 'completed').length;
                        return (
                          <div className="pl-[3.25rem] pr-4 pb-3 -mt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-variant/50 px-1.5 py-0.5 rounded">
                                {completedCount}/{subtasks.length} subtasks
                              </span>
                            </div>
                            <div className="space-y-1 border-l-2 border-outline-variant/30 ml-1.5 pl-3">
                              {subtasks.map(st => (
                                <div key={st.id} className="flex items-center gap-2 group/st py-1">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleTask(st.id!, st.status, st.title); }}
                                    className={`w-3.5 h-3.5 rounded-[3px] border hover:border-primary flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                      st.status === 'completed' ? 'bg-primary border-primary' : 'bg-transparent border-outline-variant'
                                    }`}
                                  >
                                    {st.status === 'completed' && <Check size={8} className="text-on-primary font-bold" />}
                                  </button>
                                  <span className={`text-xs font-medium truncate transition-all ${st.status === 'completed' ? 'text-on-surface-variant/50 line-through' : 'text-on-surface-variant group-hover/st:text-on-surface'}`}>
                                    {st.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {shouldShowRescheduleSuggestion(task) && (
                        <div className="px-4 pb-4 -mt-2">
                          <SmartRescheduleBanner 
                            task={task} 
                            otherTasks={allUserTasks} 
                            onConfirm={(newDate) => handleConfirmReschedule(task, newDate)} 
                            onDismiss={() => handleDismissReschedule(task)} 
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* High Priority Tasks Banner */}
            <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
              <div className="p-4 border-b border-outline-variant flex items-center gap-2">
                <Flag size={16} className="text-error" fill="currentColor" />
                <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase">High Priority</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {highPriorityTasks.length === 0 ? (
                  <div className="col-span-2 p-6 text-center text-xs text-on-surface-variant">
                    No high priority, urgent, or critical tasks pending. Excellent job!
                  </div>
                ) : (
                  highPriorityTasks.slice(0, 4).map((task) => (
                    <div 
                      key={task.id}
                      onClick={() => triggerNotification(`Details: ${task.description || task.title}`)}
                      className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/40 hover:border-primary/50 transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            task.priority === 'critical' ? 'text-error bg-error-container/20' : 
                            task.priority === 'urgent' ? 'text-amber-500 bg-amber-500/10' :
                            'text-orange-500 bg-orange-500/10'
                          }`}>
                            {task.priority}
                          </span>
                          {isOverdue(task) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono bg-error/10 text-error flex items-center gap-1">
                              <AlertTriangle size={10} /> Overdue
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBreakdownTask(task);
                            }}
                            disabled={breakdownLoadingTask === task.id}
                            className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
                            title="AI Task Breakdown"
                          >
                            {breakdownLoadingTask === task.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          </button>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant">{formatDeadlineLabel(task.deadline)}</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface hover:text-primary transition-colors">{task.title}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusTask(task);
                          setFocusModalOpen(true);
                        }}
                        className="mt-3 w-full py-1.5 rounded bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                      >
                        <Play size={12} fill="currentColor" />
                        Start Execution
                      </button>

                      {shouldShowRescheduleSuggestion(task) && (
                        <div className="mt-3 -mx-1">
                          <SmartRescheduleBanner 
                            task={task} 
                            otherTasks={allUserTasks} 
                            onConfirm={(newDate) => handleConfirmReschedule(task, newDate)} 
                            onDismiss={() => handleDismissReschedule(task)} 
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* AI Schedule (4 Columns) */}
          <div className="lg:col-span-4 bg-surface-container rounded-xl border border-outline-variant h-full shadow-sm">
            <div className="p-4 border-b border-outline-variant bg-surface-container-high/30">
              <h3 className="text-xs font-bold text-on-surface tracking-widest uppercase">AI Schedule</h3>
            </div>
            
            <div className="p-4 space-y-6 relative">
              {todaySchedules.length > 0 && (
                /* Vertical timeline connector */
                <div className="absolute left-[25px] top-6 bottom-6 w-[2px] bg-outline-variant/30 pointer-events-none"></div>
              )}

              {todaySchedules.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No blocks scheduled for today. Talk to Gemini in Chat to schedule your tasks!
                </div>
              ) : (
                todaySchedules.map((item, index) => (
                  <div key={item.id || index} className="relative pl-8">
                    <div className={`absolute left-[3px] top-1 w-3.5 h-3.5 rounded-full border-4 border-surface-container ${
                      index === 0 ? 'bg-primary' : 'bg-outline'
                    }`}></div>
                    <div className="mb-1">
                      <span className="text-[10px] font-bold text-primary font-mono select-none">{item.startTime} - {item.endTime}</span>
                      <p className="text-sm font-bold text-on-surface">{getTaskTitle(item.taskId)}</p>
                    </div>
                    {item.aiNote && (
                      <p className="text-xs text-on-surface-variant italic font-medium">
                        "{item.aiNote}"
                      </p>
                    )}
                  </div>
                ))
              )}

            </div>
          </div>
        </section>



        
        <Footer />
      </div>

      {/* Create/Edit Task Modal */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setTaskModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">Specify your target milestone details.</p>
              </div>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Title</label>
                <input
                  required
                  name="title"
                  type="text"
                  defaultValue={editingTask?.title || ""}
                  placeholder="Task title..."
                  className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingTask?.description || ""}
                  placeholder="Details about this milestone..."
                  rows={2}
                  className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Deadline (Date & Time) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Deadline Date</label>
                  <input
                    required
                    name="deadlineDate"
                    type="date"
                    defaultValue={editingDateValues.date}
                    className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Deadline Time</label>
                  <input
                    required
                    name="deadlineTime"
                    type="time"
                    defaultValue={editingDateValues.time}
                    className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Priority, Category, Effort & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Priority</label>
                  <select
                    name="priority"
                    defaultValue={editingTask?.priority || "medium"}
                    className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Status</label>
                  <select
                    name="status"
                    defaultValue={editingTask?.status || "pending"}
                    className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Category</label>
                  <input
                    name="category"
                    type="text"
                    defaultValue={editingTask?.category || "General"}
                    placeholder="General, Work, Personal..."
                    className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Estimated Minutes</label>
                  <input
                    required
                    name="estimatedEffort"
                    type="number"
                    min="1"
                    defaultValue={editingTask?.estimatedEffort || 30}
                    className="w-full text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Subtasks editing block */}
              <div className="space-y-2 pt-1 border-t border-outline-variant/20">
                <label className="text-xs font-bold text-on-surface tracking-wider uppercase">Subtasks</label>
                <div className="flex gap-2">
                  <input
                    id="new-subtask-title"
                    type="text"
                    placeholder="Add subtask..."
                    className="flex-1 text-xs bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.currentTarget;
                        if (input.value.trim()) {
                          setModalSubtasks(prev => [...prev, { title: input.value.trim(), estimatedMinutes: 15, completed: false }]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('new-subtask-title') as HTMLInputElement;
                      if (input && input.value.trim()) {
                        setModalSubtasks(prev => [...prev, { title: input.value.trim(), estimatedMinutes: 15, completed: false }]);
                        input.value = '';
                      }
                    }}
                    className="bg-surface-variant hover:bg-surface-variant/80 text-on-surface-variant px-3 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                
                {modalSubtasks.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1.5 border border-outline-variant/30 rounded-lg p-2 bg-surface-container-low/50">
                    {modalSubtasks.map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 hover:bg-surface-variant/20 rounded">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onChange={(e) => {
                              setModalSubtasks(prev => prev.map((item, i) => i === idx ? { ...item, completed: e.target.checked } : item));
                            }}
                            className="w-3.5 h-3.5 text-primary border-outline rounded focus:ring-primary cursor-pointer"
                          />
                          <span className={`text-xs text-on-surface truncate ${st.completed ? 'line-through text-on-surface-variant/50' : ''}`}>{st.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setModalSubtasks(prev => prev.filter((_, i) => i !== idx))}
                          className="text-on-surface-variant/60 hover:text-red-500 cursor-pointer shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 bg-surface-variant hover:bg-surface-variant/85 text-on-surface-variant rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:opacity-90 text-on-primary rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-on-surface mb-2">Delete Task</h3>
            <p className="text-xs text-on-surface-variant font-medium mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 bg-surface-variant hover:bg-surface-variant/85 text-on-surface-variant rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Delete
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

      <FocusModeModal
        isOpen={focusModalOpen}
        onClose={() => setFocusModalOpen(false)}
        task={focusTask}
        onCompleteTask={(taskId) => {
          const taskToComplete = allUserTasks.find(t => t.id === taskId);
          if (taskToComplete) {
            toggleTask(taskId, taskToComplete.status, taskToComplete.title);
          }
        }}
      />

    </div>
    </>
  );
}
