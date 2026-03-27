import type { ContaContabil } from '../types';

export const DEFAULT_COMPANIES = ['CN', 'CEI', 'UNOPAR', 'FACEMS', 'ELAINE', 'POLO DE ITAQUIRAI'];

export const DEFAULT_ACCOUNTS: ContaContabil[] = [
  { id: 0, codigo: '3.1',  nome: 'Folha de Pagamento',    tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.2',  nome: 'Aluguel',               tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.3',  nome: 'Água / Luz / Telefone', tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.4',  nome: 'Material de Escritório',tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.5',  nome: 'Segurança',             tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.6',  nome: 'Editoras',              tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.7',  nome: 'Impostos',              tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.8',  nome: 'Manutenção',            tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.9',  nome: 'Tarifas Bancárias',     tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.10', nome: 'Juros / Multas',        tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '3.11', nome: 'Outras Despesas',       tipo: 'DESPESA', ativo: true },
  { id: 0, codigo: '4.1',  nome: 'Mensalidades',          tipo: 'RECEITA', ativo: true },
  { id: 0, codigo: '4.2',  nome: 'Repasses',              tipo: 'RECEITA', ativo: true },
  { id: 0, codigo: '4.3',  nome: 'Matrículas',            tipo: 'RECEITA', ativo: true },
  { id: 0, codigo: '4.4',  nome: 'Permutas / Convênios',  tipo: 'RECEITA', ativo: true },
  { id: 0, codigo: '4.5',  nome: 'Aplicação Bancária',    tipo: 'RECEITA', ativo: true },
  { id: 0, codigo: '4.6',  nome: 'Outras Receitas',       tipo: 'RECEITA', ativo: true },
];

export const PAGE_SIZE = 50;

export const MONTH_LABELS: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março',    '04': 'Abril',
  '05': 'Maio',    '06': 'Junho',     '07': 'Julho',    '08': 'Agosto',
  '09': 'Setembro','10': 'Outubro',   '11': 'Novembro', '12': 'Dezembro',
};
