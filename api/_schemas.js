import { z } from 'zod';

// ---------------------------------------------------------------
// Schemas Zod — validação de entrada para todas as rotas
// ---------------------------------------------------------------

const PAGAMENTO_STATUSES = ['PAGO', 'PENDENTE', 'VENCIDO', 'CANCELADO'];
const TIPO_TRANSACTION = ['RECEITA', 'DESPESA', 'TRANSFERENCIA'];

// Transação
export const TransactionSchema = z.object({
  uid: z.string().min(1).max(255),
  fornecedor: z.string().min(1).max(255),
  descricao: z.string().max(5000).optional().default('-'),
  empresa: z.string().max(100).optional().default('Geral'),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento deve estar no formato YYYY-MM-DD'),
  pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de pagamento deve estar no formato YYYY-MM-DD').optional().nullable(),
  valor: z.number().positive('Valor deve ser maior que zero'),
  status: z.enum(PAGAMENTO_STATUSES).optional().default('PENDENTE'),
  banco: z.string().max(255).optional().nullable(),
  tipo: z.enum(TIPO_TRANSACTION).optional().default('DESPESA'),
  numero_boleto: z.string().max(255).optional().nullable(),
  conta_contabil_id: z.number().int().optional().nullable(),
});

export const TransactionBatchItemSchema = z.object({
  uid: z.string().min(1).max(255),
  fornecedor: z.string().min(1).max(255),
  descricao: z.string().max(5000).optional().default('-'),
  empresa: z.string().max(100).optional().default('Geral'),
  vencimento: z.string().min(1, 'Vencimento é obrigatório'),
  pagamento: z.string().optional().nullable(),
  valor: z.preval((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      throw new Error('Valor deve ser um número válido');
    }
    return n;
  }),
  status: z.enum(PAGAMENTO_STATUSES).optional().default('PENDENTE'),
  banco: z.string().max(255).optional().nullable(),
  tipo: z.enum(TIPO_TRANSACTION).optional().default('DESPESA'),
  numero_boleto: z.string().max(255).optional().nullable(),
  conta_contabil_id: z.number().int().optional().nullable(),
});

export const TransactionBatchSchema = z.array(TransactionBatchItemSchema)
  .min(1, 'Pelo menos 1 transação é obrigatória')
  .max(1000, 'Máximo de 1000 transações por lote');

// Fornecedor
export const SupplierSchema = z.object({
  uid: z.string().min(1).max(255),
  nome: z.string().min(1).max(255),
  cnpj: z.string().max(50).optional().nullable(),
  email: z.string().email('Email inválido').max(255).optional().nullable(),
  telefone: z.string().max(50).optional().nullable(),
});

export const SupplierMergeSchema = z.object({
  uid: z.string().min(1).max(255),
  target: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1).max(100),
});

// Banco / Conta Contábil
export const BankSchema = z.object({
  uid: z.string().min(1).max(255),
  nome: z.string().min(1).max(255),
  agencia: z.string().max(100).optional().nullable(),
  conta: z.string().max(100).optional().nullable(),
  saldo: z.number().optional().default(0),
  ativo: z.boolean().optional().default(true),
});

export const ContaContabilSchema = z.object({
  uid: z.string().min(1).max(255),
  codigo: z.string().min(1).max(20),
  nome: z.string().min(1).max(255),
  tipo: z.enum(['RECEITA', 'DESPESA']),
});

// Boleto
export const ExtractBoletoSchema = z.object({
  uid: z.string().min(1).max(255).optional(),
  text: z.string().min(1),
  fileName: z.string().max(500).optional().nullable(),
  pdfBase64: z.string().optional().nullable(),
});

export const SaveBoletoPatternSchema = z.object({
  uid: z.string().min(1).max(255),
  cnpj: z.string().max(50).optional().nullable(),
  nome_beneficiario: z.string().max(255).optional().nullable(),
  fornecedor: z.string().min(1).max(255),
  descricao: z.string().max(5000).optional().nullable(),
  empresa: z.string().max(100).optional().nullable(),
  tipo: z.enum(TIPO_TRANSACTION).optional().default('DESPESA'),
  conta_contabil_id: z.number().int().optional().nullable(),
});

// Auth
export const LoginSchema = z.object({
  email: z.string().email('Email inválido').min(1).max(255),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres').max(128),
});

// Stats
export const StatsQuerySchema = z.object({
  uid: z.string().min(1).max(255),
  year: z.string().optional(),
  period: z.string().optional(),
  empresa: z.string().optional(),
  tipo: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});