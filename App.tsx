
import React, { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import DevToolsProtection from './components/DevToolsProtection';
import { Overview } from './views/Overview';
import { PlayerMetrics } from './views/PlayerMetrics';
import { H2H } from './views/H2H';
import { LiveGames } from './views/LiveGames';
import { OverAnalysis } from './views/OverAnalysis';
import { NBAStats } from './views/NBAStats';
import { Menu } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { loading } = useApp();

  return (
    <div className="min-h-screen bg-background text-textMain flex">
       <DevToolsProtection />
       <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
       
       <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
          <header className="h-16 border-b border-white/5 bg-surface/50 backdrop-blur-sm sticky top-0 z-30 px-4 flex items-center justify-between">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-textMuted">
                  <Menu size={24} />
              </button>
              <div className="flex items-center gap-4">
                 {loading && <span className="text-accent text-sm animate-pulse">Atualizando dados...</span>}
                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-bold text-xs">
                     RW
                 </div>
              </div>
          </header>

          <div className="p-4 md:p-8 max-w-7xl mx-auto">
             {loading && !children ? (
                 <div className="flex h-[50vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-textMuted animate-pulse">Carregando mercado...</p>
                    </div>
                 </div>
             ) : (
                 children
             )}
          </div>
       </main>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <HashRouter>
         <Layout>
            <Routes>
               <Route path="/" element={<Overview />} />
               <Route path="/live" element={<LiveGames />} />
               <Route path="/players" element={<PlayerMetrics />} />
               <Route path="/h2h" element={<H2H />} />
               <Route path="/tendencias" element={<Tendencias />} />
            </Routes>
         </Layout>
      </HashRouter>
    </AppProvider>
  );
}

export default App;
```
