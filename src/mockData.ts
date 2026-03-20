import { Transaction, KPI, ChartData, Supplier } from './types';

export const MOCK_SUPPLIERS: Supplier[] = [];

export const MOCK_TRANSACTIONS: Transaction[] = [];

export const MOCK_KPIS: KPI[] = [
  { label: 'VALOR TOTAL', value: 'R$ 0,00', color: '#78dc77' },
  { label: 'REGISTROS', value: '0', description: 'Volume operacional', color: '#78dc77' },
  { label: 'EMPRESAS', value: '0', description: 'Unidades ativas', color: '#78dc77' },
  { label: 'PENDENTES', value: '0', description: 'Aguardando conciliação', color: '#fabd00' },
  { label: 'PAGOS', value: '0', description: 'Liquidados', color: '#78dc77' },
  { label: 'VENCIDOS', value: '0', description: 'Ação imediata necessária', color: '#ffb3b0' },
];

export const MOCK_STATUS_DATA: ChartData[] = [
  { name: 'Pagos', value: 0 },
  { name: 'Pendentes', value: 0 },
  { name: 'Vencidos', value: 0 },
];

export const MOCK_UNIT_DATA: ChartData[] = [];

export const MOCK_MONTHLY_DATA: ChartData[] = [];

export const MOCK_TOP_SUPPLIERS: { name: string; value: number }[] = [];
