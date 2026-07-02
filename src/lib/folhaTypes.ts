export interface Segmento {
  id: string;
  nome: string;
  horasSemanais: number;
  percRepouso: number; // fraction, e.g. 1/6
  horasAtividade: number;
  valorHora: number;
  ajudaCusto: number;
}

export interface Professor {
  id: string;
  nome: string;
  cpf: string;
  dataAdmissao: string;
  cargo?: string;
  salarioFixo?: number;
  horasSemanais?: number; // legacy
  segmentoHoras?: Record<string, number>; // segmentoId -> horas por semana
  valorHora?: number;
  ajudaCusto?: number;
  segmentoIds: string[];
  ativo: boolean;
  fichaCadastro?: any;
}

export interface Cargo {
  id: string;
  nome: string;
}

export interface Lancamento {
  id: string;
  professorId: string;
  segmentoId: string;
  competencia: string; // "2026-03"
  horasMensais: number;
  repouso: number;
  horasAtividade: number;
  totalHoras: number;
  ajudaCusto: number;
  totalPagar: number;
  status: 'aberto' | 'fechado';
}

export interface Fechamento {
  id: string;
  competencia: string;
  dataFechamento: string;
  observacao: string;
  totalGeral: number;
}

export type Competencia = string; // "2026-03"

// Calculation engine
export function calcularHorasMensais(horasSemanais: number): number {
  return horasSemanais * 4.5;
}

export function calcularRepouso(horasMensais: number, percRepouso: number): number {
  return horasMensais * percRepouso;
}

export function calcularTotalHoras(horasMensais: number, repouso: number, horasAtividade: number): number {
  return horasMensais + repouso + horasAtividade;
}

export function calcularTotalPagar(totalHoras: number, valorHora: number, ajudaCusto: number): number {
  return totalHoras * valorHora + ajudaCusto;
}

function calcularPercentualHA(segmento: Segmento): number {
  const baseMensal = calcularHorasMensais(Number(segmento.horasSemanais) || 0);
  if (baseMensal === 0) return 0;
  return (Number(segmento.horasAtividade) || 0) / baseMensal;
}

export function isEstagiaria(nome: string): boolean {
  const n = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return n.includes('estagiaria');
}

export function isMonitora(nome: string): boolean {
  const n = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return n.includes('monitora');
}

export function bolsaEstagiaria(horasSemanais: number): number {
  return round2((1000 / 30) * horasSemanais);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function gerarLancamento(
  professor: Professor,
  segmento: Segmento,
  competencia: string
): Omit<Lancamento, 'id'> {
  const isMon = isMonitora(segmento.nome);
  // Forçar Number() pois PostgreSQL NUMERIC retorna strings
  const horasBaseSemanais = isMon ? 0 : (Number(professor.segmentoHoras?.[segmento.id]) || Number(professor.horasSemanais) || Number(segmento.horasSemanais) || 0);
  const horasMensais = round4(calcularHorasMensais(horasBaseSemanais));

  if (isEstagiaria(segmento.nome)) {
    const totalPagar = round2((1000 / 30) * horasBaseSemanais);
    return {
      professorId: professor.id,
      segmentoId: segmento.id,
      competencia,
      horasMensais,
      repouso: 0,
      horasAtividade: 0,
      totalHoras: horasMensais,
      ajudaCusto: 0,
      totalPagar,
      status: 'aberto',
    };
  }

  const percHA = calcularPercentualHA(segmento);
  const horasAtividade = round4(horasMensais * percHA);
  // Repouso = (Mensal + H.A.) / 6 (conforme solicitado: "dividido por 6")
  const repouso = round4((horasMensais + horasAtividade) / 6);
  const totalHoras = round4(calcularTotalHoras(horasMensais, repouso, horasAtividade));
  const valorHora = Number(segmento.valorHora) || 0;
  const ajudaCusto = Number(segmento.ajudaCusto) || 0;
  const totalPagar = round2(calcularTotalPagar(totalHoras, valorHora, ajudaCusto));

  return {
    professorId: professor.id,
    segmentoId: segmento.id,
    competencia,
    horasMensais,
    repouso,
    horasAtividade,
    totalHoras,
    ajudaCusto,
    totalPagar,
    status: 'aberto',
  };
}
