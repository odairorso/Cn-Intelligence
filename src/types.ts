export type TransactionStatus = 'PAGO' | 'PENDENTE' | 'VENCIDO';

export interface Supplier {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  categoria?: string;
  observacoes?: string;
}

export interface Transaction {
  id: string;
  fornecedor: string;
  descricao: string;
  empresa: string;
  vencimento: string;
  pagamento?: string;
  valor: number;
  status: TransactionStatus;
}

export interface KPI {
  label: string;
  value: string;
  trend?: string;
  description?: string;
  color: string;
}

export interface ChartData {
  name: string;
  value: number;
  projected?: number;
}
