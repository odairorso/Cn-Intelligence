import type { Transaction, Supplier, Bank, ContaContabil } from './types';

// O backend no Vercel usa api/index.js com roteamento por ?route=
const API_BASE = '/api';

// --------------------------------------------------------------
// Helpers de autenticação - Usuário salvo localmente (metadados públicos)
// O Token JWT em si fica seguro no cookie HttpOnly gerenciado pelo navegador.
// --------------------------------------------------------------
interface LocalUser {
  uid: string;
  email: string | null;
  display_name?: string | null;
}

const getUser = (): LocalUser | null => {
  try {
    const raw = localStorage.getItem('cn_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setUser = (user: LocalUser) => {
  try {
    localStorage.setItem('cn_user', JSON.stringify(user));
  } catch { /* ignore */ }
};

const removeUser = () => {
  try {
    localStorage.removeItem('cn_user');
  } catch { /* ignore */ }
};

// Mantido apenas para compatibilidade de tipos no frontend
const getToken = (): string | null => null;

export const decodeJwtPayload = (token: string): any => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

const getUid = (): string | null => {
  const user = getUser();
  return user ? user.uid : null;
};

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

// --------------------------------------------------------------
// fetchWithSecurity — envia credenciais de mesma origem para carregar cookies HttpOnly
// --------------------------------------------------------------
export const fetchWithSecurity = (url: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>) || {},
  };
  const securityToken = import.meta.env.VITE_CN_SECURITY_TOKEN;
  if (securityToken) headers['x-cn-security'] = securityToken;
  return fetch(url, { 
    ...options, 
    headers,
    credentials: 'same-origin' // Habilita o envio automático de cookies HttpOnly
  });
};

// --------------------------------------------------------------
// API Auth
// --------------------------------------------------------------
export const apiAuth = {
  async login(password: string): Promise<{ token: string; user: { uid: string; email: string | null } }> {
    const res = await fetchWithSecurity(`${API_BASE}?route=auth-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const error = await buildHttpError(res, 'Falha no login');
      throw error;
    }
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetchWithSecurity(`${API_BASE}?route=auth-logout`, { method: 'POST' });
    } catch { /* ignore */ }
    removeUser();
  },

  async checkSession(): Promise<{ uid: string; email: string | null }> {
    const res = await fetchWithSecurity(`${API_BASE}?route=auth-session`);
    if (!res.ok) {
      removeUser();
      throw new Error('Sessão expirada');
    }
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
    return data.user;
  },

  getToken,
  getUid,
  isAuthenticated: (): boolean => {
    return getUser() !== null;
  },
};

// --------------------------------------------------------------
// API Endpoints
// --------------------------------------------------------------
export const api = {
  // ─── Transactions ──────────────────────────────────────────────────────────
  async getTransactions(
    limit?: number,
    offset?: number,
    year?: string,
    month?: string,
    search?: string,
    tipo?: string,
    empresa?: string,
    status?: string,
    conta_contabil_id?: number,
    startDate?: string,
    endDate?: string
  ): Promise<Transaction[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const params = new URLSearchParams();
    params.append('route', 'transactions');
    // UID extraído automaticamente pelo backend via JWT — não enviar no query
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (search) params.append('search', search);
    if (tipo) params.append('tipo', tipo);
    if (empresa) params.append('empresa', empresa);
    if (status) params.append('status', status);
    if (typeof conta_contabil_id === 'number') params.append('conta_contabil_id', String(conta_contabil_id));
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const res = await fetchWithSecurity(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch transactions');
    return res.json();
  },

  async getStats(
    year?: string,
    period?: string,
    empresa?: string,
    tipo?: string,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
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
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const params = new URLSearchParams();
    params.append('route', 'stats');
    if (year) params.append('year', year);
    if (period) params.append('period', period);
    if (empresa) params.append('empresa', empresa);
    if (tipo) params.append('tipo', tipo);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const res = await fetchWithSecurity(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch stats');
    return res.json();
  },

  async createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
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
      throw await buildHttpError(res, 'Falha ao criar lançamento');
    }
    return res.json();
  },

  async createTransactionsBatch(data: Omit<Transaction, 'id'>[]): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to create transactions batch');
  },

  async updateTransactionsBatch(ids: string[], banco: string, dataPagamento?: string): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions-batch-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, banco, dataPagamento }),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update transactions batch');
  },

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update transaction');
    return res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=transactions&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  // ─── Suppliers ─────────────────────────────────────────────────────────────
  async getSuppliers(fresh?: boolean): Promise<Supplier[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const params = new URLSearchParams();
    params.append('route', 'suppliers');
    if (fresh) params.append('fresh', '1');
    const res = await fetchWithSecurity(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch suppliers');
    return res.json();
  },

  async createSupplier(data: Omit<Supplier, 'id'>): Promise<Supplier> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },

  async createSuppliersBatch(data: Omit<Supplier, 'id'>[]): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create suppliers batch');
  },

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update supplier');
    return res.json();
  },

  async deleteSupplier(id: string): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete supplier');
  },

  async mergeSuppliers(target: string, aliases: string[]): Promise<{ updated: number; removed: number }> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers-merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, aliases }),
    });
    if (!res.ok) throw new Error('Failed to merge suppliers');
    return res.json();
  },

  async mergeSuppliersAuto(): Promise<{ updated: number; removed: number }> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=suppliers-merge-auto`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to auto-merge suppliers');
    return res.json();
  },

  // ─── Banks ─────────────────────────────────────────────────────────────────
  async getBanks(fresh?: boolean): Promise<Bank[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const params = new URLSearchParams();
    params.append('route', 'banks');
    if (fresh) params.append('fresh', '1');
    const res = await fetchWithSecurity(`${API_BASE}?${params.toString()}`, fresh ? { cache: 'no-store' } : {});
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch banks');
    return res.json();
  },

  async createBank(data: Omit<Bank, 'id'>): Promise<Bank> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bank');
    return res.json();
  },

  async updateBank(id: string, data: Partial<Bank>): Promise<Bank> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=banks&id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bank');
    return res.json();
  },

  async deleteBank(id: string): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=banks&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete bank');
  },

  // ─── Contas Contábeis ──────────────────────────────────────────────────────
  async getContasContabeis(): Promise<ContaContabil[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=contas-contabeis`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch contas contabeis');
    return res.json();
  },

  async createContaContabil(data: { codigo: string; nome: string; tipo: 'RECEITA' | 'DESPESA' }): Promise<ContaContabil> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=contas-contabeis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create conta contábil');
    return res.json();
  },

  async updateContaContabil(id: number, data: Partial<ContaContabil>): Promise<ContaContabil> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
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
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=setup-tables`, { method: 'POST' });
    if (!res.ok) throw await buildHttpError(res, 'Failed to setup tables');
  },

  async extractBoleto(text?: string, fileName?: string, pdfBase64?: string): Promise<Record<string, unknown>> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=extract-boleto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fileName, pdfBase64 }),
    });
    if (!res.ok) throw await buildHttpError(res, 'Falha ao extrair boleto');
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
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
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
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=boleto-patterns`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch patterns');
    return res.json();
  },

  async deleteBoletoPattern(id: number): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=boleto-patterns&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete pattern');
  },

  async exportBackup(): Promise<Blob> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    // O backup token é lido diretamente pelo backend via BACKUP_TOKEN (server-side).
    // Não expomos o token no frontend para evitar risks de XSS.
    const res = await fetchWithSecurity(`${API_BASE}?route=export-backup`);
    if (!res.ok) throw new Error('Failed to export backup');
    return res.blob();
  },

  // ─── Folha de Pagamento ────────────────────────────────────────────────────
  async getFolhaSegmentos(): Promise<any[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-segmentos`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch folha segmentos');
    return res.json();
  },

  async createFolhaSegmento(data: any): Promise<any> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-segmentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to create folha segmento');
    return res.json();
  },

  async updateFolhaSegmento(data: any): Promise<any> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-segmentos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update folha segmento');
    return res.json();
  },

  async getFolhaProfessores(): Promise<any[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-professores`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch folha professores');
    return res.json();
  },

  async createFolhaProfessor(data: any): Promise<any> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-professores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to create folha professor');
    return res.json();
  },

  async updateFolhaProfessor(data: any): Promise<any> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-professores`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to update folha professor');
    return res.json();
  },

  async deleteFolhaProfessor(id: string): Promise<void> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-professores`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to delete folha professor');
  },

  async getFolhaLancamentos(competencia: string): Promise<any[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-lancamentos&competencia=${competencia}`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch folha lancamentos');
    return res.json();
  },

  async getFolhaFechamentos(): Promise<any[]> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-fechamentos`);
    if (!res.ok) throw await buildHttpError(res, 'Failed to fetch folha fechamentos');
    return res.json();
  },

  async createFolhaFechamento(data: any): Promise<any> {
    if (!apiAuth.isAuthenticated()) throw new Error('Autenticação necessária');
    const res = await fetchWithSecurity(`${API_BASE}?route=folha-fechamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildHttpError(res, 'Failed to create folha fechamento');
    return res.json();
  },
};
