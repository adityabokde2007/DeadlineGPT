import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Send, 
  Paperclip, 
  Camera, 
  Mic, 
  MoreVertical, 
  Share2, 
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Copy,
  ChevronRight,
  Sparkle,
  Sun,
  Moon,
  ChevronDown,
  Download
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { createTask, createScheduleItem, getUserPrefs, getScheduleByUser, logActivity, ChatSession, ChatSessionMessage, subscribeToChatSessionsByUser, createChatSession, appendMessageToSession, updateTask, getTasksByUser, deleteTask, deleteScheduleItemsForTask } from '../services/firestoreService';
import { addEventToGoogleCalendar, deleteEventFromGoogleCalendar } from '../services/googleCalendarService';
import toast from 'react-hot-toast';

export default function ChatInterface() {
  const { currentUser, googleAccessToken, getValidGoogleAccessToken } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = subscribeToChatSessionsByUser(currentUser.uid, (fetchedSessions) => {
      setSessions(fetchedSessions);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const [selectedModel, setSelectedModel] = useState('Gemini 1.5 Pro');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // New state for handling Focus Hours confirmations
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    task: any;
    taskData: any;
    scheduleItems: any[];
    conflictingItem: any;
    prefs: any;
  } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  const finalizeTaskCreation = async (task: any, taskData: any, scheduleItems: any[], prefs: any, targetSessionId: string, appendAiMessage: (msg: string) => Promise<void>) => {
    if (!currentUser?.uid) return;
    try {
      const taskId = await createTask(currentUser.uid, taskData);

      // Show confirmation bubble in chat
      await appendAiMessage(`Added: ${taskData.title} — due ${task.deadline || 'N/A'}\n\nAnalyzing schedule and distributing subtasks...`);

      // Log task creation activity
      await logActivity(currentUser.uid, "created", taskData.title);

      if (Array.isArray(scheduleItems) && scheduleItems.length > 0) {
        let scheduleTextList = "";
        let calendarSyncFailed = false;
        let calendarErrorMsg = "";
        let googleEventIds: string[] = [];

        for (const item of scheduleItems) {
          const schedItem = {
            userId: currentUser.uid,
            taskId,
            date: item.date || new Date().toISOString().split('T')[0],
            startTime: item.startTime || "09:00",
            endTime: item.endTime || "10:00",
            aiNote: item.aiNote || ""
          };
          await createScheduleItem(schedItem);
          scheduleTextList += `• **${schedItem.date}** (${schedItem.startTime} - ${schedItem.endTime}): ${schedItem.aiNote}\n`;

          if (prefs?.googleCalendarSync !== false) {
            const validToken = await getValidGoogleAccessToken();
            if (validToken) {
              try {
                const googleEvent = await addEventToGoogleCalendar(validToken, {
                  title: `DeadlineGPT: ${taskData.title}`,
                  date: schedItem.date,
                  startTime: schedItem.startTime,
                  endTime: schedItem.endTime,
                  description: schedItem.aiNote
                });
                if (googleEvent && googleEvent.id) {
                  googleEventIds.push(googleEvent.id);
                }
              } catch (e: any) {
                console.error("Failed to sync to Google Calendar:", e);
                calendarSyncFailed = true;
                calendarErrorMsg = e.message;
              }
            } else {
              calendarSyncFailed = true;
              calendarErrorMsg = "Google Calendar not connected please connect it in Settings.";
            }
          }
        }

        if (googleEventIds.length > 0) {
          await updateTask(taskId, { googleEventIds });
        }

        const confirmText = calendarSyncFailed
          ? `Subtasks scheduled locally.\n\n*Note: Google Calendar sync skipped (${calendarErrorMsg}).*\n\n**Planned Schedule:**\n${scheduleTextList}`
          : `Successfully synchronized and mapped to your calendar!\n\n**Planned Schedule:**\n${scheduleTextList}`;

        if (!calendarSyncFailed && prefs?.googleCalendarSync !== false && googleAccessToken) {
          toast.success("Tasks synced to Google Calendar!");
        }

        await appendAiMessage(confirmText);
      } else {
        await appendAiMessage(`No subtasks scheduled. Total effort has been block-allocated on the deadline date of ${task.deadline || 'N/A'}.`);
      }
    } catch (err: any) {
      await appendAiMessage(`Error finalizing task: ${err.message || String(err)}`);
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    try {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const base64Data = reader.result?.toString().split(',')[1];
          if (!base64Data) {
            setIsUploading(false);
            return;
          }
          const response = await fetch("/api/extract-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Data, mimeType: file.type })
          });
          const result = await response.json();
          if (result.text) {
             setInputText(prev => prev + (prev ? "\n" : "") + result.text);
          }
          setIsUploading(false);
        };
      } else {
        const text = await file.text();
        setInputText(prev => prev + (prev ? "\n" : "") + text);
        setIsUploading(false);
      }
    } catch (e) {
      console.error(e);
      setIsUploading(false);
    }
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        let finalTranscript = inputText;

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += (finalTranscript ? " " : "") + event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setInputText(finalTranscript + interimTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.start();
        return;
      } catch (e) {
        console.warn("SpeechRecognition failed, falling back to MediaRecorder", e);
      }
    }

    // Fallback to MediaRecorder + Gemini Transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        stream.getTracks().forEach(track => track.stop());

        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        if (audioBlob.size === 0) return;

        setIsUploading(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onload = async () => {
            const base64Data = reader.result?.toString().split(',')[1];
            if (!base64Data) {
              setIsUploading(false);
              return;
            }

            const response = await fetch("/api/transcribe-audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64Data, mimeType: actualMimeType })
            });
            const result = await response.json();
            if (result.text) {
              setInputText(prev => prev + (prev ? " " : "") + result.text);
            }
            setIsUploading(false);
          };
        } catch (error) {
          console.error("Audio processing error", error);
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.warn("Microphone access denied or not available", err);
      alert("Please allow microphone access to use voice input.");
    }
  };

  // Auto scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend = inputText) => {
    if (!textToSend.trim()) return;

    if (!currentUser?.uid) {
      alert("You must be logged in to send messages.");
      return;
    }
    const userId = currentUser.uid;

    // Add user message
    const newMessage: ChatSessionMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      const title = textToSend.split(' ').slice(0, 4).join(' ') + (textToSend.split(' ').length > 4 ? '...' : '');
      targetSessionId = await createChatSession(userId, title, newMessage);
      if (targetSessionId) {
        setCurrentSessionId(targetSessionId);
      }
    } else {
      await appendMessageToSession(targetSessionId, newMessage);
    }

    if (textToSend === inputText) setInputText('');

    // Trigger AI response typing simulation
    setIsTyping(true);

    const appendAiMessage = async (text: string) => {
      if (targetSessionId) {
        await appendMessageToSession(targetSessionId, {
          role: 'ai',
          content: text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    };

    if (pendingConfirmation) {
      try {
        const evalResponse = await fetch("/api/evaluate-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: textToSend, conflictingItem: pendingConfirmation.conflictingItem })
        });
        const evalResult = await evalResponse.json();
        
        if (evalResult.intent === "confirmed") {
          await appendAiMessage("Great, I'll schedule it at that time.");
          if (targetSessionId) {
            await finalizeTaskCreation(
              pendingConfirmation.task, 
              pendingConfirmation.taskData, 
              pendingConfirmation.scheduleItems, 
              pendingConfirmation.prefs,
              targetSessionId,
              appendAiMessage
            );
          }
          setPendingConfirmation(null);
          setIsTyping(false);
          return;
        } else if (evalResult.intent === "declined") {
          await appendAiMessage(evalResult.reply || "Okay, what time would work better for you?");
          setPendingConfirmation(null);
          setIsTyping(false);
          return;
        } else if (evalResult.intent === "declined_with_new_time") {
          await appendAiMessage(`Got it, I'll update the time based on your request: "${evalResult.newTime || textToSend}". Re-evaluating...`);
          setPendingConfirmation(null);
          // Fall through to normal chat processing so the new time can be extracted as a new task context
        }
      } catch (err) {
         console.error("Evaluation error", err);
         setPendingConfirmation(null);
      }
    }

    try {
      // Create history context (last 4 messages) to send to API
      const historyCtx = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));

      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, history: historyCtx }),
      });

      if (!chatResponse.ok) {
        throw new Error("Failed to get response from Gemini");
      }

      const result = await chatResponse.json();

      setIsTyping(false);

      if (result.type === "delete_task") {
        const allTasks = await getTasksByUser(userId);
        if (allTasks.length > 0 && result.taskQuery) {
          const query = result.taskQuery.toLowerCase();
          // Find matching task by title or description, fallback to most recently created
          let matchedTask = allTasks.find(t => 
            t.title.toLowerCase().includes(query) || 
            (t.description && t.description.toLowerCase().includes(query))
          );
          
          if (!matchedTask) {
            // Sort by createdAt descending, if available, otherwise just use the last one in the array (assuming firestore returns in some order, though usually we'd sort by createdAt)
            matchedTask = allTasks.sort((a, b) => {
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return dateB - dateA;
            })[0];
          }

          if (matchedTask && matchedTask.id) {
            await deleteScheduleItemsForTask(matchedTask.id);
            await deleteTask(matchedTask.id);
            
            // Clean up Google Calendar events if any
            const prefs = await getUserPrefs(userId);
            if (googleAccessToken && prefs?.googleCalendarSync !== false) {
              const validToken = await getValidGoogleAccessToken();
              if (validToken) {
                if (matchedTask.googleEventIds && matchedTask.googleEventIds.length > 0) {
                  for (const eventId of matchedTask.googleEventIds) {
                    await deleteEventFromGoogleCalendar(validToken, eventId).catch(e => console.error(e));
                  }
                } else if (matchedTask.googleEventId) {
                  await deleteEventFromGoogleCalendar(validToken, matchedTask.googleEventId).catch(e => console.error(e));
                }
              }
            }

            const reply = result.reply || `I've canceled the task "${matchedTask.title}" and removed it from your schedule.`;
            await appendAiMessage(reply);
          } else {
            await appendAiMessage("I couldn't find the task you wanted to delete.");
          }
        } else {
          await appendAiMessage("I couldn't find any tasks to delete.");
        }
      } else if (result.type === "chat" || !result.tasks || result.tasks.length === 0) {
        // Normal casual chat
        const reply = result.reply || result.text || "I'm not sure how to process that task. Could you please provide more details?";
        await appendAiMessage(reply);
      } else {
        // It's one or more tasks!
        for (const task of result.tasks) {
          const formattedDeadline = task.deadline ? new Date(task.deadline + "T23:59:59") : new Date();
          const taskData = {
            title: task.title || "Untitled Task",
            description: task.description || `Extracted from chat: "${textToSend}"`,
            deadline: formattedDeadline,
            estimatedEffort: Number(task.estimatedEffort) || 60,
            priority: (task.priority || "medium") as "low" | "medium" | "high" | "urgent" | "critical",
            category: task.category || "General",
            status: "pending" as const,
            subtasks: (task.subtasks && task.subtasks.length > 0 ? task.subtasks : [{ title: task.title || "Complete Task", estimatedMinutes: Number(task.estimatedEffort) || 60 }]).map((st: any) => ({
              title: st.title || "Untitled Subtask",
              estimatedMinutes: Number(st.estimatedMinutes) || 15,
              completed: false
            }))
          };

          // Fetch user preferences
          const prefs = await getUserPrefs(userId);
          const availableHours = prefs?.availableHoursPerDay || 6;
          const aiOptimizationMode = prefs?.aiOptimizationMode ?? true;

          // Fetch existing schedule
          const existingSchedule = await getScheduleByUser(userId);

          // Trigger schedule planner
          setIsTyping(true);

          const scheduleResponse = await fetch("/api/schedule-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subtasks: taskData.subtasks,
              estimatedEffort: taskData.estimatedEffort,
              availableHoursPerDay: availableHours,
              aiOptimizationMode,
              existingSchedule,
              originalMessage: textToSend,
              deadline: task.deadline || new Date().toISOString().split('T')[0],
              currentDate: new Date().toISOString().split('T')[0]
            }),
          });

          setIsTyping(false);

          if (!scheduleResponse.ok) {
            const errBody = await scheduleResponse.json().catch(() => ({}));
            throw new Error(errBody.error || "Failed to generate schedule from Gemini");
          }

          const scheduleItems = await scheduleResponse.json();

          // Check if any schedule items fall outside focus hours
          let outsideFocusHours = false;
          let conflictingItem = null;

          if (prefs?.workingHoursStart && prefs?.workingHoursEnd) {
             for (const item of scheduleItems) {
                if (item.startTime < prefs.workingHoursStart || item.endTime > prefs.workingHoursEnd) {
                   outsideFocusHours = true;
                   conflictingItem = item;
                   break;
                }
             }
          }

          if (outsideFocusHours && conflictingItem) {
             setPendingConfirmation({
                task,
                taskData,
                scheduleItems,
                conflictingItem,
                prefs
             });
             await appendAiMessage(`Your focus hours are set to ${prefs.workingHoursStart}–${prefs.workingHoursEnd}, but this task would need to be scheduled at ${conflictingItem.startTime} on ${conflictingItem.date}, which is outside that window. Are you available at ${conflictingItem.startTime}?`);
             // Only process one task if it conflicts to avoid multiple confirmations at once
             break;
          }

          if (targetSessionId) {
             // If inside focus hours, proceed normally
             await finalizeTaskCreation(task, taskData, scheduleItems, prefs, targetSessionId, appendAiMessage);
          }
        }
      }
    } catch (err: any) {
      setIsTyping(false);
      await appendAiMessage(`Error processing request: ${err.message || String(err)}`);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied message text to clipboard.');
  };

  const [searchQuery, setSearchQuery] = useState('');

  const exportChat = () => {
    if (messages.length === 0) {
      alert("No messages to export.");
      return;
    }

    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text("Chat Export", 20, y);
      y += 10;
      doc.setFontSize(12);

      messages.forEach((msg) => {
        const sender = msg.role === 'user' ? 'User' : 'AI Assistant';
        doc.setFont("helvetica", "bold");
        doc.text(`${sender} (${msg.timestamp})`, 20, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        
        const lines = doc.splitTextToSize(msg.content, 170);
        doc.text(lines, 20, y);
        y += (lines.length * 7) + 5;

        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      });

      doc.save(`chat-export-${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  };

  return (
    <div className="bg-background text-on-surface flex h-screen overflow-hidden pl-0 md:pl-[260px] relative transition-colors duration-200">
      
      {/* Grid container spanning conversation left list pane + right chat history pane */}
      <div className="flex-1 flex flex-col md:flex-row items-stretch min-h-0">
        
        {/* Left Side: Sessions List */}
        <aside className="w-full md:w-64 border-r border-outline-variant bg-surface-container-low flex flex-col hidden md:flex shrink-0 min-h-0">
          <div className="p-4 border-b border-outline-variant flex flex-col gap-3 shrink-0">
            <button 
              onClick={() => setCurrentSessionId(null)}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-bold text-xs shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              + New Chat
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-on-surface-variant" size={14} />
              <input 
                type="text" 
                placeholder="Search chats..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-colors h-[34px]"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
            {sessions
              .filter(s => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                if (s.title && s.title.toLowerCase().includes(q)) return true;
                if (s.messages && s.messages.some(m => m.content.toLowerCase().includes(q))) return true;
                return false;
              })
              .map(session => (
              <button
                key={session.id}
                onClick={() => setCurrentSessionId(session.id || null)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer flex justify-between items-start gap-2 ${currentSessionId === session.id ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface hover:bg-surface-variant/50'}`}
              >
                <span className="truncate flex-1 font-medium text-xs mt-0.5">{session.title || 'New Chat'}</span>
                <span className="text-[10px] text-on-surface-variant opacity-70 whitespace-nowrap mt-1 font-mono">
                  {session.updatedAt?.toMillis ? (() => {
                     const diff = Date.now() - session.updatedAt.toMillis();
                     if (diff < 60000) return 'Just now';
                     if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
                     if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
                     return new Date(session.updatedAt.toMillis()).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  })() : ''}
                </span>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="p-6 text-xs text-center text-on-surface-variant font-medium">No previous chats</div>
            )}
          </div>
        </aside>

        {/* Right Side: Primary Chat Section */}
        <section className="flex-1 flex flex-col bg-background min-h-0">
          
          {/* Active Chat Header */}
          <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-8 py-5 border-b border-outline-variant flex justify-between items-center transition-all duration-200">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-on-surface select-none">
                  Chat Section
                </h2>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="flex items-center gap-1.5 px-2 py-1.5 -ml-2 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer select-none rounded-lg hover:bg-surface-variant/50 active:bg-surface-variant"
                  >
                    <span>{selectedModel}</span>
                    <ChevronDown size={14} />
                  </button>
                  {/* Dropdown */}
                  {isModelDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 bg-transparent" 
                        onClick={() => setIsModelDropdownOpen(false)}
                      />
                      <div className="absolute top-full left-0 mt-2 w-56 bg-surface-container border border-outline-variant rounded-xl shadow-xl transition-all z-50 overflow-hidden">
                        {['Gemini 2.0 Flash', 'Gemini 1.5 Pro', 'Gemini 1.5 Flash'].map(m => (
                          <button 
                            key={m} 
                            type="button"
                            onClick={() => {
                              setSelectedModel(m);
                              setIsModelDropdownOpen(false);
                            }} 
                            className={`w-full text-left px-4 py-3.5 text-sm hover:bg-surface-variant cursor-pointer ${selectedModel === m ? 'text-primary font-bold bg-surface-container-high' : 'text-on-surface'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Interact with the AI assistant for planning and scheduling.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={exportChat}
                className="p-2.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors cursor-pointer border border-outline-variant/20 bg-surface-container-low"
                title="Download Chat as PDF"
              >
                <Download size={16} />
              </button>
            </div>
          </header>

          {/* Chat scroll content window */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar">
            
            {/* Center Header Greeting */}
            {messages.length === 0 && (
              <div className="text-center py-12 select-none max-w-lg mx-auto mb-8 mt-16">
                <Sparkles className="mx-auto text-primary mb-6 w-10 h-10" />
                <h4 className="text-3xl font-bold text-on-surface tracking-tight">How can I accelerate your project?</h4>
                <p className="text-sm text-on-surface-variant mt-3">Ask questions, sync schedules, or automate Jira creation.</p>
              </div>
            )}

            {/* Messages balloon logs */}
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div id={`message-${idx}`} key={idx} className={`flex gap-4 w-full max-w-3xl transition-colors duration-500 ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                  
                  {/* Portrait Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 select-none overflow-hidden ${
                    isUser ? 'border border-primary/40 bg-surface-container' : 'bg-primary/25 text-primary flex items-center justify-center'
                  }`}>
                    {isUser ? (
                      currentUser?.photoURL ? (
                        <img 
                          className="w-full h-full object-cover" 
                          alt={currentUser.displayName || "User"} 
                          referrerPolicy="no-referrer"
                          src={currentUser.photoURL}
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-container text-primary flex items-center justify-center font-bold text-xs uppercase">
                          {(currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )
                    ) : (
                      <Sparkles size={14} className="animate-pulse" />
                    )}
                  </div>

                  {/* Message container */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[10px] font-bold text-on-surface/95 uppercase tracking-wide">
                        {isUser ? (currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User') : 'AI Assistant'}
                      </span>
                      <span className="text-[9px] text-on-surface-variant">{m.timestamp}</span>
                    </div>

                    <div className={`p-4 rounded-xl text-sm leading-relaxed border shadow-sm ${
                      isUser 
                        ? 'bg-surface-container border-outline-variant text-on-surface' 
                        : 'bg-surface-container-low border-outline-variant/60 text-on-surface whitespace-pre-line'
                    }`}>
                      {m.content}
                    </div>

                    {/* Action controls for AI message only */}
                    {!isUser && (
                      <div className="flex items-center gap-1 mt-1 select-none">
                        <button 
                          onClick={() => alert('Thanks for the feedback.')}
                          className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Like response"
                        >
                          <ThumbsUp size={12} />
                        </button>
                        <button 
                          onClick={() => alert('Thanks for the feedback.')}
                          className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Dislike response"
                        >
                          <ThumbsDown size={12} />
                        </button>
                        <button 
                          onClick={() => handleCopy(m.content)}
                          className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Copy text"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}

            {/* Typing status loader overlay */}
            {isTyping && (
              <div className="flex gap-4 w-full max-w-3xl mr-auto">
                <div className="w-8 h-8 rounded-full bg-primary/25 text-primary flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Sparkles size={14} />
                </div>
                <div className="space-y-1 flex-1">
                  <span className="text-[10px] font-bold text-on-surface/95 uppercase tracking-wide">AI Assistant</span>
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface inline-block shadow-sm">
                    <div className="flex gap-1.5 py-1">
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce delay-100"></div>
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce delay-200"></div>
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce delay-300"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input Panel container */}
          <div className="p-6 border-t border-outline-variant bg-surface-container-low">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-center border border-outline rounded-xl bg-background overflow-hidden focus-within:border-primary transition-colors pr-2"
            >
              <div className="flex gap-1 pl-2 select-none">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*,text/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                    e.target.value = '';
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 cursor-pointer"
                >
                  <Paperclip size={16} />
                </button>
                <input 
                  type="file" 
                  ref={cameraInputRef}
                  className="hidden" 
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                    e.target.value = '';
                  }}
                />
                <button 
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 cursor-pointer"
                >
                  <Camera size={16} />
                </button>
              </div>

              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim() && !isUploading) {
                      handleSend();
                    }
                  }
                }}
                placeholder={isUploading ? "Extracting text..." : isListening ? "Listening... (Click mic to stop)" : "Message AI..."} 
                disabled={isUploading}
                className="flex-1 py-4 px-3 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-50 resize-none min-h-[52px] max-h-32"
                rows={1}
              />

              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`p-2 rounded-full hover:bg-surface-variant/50 cursor-pointer ${isListening ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  {isListening ? <div className="w-2.5 h-2.5 rounded-sm bg-red-500 m-[3px]"></div> : <Mic size={16} />}
                </button>
                <button 
                  type="submit"
                  disabled={!inputText.trim() || isUploading}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    inputText.trim() && !isUploading
                      ? 'bg-primary border-primary text-on-primary hover:opacity-95' 
                      : 'bg-surface border-outline-variant text-on-surface-variant/45 cursor-not-allowed'
                  }`}
                >
                  <Send size={15} />
                </button>
              </div>
            </form>

            <p className="text-[10px] text-center text-on-surface-variant mt-3 font-semibold">
              AI can make mistakes. Verify important project data.
            </p>
          </div>

        </section>

      </div>

    </div>
  );
}
