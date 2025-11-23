import React, { useEffect } from 'react';

const DevToolsProtection: React.FC = () => {
  useEffect(() => {
    // ADMIN BYPASS: Check for URL param or LocalStorage flag
    // ADMIN BYPASS: Check for URL param or LocalStorage flag
    // Changed to check href because HashRouter puts params after the hash
    const isAdmin = window.location.href.includes('radar_sys_admin_x92=true') || localStorage.getItem('rw_radar_master') === 'true';
    if (isAdmin) {
        // Persist admin status so they don't need the param on every navigation
        localStorage.setItem('rw_radar_master', 'true');
        return;
    }

    // 1. Disable Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Disable Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault();
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'U') {
        e.preventDefault();
      }
    };

    // 3. Debugger Trap
    // This will pause execution if DevTools is open and breakpoints are active
    const debuggerTrap = setInterval(() => {
      (function() {
        debugger;
      })();
    }, 1000);

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(debuggerTrap);
    };
  }, []);

  return null; // This component doesn't render anything visible
};

export default DevToolsProtection;
