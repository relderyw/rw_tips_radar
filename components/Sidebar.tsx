
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Swords, Radio, ArrowRight } from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Visão Geral', icon: <LayoutDashboard size={20} /> },
    { path: '/live', label: 'Ao Vivo', icon: <Radio size={20} className={location.pathname === '/live' ? 'animate-pulse' : ''} /> },
    { path: '/players', label: 'Métricas de Players', icon: <Users size={20} /> },
    { path: '/h2h', label: 'Head to Head', icon: <Swords size={20} /> },
  ];

  return (
    <>
        {/* Mobile Overlay */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            />
        )}

        {/* Sidebar com expansão ao hover (desktop) e abertura via estado (mobile) */}
        <aside
          className={`group fixed top-0 left-0 z-50 h-screen bg-surface border-r border-white/5 transition-all duration-300 ease-in-out overflow-hidden
            ${isOpen ? 'w-64' : 'w-0 md:w-20 md:hover:w-64'}`}
        >
          {/* Header com logo e título exibido ao hover */}
          <div className="h-16 flex items-center gap-3 px-3 border-b border-white/5">
            <img src="/logo.png" alt="RW Tips" className="w-10 h-10 rounded-full flex-shrink-0" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate
              opacity-0 transition-opacity duration-300 md:group-hover:opacity-100">
              RW TIPS
            </h1>
          </div>

          <nav className="mt-6 px-3 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-gradient-to-r from-accent/20 to-transparent text-accent border-l-4 border-accent'
                      : 'text-textMuted hover:bg-white/5 hover:text-textMain'}
                  `}
                  title={item.label}
                >
                  <span className={`${isActive ? 'text-accent' : 'text-textMuted group-hover:text-textMain'}`}>
                    {item.icon}
                  </span>
                  <span className={`whitespace-nowrap transition-opacity duration-200
                    ${isOpen ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* Botão externo para Visualization */}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                try {
                  const token = localStorage.getItem('authToken');
                  const expiry = localStorage.getItem('tokenExpiry');
                  const base = 'https://rwtips.netlify.app/visualization.html';
                  let url = base;
                  if (token && expiry) {
                    url = `${base}?auth=${encodeURIComponent(token)}&expiry=${encodeURIComponent(expiry)}`;
                  }
                  window.open(url, '_blank', 'noopener');
                } catch (err) {
                  // Fallback: abre sem parâmetros
                  window.open('https://rwtips.netlify.app/visualization.html', '_blank', 'noopener');
                }
              }}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-textMuted hover:bg-white/5 hover:text-textMain`}
              title="Visualization"
            >
              <span className={`text-textMuted group-hover:text-textMain`}>
                <ArrowRight size={20} />
              </span>
              <span className={`whitespace-nowrap transition-opacity duration-200
                ${isOpen ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
              >
                Visualization
              </span>
            </a>
          </nav>
        </aside>
    </>
  );
};
