import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { saveUserPrefs, UserPrefs } from '../services/firestoreService';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { currentUser, userPrefs, googleAccessToken, connectGoogleCalendar } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [availableHoursPerDay, setAvailableHoursPerDay] = useState<number | ''>('');
  const [workingHoursStart, setWorkingHoursStart] = useState<string>('');
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string>('');
  const [aiOptimizationMode, setAiOptimizationMode] = useState<boolean>(true);

  // Sync with global userPrefs
  useEffect(() => {
    if (userPrefs !== undefined) {
      if (userPrefs) {
        setAvailableHoursPerDay(userPrefs.availableHoursPerDay ?? '');
        setWorkingHoursStart(userPrefs.workingHoursStart ?? '');
        setWorkingHoursEnd(userPrefs.workingHoursEnd ?? '');
        setAiOptimizationMode(userPrefs.aiOptimizationMode ?? true);
      }
      setIsLoading(false);
    }
  }, [userPrefs]);

  // Handle save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const updatedPrefs = {
        ...(userPrefs || {}),
        availableHoursPerDay: availableHoursPerDay === '' ? 6 : availableHoursPerDay,
        workingHoursStart,
        workingHoursEnd,
        aiOptimizationMode
      } as UserPrefs;
      await saveUserPrefs(currentUser.uid, updatedPrefs);
      toast.success("Settings saved successfully!");
      onClose();
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
        
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <RefreshCw size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">Workspace Settings</h3>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">Manage credentials, APIs, and calendars.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Toggles from original UI */}
            <div className="space-y-3">
              <div className="p-3.5 bg-surface rounded-lg border border-outline-variant flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-on-surface">AI Smart Optimization Mode</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">Suggest optimal times based on output trends.</p>
                </div>
                <div 
                  className={`w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer transition-colors ${aiOptimizationMode ? 'bg-primary justify-end' : 'bg-outline-variant justify-start'}`}
                  onClick={() => setAiOptimizationMode(!aiOptimizationMode)}
                >
                  <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm">
                    {aiOptimizationMode && <Check size={10} className="text-primary" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Firestore User Preferences Fields */}
            <div className="border-t border-outline-variant/50 pt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5 uppercase tracking-wider">Max Daily Focus Time (Hours)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="24"
                  required
                  value={availableHoursPerDay}
                  onChange={(e) => setAvailableHoursPerDay(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="e.g. 6"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5 uppercase tracking-wider">Focus Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={workingHoursStart}
                    onChange={(e) => setWorkingHoursStart(e.target.value)}
                    placeholder="Select start time"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5 uppercase tracking-wider">Focus End Time</label>
                  <input 
                    type="time" 
                    required
                    value={workingHoursEnd}
                    onChange={(e) => setWorkingHoursEnd(e.target.value)}
                    placeholder="Select end time"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSaving}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold text-sm tracking-wide shadow-md hover:opacity-95 active:scale-95 transition-all mt-2 cursor-pointer flex justify-center items-center gap-2"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              {isSaving ? "Saving changes..." : "Save Settings"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
