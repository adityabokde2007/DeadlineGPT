import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Sparkles, Clock } from 'lucide-react';
import { Task, createTask } from '../services/firestoreService';
import toast from 'react-hot-toast';

interface GeneratedSubtask {
  title: string;
  estimatedMinutes: number;
}

interface TaskBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  generatedSubtasks: GeneratedSubtask[];
  isGenerating: boolean;
  onAddSubtasks: (subtasks: GeneratedSubtask[]) => void;
  isAdding: boolean;
}

export default function TaskBreakdownModal({ 
  isOpen, 
  onClose, 
  task, 
  generatedSubtasks,
  isGenerating,
  onAddSubtasks,
  isAdding
}: TaskBreakdownModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface relative z-10 w-full max-w-md rounded-3xl overflow-hidden shadow-xl border border-outline-variant/30 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-outline-variant/30 flex items-start justify-between bg-surface-container-low/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-primary" />
                <h2 className="text-xl font-bold text-on-surface">AI Task Breakdown</h2>
              </div>
              <p className="text-sm text-on-surface-variant line-clamp-1">
                Breakdown for: <span className="font-medium text-on-surface">{task.title}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface hover:bg-surface-variant flex items-center justify-center text-on-surface-variant transition-colors shadow-sm cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 size={32} className="text-primary animate-spin mb-4" />
                <p className="text-sm font-medium text-on-surface">Gemini is analyzing your task...</p>
                <p className="text-xs text-on-surface-variant mt-1">Creating actionable subtasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedSubtasks.map((subtask, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={index} 
                    className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 group hover:border-primary/50 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface">{subtask.title}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-on-surface-variant font-medium">
                        <Clock size={12} />
                        <span>{subtask.estimatedMinutes} mins</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {generatedSubtasks.length === 0 && !isGenerating && (
                  <div className="text-center py-8 text-sm text-on-surface-variant">
                    No subtasks generated. Try regenerating.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!isGenerating && (
            <div className="p-6 border-t border-outline-variant/30 bg-surface-container-low flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isAdding}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-surface text-on-surface border border-outline-variant hover:bg-surface-variant transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onAddSubtasks(generatedSubtasks)}
                disabled={isAdding || generatedSubtasks.length === 0}
                className="flex-[2] py-3 px-4 rounded-xl font-bold text-sm bg-primary text-on-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
              >
                {isAdding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Add to My Tasks
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
