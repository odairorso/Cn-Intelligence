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
    const res = await fetch(`${API_BASE}/transactions?uid=${uid}`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction> {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    return res.json();
  },

  async createTransactionsBatch(data: Omit<Transaction, 'id'>[]): Promise<void> {
    const res = await fetch(`${API_BASE}/transactions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create transactions batch');
  },

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  async getSuppliers(uid: string): Promise<Supplier[]> {
    const res = await fetch(`${API_BASE}/suppliers?uid=${uid}`);
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  async createSupplier(data: Omit<Supplier, 'id'>): Promise<Supplier> {
    const res = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },

  async createSuppliersBatch(data: Omit<Supplier, 'id'>[]): Promise<void> {
    const res = await fetch(`${API_BASE}/suppliers/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create suppliers batch');
  },

  async deleteSupplier(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete supplier');
  },

  async resetDatabase(): Promise<void> {
    const res = await fetch(`${API_BASE}/reset`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to reset database');
  },

  async cleanDuplicates(): Promise<{ deleted: number }> {
    const res = await fetch(`${API_BASE}/clean-duplicates`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clean duplicates');
    return res.json();
  },

  async cleanSuspicious(): Promise<{ deleted: number }> {
    const res = await fetch(`${API_BASE}/clean-suspicious`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clean suspicious data');
    return res.json();
  },

  async setupTables(): Promise<void> {
    const res = await fetch(`${API_BASE}/setup-tables`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to setup tables');
  },

  async getBanks(uid: string): Promise<Bank[]> {
    const res = await fetch(`${API_BASE}/banks?uid=${uid}`);
    if (!res.ok) throw new Error('Failed to fetch banks');
    return res.json();
  },

  async createBank(data: Omit<Bank, 'id'>): Promise<Bank> {
    const res = await fetch(`${API_BASE}/banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bank');
    return res.json();
  },

  async updateBank(id: string, data: Partial<Bank>): Promise<Bank> {
    const res = await fetch(`${API_BASE}/banks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bank');
    return res.json();
  },

  async deleteBank(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/banks/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete bank');
  },
};
