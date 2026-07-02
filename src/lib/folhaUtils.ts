import { formatBRL } from './utils';

export function formatCurrency(value: number): string {
  return formatBRL(value);
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '';
  if (isoDate.includes('/')) return isoDate;
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return isoDate;
}

export function formatCompetencia(comp: string): string {
  if (!comp) return '';
  const parts = comp.split('-');
  if (parts.length < 2) return comp;
  const [year, month] = parts;
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const idx = parseInt(month, 10) - 1;
  return `${months[idx] || month}/${year}`;
}

export function formatCompetenciaShort(comp: string): string {
  if (!comp) return '';
  const parts = comp.split('-');
  if (parts.length < 2) return comp;
  const [year, month] = parts;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(month, 10) - 1;
  return `${months[idx] || month}/${year}`;
}

export function gerarMesesDisponiveis(count: number = 12): { value: string; label: string }[] {
  const list: { value: string; label: string }[] = [];
  const now = new Date();
  
  // Inclui mês atual, meses passados e futuros
  for (let i = -6; i < count - 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${yyyy}-${mm}`;
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const label = `${months[d.getMonth()]} de ${yyyy}`;
    
    list.push({ value, label });
  }
  
  // Ordena por data mais recente no topo
  return list.sort((a, b) => b.value.localeCompare(a.value));
}

export const competenciaAtual = (() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
})();

export function toNumberBR(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Substitui vírgula por ponto para parse
  const clean = val.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

export function formatNumberBR(num: number, decimals: number = 2): string {
  if (isNaN(num)) return '0,00';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
