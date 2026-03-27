const API_BASE = '/api';

export interface Transaction {
  id?: string;
  uid: string;
  fornecedor: string;
  descricao?: string;
  empresa?: string;
  vencimento: string;
  pagamento?: string;
  valor: number;
  status: string;
  observacao?: string;
  banco?: string;
  tipo?: string;
  juros?: number;
  numero_boleto?: string;
  conta_contabil_id?: number;
}

export interface Supplier {
  id?: string;
  uid: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
}

export interface Bank {
  id?: string;
  uid: string;
  nome: string;
  agencia?: string;
  conta?: string;
  saldo: number;
  ativo: boolean;
}

export const api = {
  async getTransactions(uid: string): Promise<Transaction[]> {
    const res = await fetch(`${API_BASE}?route=transactions&uid=${uid}`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction> {
    const res = await fetch(`${API_BASE}?route=transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    return res.json();
  },

  async createTransactionsBatch(data: Omit<Transaction, 'id'>[]): Promise<void> {
    const res = await fetch(`${API_BASE}?route=transactions-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create transactions batch');
  },

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const params = new URLSearchParams({ route: 'transactions', id }).toString();
    const res = await fetch(`${API_BASE}?${params}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const params = new URLSearchParams({ route: 'transactions', id }).toString();
    const res = await fetch(`${API_BASE}?${params}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  async getSuppliers(uid: string): Promise<Supplier[]> {
    const res = await fetch(`${API_BASE}?route=suppliers&uid=${uid}`);
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  async createSupplier(data: Omit<Supplier, 'id'>): Promise<Supplier> {
    const res = await fetch(`${API_BASE}?route=suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },

  async createSuppliersBatch(data: Omit<Supplier, 'id'>[]): Promise<void> {
    const res = await fetch(`${API_BASE}?route=suppliers-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create suppliers batch');
  },

  async deleteSupplier(id: string): Promise<void> {
    const params = new URLSearchParams({ route: 'suppliers', id }).toString();
    const res = await fetch(`${API_BASE}?${params}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete supplier');
  },

  async setupTables(): Promise<void> {
    const res = await fetch(`${API_BASE}?route=setup-tables`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to setup tables');
  },

  async getBanks(uid: string): Promise<Bank[]> {
    const res = await fetch(`${API_BASE}?route=banks&uid=${uid}`);
    if (!res.ok) throw new Error('Failed to fetch banks');
    return res.json();
  },

  async createBank(data: Omit<Bank, 'id'>): Promise<Bank> {
    const res = await fetch(`${API_BASE}?route=banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bank');
    return res.json();
  },

  async updateBank(id: string, data: Partial<Bank>): Promise<Bank> {
    const params = new URLSearchParams({ route: 'banks', id }).toString();
    const res = await fetch(`${API_BASE}?${params}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bank');
    return res.json();
  },

  async deleteBank(id: string): Promise<void> {
    const params = new URLSearchParams({ route: 'banks', id }).toString();
    const res = await fetch(`${API_BASE}?${params}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete bank');
  },

  async getContasContabeis(): Promise<any[]> {
    const res = await fetch(`${API_BASE}?route=contas-contabeis`);
    if (!res.ok) throw new Error('Failed to fetch contas contabeis');
    return res.json();
  },
  
  async createContaContabil(data: { codigo: string; nome: string; tipo: 'RECEITA' | 'DESPESA' }): Promise<any> {
    const res = await fetch(`${API_BASE}?route=contas-contabeis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create conta contábil');
    return res.json();
  },

  async updateContaContabil(id: number, data: Partial<{ codigo: string; nome: string; tipo: 'RECEITA' | 'DESPESA'; ativo: boolean }>): Promise<any> {
    const params = new URLSearchParams({ route: 'contas-contabeis', id: String(id) }).toString();
    const res = await fetch(`${API_BASE}?${params}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update conta contábil');
    return res.json();
  },

  async mergeSuppliers(target: string, aliases: string[]): Promise<{ updated: number; removed: number }> {
    const res = await fetch(`${API_BASE}?route=suppliers-merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, aliases }),
    });
    if (!res.ok) throw new Error('Failed to merge suppliers');
    return res.json();
  },

  async mergeSuppliersAuto(): Promise<{ updated: number; removed: number }> {
    const res = await fetch(`${API_BASE}?route=suppliers-merge-auto`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to auto-merge suppliers');
    return res.json();
  },

  async extractBoleto(text?: string, fileName?: string, pdfBase64?: string): Promise<any> {
    const res = await fetch(`${API_BASE}?route=extract-boleto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fileName, pdfBase64 }),
    });
    if (!res.ok) throw new Error('Failed to extract boleto data');
    return res.json();
  },
};
