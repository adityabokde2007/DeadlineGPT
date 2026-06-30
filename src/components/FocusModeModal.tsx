import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  Coffee,
  Target,
  ArrowLeft,
} from "lucide-react";
import { Task } from "../services/firestoreService";

interface FocusModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onCompleteTask: (taskId: string) => void;
}

type SessionState = "work" | "break";

export default function FocusModeModal({
  isOpen,
  onClose,
  task,
  onCompleteTask,
}: FocusModeModalProps) {
  const WORK_TIME = 25 * 60; // 25 minutes in seconds
  const BREAK_TIME = 5 * 60; // 5 minutes in seconds

  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("work");
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const wasActiveRef = useRef(false);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (sessionState === "work") {
        setIsActive(false);
        setSessionState("break");
        setTimeLeft(BREAK_TIME);
      } else {
        setIsActive(false);
        setSessionState("work");
        setTimeLeft(WORK_TIME);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, sessionState]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasActiveRef.current = isActive;
        if (isActive) setIsActive(false);
      } else {
        if (wasActiveRef.current) {
          setShowWelcomeBack(true);
          setTimeout(() => setShowWelcomeBack(false), 4000);
          setIsActive(true);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOpen, isActive]);

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setTimeLeft(WORK_TIME);
      setIsActive(false);
      setSessionState("work");
      setShowWelcomeBack(false);
      wasActiveRef.current = false;
    }
  }, [isOpen]);

  const toggleTimer = () => setIsActive(!isActive);

  const handleEndSession = () => {
    setIsActive(false);
    onClose();
  };

  const handleMarkComplete = () => {
    if (task?.id) {
      onCompleteTask(task.id);
      handleEndSession();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalTime = sessionState === "work" ? WORK_TIME : BREAK_TIME;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  if (!isOpen || !task) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface backdrop-blur-xl">
        {/* Back Button */}
        <button
          onClick={handleEndSession}
          className="absolute top-6 left-6 z-[60] p-3 rounded-full hover:bg-surface-variant transition-colors text-on-surface flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={24} />
          <span className="font-medium text-sm hidden sm:inline">Back</span>
        </button>

        {/* Welcome Back Overlay */}
        <AnimatePresence>
          {showWelcomeBack && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2"
            >
              <Target size={18} />
              Welcome back! Stay focused — you've got this.
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl p-8 flex flex-col items-center justify-center text-center"
        >
          {sessionState === "break" && !isActive && timeLeft === BREAK_TIME && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 text-2xl font-bold text-primary flex items-center gap-2"
            >
              <Coffee size={28} />
              Time for a break!
            </motion.div>
          )}

          <div className="mb-12 max-w-lg">
            <h2 className="text-3xl font-bold text-on-surface mb-4 leading-tight">
              {task.title}
            </h2>
            {task.description && (
              <p className="text-on-surface-variant text-lg line-clamp-3">
                {task.description}
              </p>
            )}
          </div>

          {/* Timer Display */}
          <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                strokeWidth="8"
                className="stroke-surface-variant"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={`transition-all duration-1000 ease-linear ${sessionState === "work" ? "stroke-primary" : "stroke-secondary"}`}
                strokeDasharray={120 * 2 * Math.PI}
                strokeDashoffset={120 * 2 * Math.PI * (1 - progress / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-mono font-bold tracking-tight text-on-surface">
                {formatTime(timeLeft)}
              </span>
              <span className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mt-2">
                {sessionState}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTimer}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg ${
                isActive
                  ? "bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80"
                  : "bg-primary text-on-primary hover:opacity-90"
              }`}
            >
              {isActive ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1" />
              )}
            </button>

            <button
              onClick={handleEndSession}
              className="w-16 h-16 rounded-full bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80 flex items-center justify-center transition-colors shadow-lg"
              title="End Session"
            >
              <Square size={20} fill="currentColor" />
            </button>
          </div>

          <div className="mt-12">
            <button
              onClick={handleMarkComplete}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary hover:opacity-90 transition-opacity font-medium shadow-md cursor-pointer"
            >
              <CheckCircle2 size={20} />
              Mark Task Complete
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
