import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Calendar, 
  MessageSquare, 
  BarChart2, 
  Settings, 
  LogOut,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export default function Sidebar({ 
  isOpen = false,
  onClose,
  onOpenSettings,
  onOpenHelp
}: SidebarProps) {
  const { currentUser, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const location = useLocation();
  const path = location.pathname;

  type NavItem = {
    name: string;
    path: string;
    icon: any;
    shortcut?: string;
    action?: () => void;
    hash?: string;
  };

  const navItems: NavItem[] = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard, shortcut: '1' },
    { name: 'Calendar', path: '/calendar', icon: Calendar, shortcut: '2' },
    { name: 'Chat', path: '/chat', icon: MessageSquare, shortcut: '3' },
    { name: 'Analytics', path: '/analytics', icon: BarChart2, shortcut: '4' },
    { name: 'Settings', path: '#settings', icon: Settings, action: onOpenSettings },
  ];

  const handleItemClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.action) {
      e.preventDefault();
      item.action();
    } else if (item.hash && path === item.path) {
      // If we are already on the current path, prevent default navigation and scroll smoothly
      const el = document.getElementById(item.hash.replace('#', ''));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" 
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed left-0 top-0 h-full w-[260px] bg-surface-container-low border-r border-outline-variant flex flex-col p-4 z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <button 
          onClick={onClose} 
          className="md:hidden absolute top-4 right-4 p-2 text-on-surface hover:bg-surface-variant rounded-full"
        >
          <X size={20} />
        </button>

        {/* Brand Logotype */}
        <div className="px-2 py-4 mb-4 flex items-center justify-start">
          <Link to="/" className="hover:opacity-90 transition-opacity" onClick={onClose}>
            <span className="text-xl font-extrabold tracking-tight font-sans select-none">
              <span className="text-on-surface">Deadline</span>
              <span className="text-[#e07a5f]">GPT</span>
            </span>
          </Link>
        </div>

      {/* Navigation menu items */}
      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.hash 
            ? path === item.path && location.hash === item.hash
            : path === item.path && !location.hash;

          const content = (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-on-secondary-container' : 'text-on-surface-variant group-hover:text-primary transition-colors'} />
                <span className="text-sm text-inherit font-medium">{item.name}</span>
              </div>
              {item.shortcut && (
                <kbd className={`hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-medium rounded shadow-sm ${isActive ? 'text-on-secondary-container bg-on-secondary-container/10' : 'text-on-surface-variant bg-surface-variant/50'}`}>
                  <span className="text-[11px]">⌘</span>{item.shortcut}
                </kbd>
              )}
            </div>
          );

          if (item.action || item.path.startsWith('#')) {
            return (
              <button
                key={item.name}
                onClick={(e) => handleItemClick(e, item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150 group cursor-pointer ${
                  isActive 
                    ? 'bg-secondary-container text-on-secondary-container font-semibold' 
                    : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.name}
              to={item.hash ? `${item.path}${item.hash}` : item.path}
              onClick={(e) => handleItemClick(e, item)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 group ${
                isActive 
                  ? 'bg-secondary-container text-on-secondary-container font-semibold' 
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Dynamic User Profile Footer */}
      {currentUser && (
        <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/30 mt-auto">
          <div className="flex items-center gap-3 px-2 py-2">
            {currentUser.photoURL ? (
              <img 
                className="w-8 h-8 rounded-full border border-primary/40 object-cover bg-surface-container" 
                alt={`${currentUser.displayName || currentUser.email} Portrait`} 
                referrerPolicy="no-referrer"
                src={currentUser.photoURL}
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-primary/40 bg-surface-container text-primary flex items-center justify-center font-bold text-xs">
                {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-xs font-semibold truncate text-on-surface">
                {currentUser.displayName || currentUser.email?.split('@')[0] || 'DeadlineGPT User'}
              </p>
              <p className="text-[10px] text-on-surface-variant font-medium uppercase font-mono max-w-full truncate">
                {currentUser.email}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut size={14} className="text-red-500" />
            <span>Log Out</span>
          </button>
        </div>
      )}

      </aside>

      {/* Confirm Log Out Dialog Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col gap-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-1">
                <LogOut size={22} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-on-surface">Confirm Log Out</h3>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                Are you sure you want to log out? You will need to log back in to access your dashboard.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-variant text-on-surface hover:text-on-surface border border-outline-variant transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setShowLogoutConfirm(false);
                    await logout();
                  } catch (err) {
                    console.error("Logout failed:", err);
                  }
                }}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
