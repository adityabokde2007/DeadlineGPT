import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-outline-variant bg-background w-full py-8">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 max-w-7xl mx-auto text-xs text-on-surface-variant font-medium tracking-wide">
        <div className="mb-4 md:mb-0">
          <p>© 2026 DeadlineGPT. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <a href="#privacy" className="hover:text-on-surface transition-colors">Privacy Policy</a>
          <a href="#terms" className="hover:text-on-surface transition-colors">Terms of Service</a>
          <a href="#cookie" className="hover:text-on-surface transition-colors">Cookie Settings</a>
          <a href="#contact" className="hover:text-on-surface transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
