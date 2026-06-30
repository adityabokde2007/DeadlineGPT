import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CalendarView from './pages/CalendarView';
import ChatInterface from './pages/ChatInterface';
import Analytics from './pages/Analytics';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './protected/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import SettingsModal from './components/SettingsModal';
import SettingsPrompt from './components/SettingsPrompt';

// Custom Modals to expand application fidelity
import { X, Sparkles, RefreshCw, Layers, Check } from 'lucide-react';

function KeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case '1':
            e.preventDefault();
            navigate('/dashboard');
            break;
          case '2':
            e.preventDefault();
            navigate('/calendar');
            break;
          case '3':
            e.preventDefault();
            navigate('/chat');
            break;
          case '4':
            e.preventDefault();
            navigate('/analytics');
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return null;
}

export default function App() {
  const [activeModal, setActiveModal] = useState<'settings' | 'help' | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
  }, []);

  const triggerToast = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3500);
  };

  // Modal Handlers
  const openSettings = () => setActiveModal('settings');
  const openHelp = () => setActiveModal('help');
  const closeModal = () => setActiveModal(null);

  return (
    <BrowserRouter>
      <AuthProvider>
        <KeyboardShortcuts />
        <Toaster position="top-center" reverseOrder={false} />
        {/* Toast notifications */}
        {notification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-55 bg-[#ffb688] text-neutral-900 border border-outline px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold text-xs animate-in fade-in zoom-in duration-305">
            <Sparkles size={14} className="text-neutral-900 fill-neutral-900/10" />
            <span>{notification}</span>
          </div>
        )}

        {/* Main App Canvas wrapper */}
        <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans transition-colors duration-200">
          <Routes>
            {/* Landing Route does NOT contain standard sidebar */}
            <Route path="/" element={<Landing />} />

            {/* Standard dashboard & workspace workspace logs */}
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <SettingsPrompt onOpenSettings={openSettings} />
                  <div className="flex-1 min-h-screen relative flex flex-col md:flex-row">
                    {/* Mobile Header */}
                    <div className="md:hidden flex items-center justify-between p-4 bg-surface-container-low border-b border-outline-variant sticky top-0 z-30">
                      <span className="text-xl font-extrabold tracking-tight font-sans select-none">
                        <span className="text-on-surface">Deadline</span>
                        <span className="text-[#e07a5f]">GPT</span>
                      </span>
                      <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 text-on-surface hover:bg-surface-variant rounded-full transition-colors">
                        <Layers size={24} />
                      </button>
                    </div>

                    {/* Responsive Navigation Sidebar */}
                    <Sidebar 
                      isOpen={sidebarOpen}
                      onClose={() => setSidebarOpen(false)}
                      onOpenSettings={openSettings}
                      onOpenHelp={openHelp}
                    />

                    <div className="w-full flex-1 min-w-0">
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/calendar" element={<CalendarView />} />
                        <Route path="/chat" element={<ChatInterface />} />
                        <Route path="/analytics" element={<Analytics />} />
                        {/* Fallback router */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </div>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>

      {/* Interactive Modals Overlays */}
      {activeModal === 'settings' && (
        <SettingsModal onClose={closeModal} />
      )}

      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={closeModal}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <h3 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-primary fill-primary/10" />
              DeadlineGPT Help Desk
            </h3>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed mb-4">
              Welcome to the professional workspace. Let's make sure you never miss what matters.
            </p>
            <div className="space-y-2 text-xs font-medium text-on-surface">
              <a href="#docs" className="block p-3 bg-surface hover:bg-surface-variant/40 border border-outline-variant rounded-lg transition-colors">Workspace Documentation & Shorts</a>
              <a href="#support" className="block p-3 bg-surface hover:bg-surface-variant/40 border border-outline-variant rounded-lg transition-colors">Contact Engineering Support Line</a>
              <a href="#shortcuts" className="block p-3 bg-surface hover:bg-surface-variant/40 border border-outline-variant rounded-lg transition-colors">Keyboard Shortcuts Guide</a>
            </div>
          </div>
        </div>
      )}
      </AuthProvider>
    </BrowserRouter>
  );
}
