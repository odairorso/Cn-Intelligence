import { useEffect, useMemo, useState } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { api } from '../../api';
import { gerarLancamento, isMonitora } from '../../lib/folhaTypes';
import { formatCurrency, formatCompetencia, gerarMesesDisponiveis, competenciaAtual } from '../../lib/folhaUtils';

const MESES = gerarMesesDisponiveis(12);

export default function FolhaLancamentos() {
  const { segmentos, professores, fechamentos } = useFolha();
  const [compFilter, setCompFilter] = useState(competenciaAtual);
  const [frozenLancs, setFrozenLancs] = useState<any[]>([]);
  const [loadingLancs, setLoadingLancs] = useState(false);

  const isFechado = useMemo(() => fechamentos.some((f) => f.competencia === compFilter), [fechamentos, compFilter]);

  useEffect(() => {
    if (isFechado) {
      setLoadingLancs(true);
      api.getFolhaLancamentos(compFilter)
        .then((data) => {
          setFrozenLancs(data);
        })
        .catch(() => {
          toast.error('Erro ao carregar lançamentos fechados do servidor.');
        })
        .finally(() => {
          setLoadingLancs(false);
        });
    } else {
      setFrozenLancs([]);
    }
  }, [compFilter, isFechado]);

  // Maps para lookup rápido
  const profMap = useMemo(() => new Map(professores.map(p => [p.id, p])), [professores]);
  const segMap = useMemo(() => new Map(segmentos.map(s => [s.id, s])), [segmentos]);

  // Cálculo dinâmico das horas/valores para o mês aberto
  const dynamicLancs = useMemo((): any[] => {
    const list: any[] = [];
    professores.filter(p => p.ativo).forEach(prof => {
      prof.segmentoIds.forEach(segId => {
        const seg = segMap.get(segId);
        if (!seg) return;
        const l = gerarLancamento(prof, seg, compFilter);
        list.push({ ...l, id: `l-${prof.id}-${segId}-${compFilter}` });
      });
    });
    return list;
  }, [professores, compFilter, segMap]);

  const displayLancs = isFechado ? frozenLancs : dynamicLancs;
  const totalGeral = useMemo(() => displayLancs.reduce((s, l) => s + Number(l.totalPagar), 0), [displayLancs]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho de filtro */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Lançamento de Horas e Turmas</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">Visão tipo planilha das turmas e salários ativos</p>
        </div>
        <div className="flex items-center gap-3">
          {isFechado ? (
            <Badge className="bg-surface-variant/50 text-on-surface-variant border-surface-variant font-normal">
              Folha Fechada
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-normal animate-pulse">
              Competência Aberta
            </Badge>
          )}
          <Select value={compFilter} onValueChange={setCompFilter}>
            <SelectTrigger className="w-[180px] bg-surface border-surface-variant text-on-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface border-surface-variant text-on-surface-variant">
              {MESES.map(m => (
                <SelectItem key={m.value} value={m.value} className="hover:bg-surface-variant/50 cursor-pointer">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Planilha */}
      <Card className="bg-surface border-surface-variant">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-surface-variant">
              <TableRow className="border-surface-variant hover:bg-surface/50">
                <TableHead className="text-on-surface-variant">Professor</TableHead>
                <TableHead className="text-on-surface-variant">Turma/Segmento</TableHead>
                <TableHead className="text-on-surface-variant text-right">Horas Sem.</TableHead>
                <TableHead className="text-on-surface-variant text-right">Mensal (H×4,5)</TableHead>
                <TableHead className="text-on-surface-variant text-right">Repouso</TableHead>
                <TableHead className="text-on-surface-variant text-right">H.A. (Atividade)</TableHead>
                <TableHead className="text-on-surface-variant text-right font-medium">Total de Horas</TableHead>
                <TableHead className="text-on-surface-variant text-right">Ajuda Custo</TableHead>
                <TableHead className="text-on-surface-variant text-right">Valor Hora</TableHead>
                <TableHead className="text-on-surface-variant text-right text-on-surface-variant font-semibold">Total a Pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLancs ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-on-surface-variant animate-pulse">
                    Carregando lançamentos salvos do servidor...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {displayLancs.map((lanc) => {
                    const prof = profMap.get(lanc.professorId || lanc.professor_id);
                    const seg = segMap.get(lanc.segmentoId || lanc.segmento_id);
                    const isMon = seg && isMonitora(seg.nome);

                    const horasSemanais = isFechado 
                      ? (isMon ? 0 : Number(lanc.horas_mensais || lanc.horasMensais) / 4.5)
                      : (isMon ? 0 : (prof?.segmentoHoras?.[seg.id] ?? 0));
                    
                    const valorHora = isFechado
                      ? Number(seg?.valorHora || 0)
                      : Number(seg?.valorHora || 0);
                    
                    const hsMensais = Number(lanc.horas_mensais ?? lanc.horasMensais ?? 0);
                    const hsRepouso = Number(lanc.repouso ?? 0);
                    const hsAtividade = Number(lanc.horas_atividade ?? lanc.horasAtividade ?? 0);
                    const hsTotal = Number(lanc.total_horas ?? lanc.totalHoras ?? 0);
                    const ajudaC = Number(lanc.ajuda_custo ?? lanc.ajudaCusto ?? 0);
                    const totalP = Number(lanc.total_pagar ?? lanc.totalPagar ?? 0);

                    return (
                      <TableRow key={lanc.id} className="border-surface-variant hover:bg-surface-variant/50/40">
                        <TableCell className="font-medium text-on-surface">{prof?.nome || 'Professor não encontrado'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-surface-variant/40 border-surface-variant text-on-surface-variant text-[10px] font-normal">
                            {seg?.nome || 'Turma não encontrada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-on-surface-variant">{isMon ? '-' : horasSemanais.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-on-surface-variant">{isMon ? '-' : hsMensais.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-on-surface-variant">{isMon ? '-' : hsRepouso.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-on-surface-variant">{isMon ? '-' : hsAtividade.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-medium text-on-surface-variant">{isMon ? '-' : hsTotal.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-on-surface-variant">{ajudaC > 0 ? formatCurrency(ajudaC) : '-'}</TableCell>
                        <TableCell className="text-right text-on-surface-variant">{isMon ? '-' : formatCurrency(valorHora)}</TableCell>
                        <TableCell className="text-right font-bold text-on-surface">{formatCurrency(totalP)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {displayLancs.length > 0 && (
                    <TableRow className="bg-surface/50 font-bold border-surface-variant">
                      <TableCell colSpan={9} className="text-right text-on-surface-variant uppercase text-xs tracking-wider">Total Geral da Folha</TableCell>
                      <TableCell className="text-right text-blue-400 text-sm font-extrabold">{formatCurrency(totalGeral)}</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
          {!loadingLancs && displayLancs.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant text-sm">
              Nenhum lançamento ativo nesta competência.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
