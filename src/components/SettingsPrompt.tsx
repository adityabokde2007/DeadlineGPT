import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserPrefs, saveUserPrefs, UserPrefs } from '../services/firestoreService';
import toast from 'react-hot-toast';
import { Settings, X } from 'lucide-react';

export default function SettingsPrompt({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { currentUser } = useAuth();
  
  const hasCheckedRef = React.useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    
    let isSubscribed = true;
    const checkPrefs = async () => {
      try {
        const prefs = await getUserPrefs(currentUser.uid);
        if (isSubscribed && (!prefs || !prefs.hasSeenSettingsPrompt)) {
          showToastAndSave(prefs);
        }
      } catch (err) {
        console.error("Error checking settings prompt state:", err);
      }
    };
    
    const showToastAndSave = async (prefs: UserPrefs | null) => {
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-surface rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-outline pointer-events-auto flex overflow-hidden`}
        >
          <div className="w-1.5 bg-primary"></div>
          
          <div className="flex-1 p-4 sm:p-5 flex items-start gap-4">
            <div className="flex-shrink-0 bg-primary/10 text-primary p-2.5 rounded-full">
              <Settings size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1 pt-0.5">
              <h3 className="text-sm font-bold text-on-surface tracking-tight mb-1">
                Customize your experience
              </h3>
              <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                Set your working hours, calendar sync, and smart AI optimization to get the most out of DeadlineGPT.
              </p>
              
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    onOpenSettings();
                  }}
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Configure Now
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-4 py-2 bg-surface-container text-on-surface text-xs font-bold rounded-lg hover:bg-surface-variant transition-colors border border-outline"
                >
                  Maybe Later
                </button>
              </div>
            </div>
            
            <button
              onClick={() => toast.dismiss(t.id)}
              className="flex-shrink-0 p-1.5 rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors mt-[-4px] mr-[-4px]"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ), { duration: 8000 });
      
      const updatedPrefs: UserPrefs = prefs || {
        availableHoursPerDay: 6,
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00'
      };
      
      updatedPrefs.hasSeenSettingsPrompt = true;
      await saveUserPrefs(currentUser.uid, updatedPrefs);
    };

    checkPrefs();

    return () => {
      isSubscribed = false;
    };
  }, [currentUser]); // Removed onOpenSettings to prevent infinite loops if it changes

  return null;
}
