import type { Transaction, Supplier, Bank, ContaContabil } from './types';

// O backend no Vercel usa api/index.js com roteamento por ?route=
const API_BASE = '/api';

export const api = {
  // ─── Transactions ──────────────────────────────────────────────────────────
  async getTransactions(_uid: string): Promise<Transaction[]> {
    const res = await fetch(`${API_BASE}?route=transactions`);
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
    const res = await fetch(`${API_BASE}?route=transactions&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}?route=transactions&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  // ─── Suppliers ─────────────────────────────────────────────────────────────
  async getSuppliers(_uid: string): Promise<Supplier[]> {
    const res = await fetch(`${API_BASE}?route=suppliers`);
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
    const res = await fetch(`${API_BASE}?route=suppliers&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete supplier');
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
    const res = await fetch(`${API_BASE}?route=suppliers-merge-auto`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to auto-merge suppliers');
    return res.json();
  },

  // ─── Banks ─────────────────────────────────────────────────────────────────
  async getBanks(_uid: string): Promise<Bank[]> {
    const res = await fetch(`${API_BASE}?route=banks`);
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
    const res = await fetch(`${API_BASE}?route=banks&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bank');
    return res.json();
  },

  async deleteBank(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}?route=banks&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete bank');
  },

  // ─── Contas Contábeis ──────────────────────────────────────────────────────
  async getContasContabeis(): Promise<ContaContabil[]> {
    const res = await fetch(`${API_BASE}?route=contas-contabeis`);
    if (!res.ok) throw new Error('Failed to fetch contas contabeis');
    return res.json();
  },

  async createContaContabil(data: { codigo: string; nome: string; tipo: 'RECEITA' | 'DESPESA' }): Promise<ContaContabil> {
    const res = await fetch(`${API_BASE}?route=contas-contabeis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create conta contábil');
    return res.json();
  },

  async updateContaContabil(id: number, data: Partial<ContaContabil>): Promise<ContaContabil> {
    const res = await fetch(`${API_BASE}?route=contas-contabeis&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update conta contábil');
    return res.json();
  },

  // ─── Utilities ─────────────────────────────────────────────────────────────
  async setupTables(): Promise<void> {
    const res = await fetch(`${API_BASE}?route=setup-tables`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to setup tables');
  },

  async resetDatabase(): Promise<void> {
    const res = await fetch(`${API_BASE}?route=reset`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset database');
  },

  async cleanDuplicates(): Promise<{ deleted: number }> {
    const res = await fetch(`${API_BASE}?route=clean-duplicates`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clean duplicates');
    return res.json();
  },

  async cleanSuspicious(): Promise<{ deleted: number }> {
    const res = await fetch(`${API_BASE}?route=clean-suspicious`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clean suspicious data');
    return res.json();
  },

  async extractBoleto(text?: string, fileName?: string, pdfBase64?: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}?route=extract-boleto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fileName, pdfBase64 }),
    });
    if (!res.ok) throw new Error('Failed to extract boleto data');
    return res.json();
  },

  async saveBoletoPattern(data: {
    cnpj?: string;
    nome_beneficiario?: string;
    fornecedor: string;
    descricao?: string;
    empresa?: string;
    tipo?: string;
    conta_contabil_id?: number;
  }): Promise<void> {
    try {
      await fetch(`${API_BASE}?route=save-boleto-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch { /* silencioso — não bloqueia o fluxo */ }
  },
};
