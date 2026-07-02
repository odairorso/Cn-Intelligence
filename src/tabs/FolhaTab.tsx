import { useState, startTransition } from 'react';
import { FolhaProvider } from '../contexts/FolhaContext';
import FolhaDashboard from '../components/folha/FolhaDashboard';
import FolhaProfessores from '../components/folha/FolhaProfessores';
import FolhaLancamentos from '../components/folha/FolhaLancamentos';
import FolhaFechamento from '../components/folha/FolhaFechamento';
import FolhaRelatorios from '../components/folha/FolhaRelatorios';
import FolhaParametros from '../components/folha/FolhaParametros';
import { cn } from '../lib/utils';

type SubTab = 'dashboard' | 'professores' | 'lancamentos' | 'fechamento' | 'relatorios' | 'parametros';

export default function FolhaTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('dashboard');

  const subTabs = [
    { id: 'dashboard', label: 'Painel' },
    { id: 'professores', label: 'Professores' },
    { id: 'lancamentos', label: 'Lançar Horas' },
    { id: 'fechamento', label: 'Fechamento' },
    { id: 'relatorios', label: 'Relatórios' },
    { id: 'parametros', label: 'Parâmetros RH' },
  ] as const;

  return (
    <FolhaProvider>
      <div className="space-y-6">
        {/* Sub-navegação */}
        <div className="flex border-b border-zinc-800 gap-4 overflow-x-auto pb-px">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => startTransition(() => setActiveSubTab(t.id))}
              className={cn(
                "transition-all duration-200 font-medium text-xs md:text-sm pb-2.5 px-1 border-b-2 cursor-pointer whitespace-nowrap",
                activeSubTab === t.id
                  ? "text-blue-500 border-blue-500 font-bold"
                  : "text-zinc-500 border-transparent hover:text-zinc-350"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="animate-fade-in duration-200">
          {activeSubTab === 'dashboard' && <FolhaDashboard />}
          {activeSubTab === 'professores' && <FolhaProfessores />}
          {activeSubTab === 'lancamentos' && <FolhaLancamentos />}
          {activeSubTab === 'fechamento' && <FechamentoContainer />}
          {activeSubTab === 'relatorios' && <FolhaRelatorios />}
          {activeSubTab === 'parametros' && <FolhaParametros />}
        </div>
      </div>
    </FolhaProvider>
  );
}

// Pequeno container para ajudar com re-fetches ao fechar folha
function FechamentoContainer() {
  return <FolhaFechamento />;
}
