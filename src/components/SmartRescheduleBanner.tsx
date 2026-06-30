import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, Check, X, Loader2, Sparkles } from 'lucide-react';
import { Task } from '../services/firestoreService';
import toast from 'react-hot-toast';

interface SmartRescheduleBannerProps {
  task: Task;
  onConfirm: (newDate: Date) => void;
  onDismiss: () => void;
  otherTasks: Task[];
}

export default function SmartRescheduleBanner({ task, onConfirm, onDismiss, otherTasks }: SmartRescheduleBannerProps) {
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSuggestion = async () => {
      setIsLoading(true);
      try {
        const minimalOtherTasks = otherTasks
          .filter(t => t.id !== task.id && t.status !== 'completed')
          .map(t => ({ title: t.title, deadline: t.deadline?.toString() }));

        const response = await fetch('/api/suggest-reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskTitle: task.title,
            originalDate: task.deadline?.toString(),
            priority: task.priority,
            otherTasks: minimalOtherTasks.slice(0, 5) // Send up to 5 tasks for context
          })
        });

        if (!response.ok) throw new Error('Failed to get suggestion');
        
        const data = await response.json();
        if (data.suggestedDate && isMounted) {
          setSuggestedDate(new Date(data.suggestedDate));
        }
      } catch (error) {
        console.error('Error fetching reschedule suggestion:', error);
        // Fallback: tomorrow at same time (or 10 AM if no time)
        if (isMounted) {
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + 1);
          fallback.setHours(10, 0, 0, 0); // Default to 10 AM
          setSuggestedDate(fallback);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSuggestion();

    return () => {
      isMounted = false;
    };
  }, [task]);

  const handleConfirm = async () => {
    if (!suggestedDate) return;
    setIsConfirming(true);
    try {
      await onConfirm(suggestedDate);
    } catch (e) {
      toast.error('Failed to reschedule');
    } finally {
      setIsConfirming(false);
    }
  };

  const formatSuggestedTime = (date: Date) => {
    const isTomorrow = new Date(date).getDate() === new Date().getDate() + 1;
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isTomorrow) {
      return `Tomorrow at ${timeStr}`;
    }
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
      className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary shrink-0" />
        <div className="text-xs text-on-surface">
          <span className="font-semibold">Smart Reschedule: </span>
          {isLoading ? (
            <span className="text-on-surface-variant flex items-center gap-1 inline-flex">
              <Loader2 size={10} className="animate-spin" /> analyzing schedule...
            </span>
          ) : suggestedDate ? (
            <span>Move to {formatSuggestedTime(suggestedDate)}?</span>
          ) : (
            <span>Could not generate suggestion.</span>
          )}
        </div>
      </div>
      
      {!isLoading && suggestedDate && (
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <button
            onClick={onDismiss}
            disabled={isConfirming}
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-variant/50 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-1 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isConfirming ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Confirm
          </button>
        </div>
      )}
    </motion.div>
  );
}
