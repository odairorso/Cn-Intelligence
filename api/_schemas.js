import { z } from 'zod';

export const TransactionSchema = z.object({
  uid: z.string(),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
  descricao: z.string().optional(),
  empresa: z.string().optional(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  valor: z.number().or(z.string().transform(v => Number(v))),
  status: z.enum(['PENDENTE', 'PAGO', 'VENCIDO']).default('PENDENTE'),
  banco: z.string().optional().nullable(),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  numero_boleto: z.string().optional().nullable(),
  conta_contabil_id: z.number().optional().nullable(),
  juros: z.number().optional().nullable(),
});

export const TransactionBatchSchema = z.array(TransactionSchema);

export const SupplierSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  uid: z.string(),
});

export const BankSchema = z.object({
  nome: z.string().min(1),
  saldo: z.number().or(z.string().transform(v => Number(v))),
  cor: z.string().optional(),
  uid: z.string(),
});