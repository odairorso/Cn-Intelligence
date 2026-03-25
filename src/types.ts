export type TransactionStatus = 'PAGO' | 'PENDENTE' | 'VENCIDO';

export interface Supplier {
  id: string;
  uid: string;
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
  uid: string;
  fornecedor: string;
  descricao: string;
  empresa: string;
  vencimento: string;
  pagamento?: string;
  valor: number;
  status: TransactionStatus;
  banco?: string;
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

export interface Bank {
  id: string;
  uid: string;
  nome: string;
  saldo: number;
  ativo: boolean;
}
