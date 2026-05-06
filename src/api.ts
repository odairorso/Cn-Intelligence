import type { Transaction, Supplier, Bank, ContaContabil } from './types';

// O backend no Vercel usa api/index.js com roteamento por ?route=
const API_BASE = '/api';

const buildHttpError = async (res: Response, fallback: string) => {
  const contentType = res.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      const message =
        (data && typeof data === 'object' && 'message' in data && typeof (data as any).message === 'string' && (data as any).message) ||
        (data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string' && (data as any).error) ||
        null;
      return new Error(message ? `${fallback}: ${message}` : `${fallback} (HTTP ${res.status})`);
    }
    const text = await res.text().catch(() => '');
    const compact = String(text || '').trim().slice(0, 400);
    return new Error(compact ? `${fallback}: ${compact}` : `${fallback} (HTTP ${res.status})`);
  } catch {
    return new Error(`${fallback} (HTTP ${res.status})`);
  }
};

/**
 * Wrapper para fetch que adiciona cabeçalhos de segurança para bloquear robôs
 */
export const fetchWithSecurity = (url: string, options: RequestInit = {}) => {
  const headers = {
    ...(options.headers || {}),
    // Token de segurança reforçado para impedir bypass de bots
    // RECOMENDAÇÃO: Em produção, este valor deve ser configurado via variáveis de ambiente da Vercel.
    'x-cn-security': 'CN-INT-2024-SECURE-HARDENED-V1'
  };
  return fetch(url, { ...options, headers });
};

export const api = {
  // ─── Transactions ──────────────────────────────────────────────────────────
  async getTransactions(
    _uid: string,
    limit?: number,
    offset?: number,
    year?: string,
    month?: string,
    search?: string,
    tipo?: string,
    empresa?: string,
    status?: string
  ): Promise<Transaction[]> {
    const params = new URLSearchParams();
    params.append('route', 'transactions');
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (search) params.append('search', search);
    if (tipo) params.append('tipo', tipo);
    if (empresa) params.append('empresa', empresa);
    if (status) params.append('status', status);

    const res = await fetchWithSecurity(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch transactions');
    return res.json();
  },

  async getStats(_uid: string, year?: string, period?: string, empresa?: string, tipo?: string, status?: string, search?: string): Promise<{
    kpis: {
      total_receitas: number;
      total_despesas: number;
      count_pagos: number;
      count_pendentes: number;
      count_vencidos: number;
      total_count: number;
    };
    monthlyFlux: Array<{
      month_num: number;
      receitas: number;
      despesas: number;
    }>;
    topSuppliers: Array<{
      name: string;
      value: number;
    }>;
  }> {
    const params = new URLSearchParams();
    params.append('route', 'stats');
    if (year) params.append('year', year);
    if (period) params.append('period', period);
    if (empresa) params.append('empresa', empresa);
    if (tipo) params.append('tipo', tipo);
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    const res = await fetchWithSecurity(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch stats');
    return res.json();
  },

  async createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction> {
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Boleto já lançado');
      }
      throw new Error('Failed to create transaction');
    }
    return res.json();
  },

  async createTransactionsBatch(data: Omit<Transaction, 'id'>[]): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to create transactions batch');
  },

  async updateTransactionsBatch(ids: string[], banco: string, dataPagamento?: string): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions-batch-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, banco, dataPagamento }),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update transactions batch');
  },

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update transaction');
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  // ─── Suppliers ─────────────────────────────────────────────────────────────
  async getSuppliers(_uid: string): Promise<Supplier[]> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch suppliers');
    return res.json();
  },

  async createSupplier(data: Omit<Supplier, 'id'>): Promise<Supplier> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },

  async createSuppliersBatch(data: Omit<Supplier, 'id'>[]): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create suppliers batch');
  },

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update supplier');
    return res.json();
  },

  async deleteSupplier(id: string): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete supplier');
  },

  async mergeSuppliers(target: string, aliases: string[]): Promise<{ updated: number; removed: number }> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers-merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, aliases }),
    });
    if (!res.ok) throw new Error('Failed to merge suppliers');
    return res.json();
  },

  async mergeSuppliersAuto(): Promise<{ updated: number; removed: number }> {
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers-merge-auto`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to auto-merge suppliers');
    return res.json();
  },

  // ─── Banks ─────────────────────────────────────────────────────────────────
  async getBanks(_uid: string): Promise<Bank[]> {
    const res = await fetchWithSecurity(`${API_BASE}?route=banks`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch banks');
    return res.json();
  },

  async createBank(data: Omit<Bank, 'id'>): Promise<Bank> {
    const res = await fetchWithSecurity(`${API_BASE}?route=banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bank');
    return res.json();
  },

  async updateBank(id: string, data: Partial<Bank>): Promise<Bank> {
    const res = await fetchWithSecurity(`${API_BASE}?route=banks&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bank');
    return res.json();
  },

  async deleteBank(id: string): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=banks&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete bank');
  },

  // ─── Contas Contábeis ──────────────────────────────────────────────────────
  async getContasContabeis(): Promise<ContaContabil[]> {
    const res = await fetchWithSecurity(`${API_BASE}?route=contas-contabeis`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch contas contabeis');
    return res.json();
  },

  async createContaContabil(data: { codigo: string; nome: string; tipo: 'RECEITA' | 'DESPESA' }): Promise<ContaContabil> {
    const res = await fetchWithSecurity(`${API_BASE}?route=contas-contabeis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create conta contábil');
    return res.json();
  },

  async updateContaContabil(id: number, data: Partial<ContaContabil>): Promise<ContaContabil> {
    const res = await fetchWithSecurity(`${API_BASE}?route=contas-contabeis&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update conta contábil');
    return res.json();
  },

  // ─── Utilities ─────────────────────────────────────────────────────────────
  async setupTables(): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=setup-tables`, { method: 'POST' });
    if (!res.ok) throw await buildHttpError(res, 'Failed to setup tables');
  },

  async resetDatabase(): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=reset`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset database');
  },

  async cleanDuplicates(): Promise<{ deleted: number }> {
    const res = await fetchWithSecurity(`${API_BASE}?route=clean-duplicates`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clean duplicates');
    return res.json();
  },

  async cleanSuspicious(): Promise<{ deleted: number }> {
    const res = await fetchWithSecurity(`${API_BASE}?route=clean-suspicious`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clean suspicious data');
    return res.json();
  },

  async extractBoleto(text?: string, fileName?: string, pdfBase64?: string): Promise<Record<string, unknown>> {
    const res = await fetchWithSecurity(`${API_BASE}?route=extract-boleto`, {
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
      await fetchWithSecurity(`${API_BASE}?route=save-boleto-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch { /* silencioso — não bloqueia o fluxo */ }
  },

  async getBoletoPatterns(): Promise<Array<{
    id: number;
    cnpj: string;
    nome_normalizado: string;
    fornecedor: string;
    descricao: string;
    empresa: string;
    tipo: string;
    confirmacoes: number;
  }>> {
    const res = await fetchWithSecurity(`${API_BASE}?route=boleto-patterns`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch patterns');
    return res.json();
  },

  async deleteBoletoPattern(id: number): Promise<void> {
    const res = await fetchWithSecurity(`${API_BASE}?route=boleto-patterns&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete pattern');
  },

  async exportBackup(): Promise<Blob> {
    const res = await fetchWithSecurity(`${API_BASE}?route=export-backup`, {
      headers: {
        'x-cn-backup-token': 'CN-BACKUP-SECRET-2024'
      }
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to export backup');
    return res.blob();
  },
};
