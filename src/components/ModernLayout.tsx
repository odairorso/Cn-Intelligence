import React from 'react';
import { 
  LayoutDashboard, Building2, Bell, Search, ChevronDown, FileText, TrendingUp, Shield
} from 'lucide-react';

interface ModernLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  uid: string;
}

export function ModernLayout({ children, activeTab, setActiveTab, uid }: ModernLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-50 flex font-sans text-zinc-900">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-zinc-200 p-4 hidden lg:flex flex-col">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold tracking-tighter">CN</div>
          <span className="font-bold text-zinc-900 text-lg tracking-tight">Intelligence</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'DASHBOARD' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('LANCAMENTOS')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'LANCAMENTOS' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'}`}
          >
            <FileText className="w-4 h-4" /> Lançamentos
          </button>
          <button 
            onClick={() => setActiveTab('FORNECEDORES')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'FORNECEDORES' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'}`}
          >
            <Building2 className="w-4 h-4" /> Fornecedores
          </button>
          <button 
            onClick={() => setActiveTab('BANCOS')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${activeTab === 'BANCOS' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'}`}
          >
            <Shield className="w-4 h-4" /> Contas e Bancos
          </button>
        </nav>

        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mt-auto">
          <p className="text-xs font-semibold text-blue-900">Dica de IA ✨</p>
          <p className="text-xs text-blue-700 mt-1">Arraste seus boletos PDF para a área de lançamentos para extração automática.</p>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 rounded-lg text-sm text-zinc-600 bg-zinc-50">
              <Building2 className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">Todas as Empresas</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Buscar... (Cmd+K)" 
                className="pl-9 pr-4 py-1.5 w-64 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-2 pl-4 border-l border-zinc-200">
              <div className="w-8 h-8 bg-zinc-800 text-white rounded-full flex items-center justify-center font-bold text-xs uppercase">
                {uid.slice(0, 2) || 'AD'}
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>

      </main>
    </div>
  );
}
