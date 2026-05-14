import { z } from 'zod';

export const TransactionSchema = z.object({
  uid: z.string(),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
  descricao: z.string().optional(),
  empresa: z.string().optional(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vencimento inválido (YYYY-MM-DD)"),
  pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  valor: z.coerce.number({ invalid_type_error: "Valor deve ser um número" }),
  status: z.enum(['PENDENTE', 'PAGO', 'VENCIDO']).default('PENDENTE'),
  banco: z.string().optional().nullable(),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  numero_boleto: z.string().optional().nullable(),
  conta_contabil_id: z.coerce.number().optional().nullable(),
  juros: z.coerce.number().optional().nullable(),
});

export const TransactionBatchSchema = z.array(TransactionSchema);

export const SupplierSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  uid: z.string(),
});

export const SupplierMergeSchema = z.object({
  uid: z.string(),
  target: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
});

export const BankSchema = z.object({
  nome: z.string().min(1),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  saldo: z.number().or(z.string().transform(v => Number(v))),
  cor: z.string().optional(),
  ativo: z.boolean().optional(),
  uid: z.string(),
});

export const ContaContabilSchema = z.object({
  uid: z.string(),
  codigo: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.enum(['RECEITA', 'DESPESA']),
});

export const ExtractBoletoSchema = z.object({
  text: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  pdfBase64: z.string().optional().nullable(),
});

export const SaveBoletoPatternSchema = z.object({
  uid: z.string(),
  cnpj: z.string().optional().nullable(),
  nome_beneficiario: z.string().optional().nullable(),
  fornecedor: z.string().min(1),
  descricao: z.string().optional().nullable(),
  empresa: z.string().optional().nullable(),
  tipo: z.string().optional().nullable(),
  conta_contabil_id: z.number().optional().nullable(),
});
