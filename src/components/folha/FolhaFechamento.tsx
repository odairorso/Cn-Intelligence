import { useState, useEffect, useMemo } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { api } from '../../api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { gerarLancamento, isMonitora } from '../../lib/folhaTypes';
import { formatCurrency, formatCompetencia, gerarMesesDisponiveis, competenciaAtual } from '../../lib/folhaUtils';

const MESES = gerarMesesDisponiveis(12);

export default function FolhaFechamento() {
  const { professores, segmentos, fechamentos, addFechamento } = useFolha();
  const [comp, setComp] = useState(competenciaAtual);
  const [obs, setObs] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [frozenLancs, setFrozenLancs] = useState<any[]>([]);
  const [loadingLancs, setLoadingLancs] = useState(false);

  const isFechado = useMemo(() => fechamentos.some((f) => f.competencia === comp), [fechamentos, comp]);

  useEffect(() => {
    if (isFechado) {
      setLoadingLancs(true);
      api.getFolhaLancamentos(comp)
        .then((data) => {
          setFrozenLancs(data);
        })
        .catch(() => {
          toast.error('Erro ao carregar lançamentos fechados.');
        })
        .finally(() => {
          setLoadingLancs(false);
        });
    } else {
      setFrozenLancs([]);
    }
  }, [comp, isFechado]);

  const profMap = useMemo(() => new Map(professores.map(p => [p.id, p])), [professores]);
  const segMap = useMemo(() => new Map(segmentos.map(s => [s.id, s])), [segmentos]);

  // Lançamentos dinâmicos para a competência aberta
  const compLancs = useMemo((): any[] => {
    return professores.filter(p => p.ativo).flatMap((prof) =>
      prof.segmentoIds.flatMap((segId) => {
        const seg = segMap.get(segId);
        if (!seg) return [];
        const l = gerarLancamento(prof, seg, comp);
        return [{ ...l, professorId: prof.id, segmentoId: segId, id: `l-${prof.id}-${segId}-${comp}` }];
      })
    );
  }, [professores, comp, segMap]);

  const displayLancs = isFechado ? frozenLancs : compLancs;
  const totalGeral = useMemo(() => displayLancs.reduce((s, l) => s + Number(l.totalPagar), 0), [displayLancs]);

  const handleFecharCompetencia = async () => {
    // Agrupa salários por professor para criar os lançamentos individuais no contas a pagar
    const teacherTotalsMap = new Map<string, number>();
    compLancs.forEach((l) => {
      const prof = profMap.get(l.professorId);
      if (!prof) return;
      const current = teacherTotalsMap.get(prof.nome) || 0;
      teacherTotalsMap.set(prof.nome, current + Number(l.totalPagar));
    });

    const lancsFin = Array.from(teacherTotalsMap.entries()).map(([nome, totalPagar]) => ({
      nome,
      totalPagar,
    }));

    await addFechamento(
      {
        competencia: comp,
        dataFechamento: new Date().toISOString().split('T')[0],
        observacao: obs,
        totalGeral,
      },
      compLancs,
      lancsFin
    );

    setObs('');
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200 font-mono">Consolidar Mês e Fechamento</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Feche o mês para transferir as despesas ao fluxo de caixa</p>
        </div>
        <Select value={comp} onValueChange={setComp}>
          <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-zinc-250">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
            {MESES.map(m => (
              <SelectItem key={m.value} value={m.value} className="hover:bg-zinc-800 cursor-pointer">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status da Competência */}
      <Card className={`bg-zinc-900 border ${isFechado ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <CardContent className="flex items-center gap-3 py-4 text-sm text-zinc-250">
          {isFechado ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-emerald-400">
                Competência fechada em {fechamentos.find(f => f.competencia === comp)?.dataFechamento ? new Date(fechamentos.find(f => f.competencia === comp)!.dataFechamento).toLocaleDateString('pt-BR') : ''}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
              <span className="font-semibold text-amber-400">Competência aberta — aguardando fechamento</span>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Previa de Fechamento */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="border-b border-zinc-800">
          <CardTitle className="text-sm font-semibold text-zinc-200">Detalhamento Salarial — {formatCompetencia(comp)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-zinc-800">
              <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="text-zinc-400">Professor</TableHead>
                <TableHead className="text-zinc-400">Turma/Segmento</TableHead>
                <TableHead className="text-zinc-400 text-right">Total Horas</TableHead>
                <TableHead className="text-zinc-400 text-right text-zinc-300 font-semibold">Total a Pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLancs ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-zinc-500 animate-pulse">
                    Carregando detalhes do banco de dados...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {displayLancs.map((l) => {
                    const prof = profMap.get(l.professorId || l.professor_id);
                    const seg = segMap.get(l.segmentoId || l.segmento_id);
                    const isMon = seg && isMonitora(seg.nome);
                    const hsTotal = Number(l.total_horas ?? l.totalHoras ?? 0);
                    const totalP = Number(l.total_pagar ?? l.totalPagar ?? 0);

                    return (
                      <TableRow key={l.id} className="border-zinc-800 hover:bg-zinc-800/40">
                        <TableCell className="font-medium text-zinc-150">{prof?.nome || 'Professor não encontrado'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-zinc-850 border-zinc-700 text-zinc-300 text-[10px] font-normal">
                            {seg?.nome || 'Turma não encontrada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-zinc-400">{isMon ? '-' : `${hsTotal.toFixed(2)}h`}</TableCell>
                        <TableCell className="text-right font-bold text-zinc-100">{formatCurrency(totalP)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {displayLancs.length > 0 && (
                    <TableRow className="bg-zinc-900/50 font-bold border-zinc-800">
                      <TableCell colSpan={3} className="text-right text-zinc-300 uppercase text-xs tracking-wider">Total Geral da Folha</TableCell>
                      <TableCell className="text-right text-blue-400 text-sm font-extrabold">{formatCurrency(totalGeral)}</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Botão de Ação de Fechamento */}
      {!isFechado && displayLancs.length > 0 && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-zinc-50 font-semibold py-6">
              <Lock className="w-4 h-4 mr-2" />
              Fechar Competência {formatCompetencia(comp)}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Fechamento de Folha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 text-zinc-350 text-sm">
              <p>
                Ao confirmar, todos os lançamentos de horas de <strong>{formatCompetencia(comp)}</strong> serão congelados para edição.
              </p>
              <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded text-blue-400 text-xs">
                <strong>Integração Financeira Ativa</strong>: O fechamento irá criar automaticamente os lançamentos de Contas a Pagar na aba de Lançamentos de forma individual para cada funcionário!
              </div>
              <div className="flex justify-between items-center text-zinc-200 border-t border-b border-zinc-800 py-3">
                <span className="font-medium">Total da Folha:</span>
                <span className="text-lg font-bold text-zinc-50">{formatCurrency(totalGeral)}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs" className="text-zinc-300 text-xs">Observações do Fechamento</Label>
                <Textarea
                  id="obs"
                  placeholder="Ex: Pagamento regular, reajuste retroativo..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-xs"
                />
              </div>
            </div>
            <DialogFooter className="border-t border-zinc-800 pt-4 mt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                Cancelar
              </Button>
              <Button onClick={handleFecharCompetencia} className="bg-blue-600 hover:bg-blue-700 text-zinc-50">
                Confirmar e Lançar Despesas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Histórico Recente */}
      {fechamentos.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800 mt-6">
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="text-sm font-semibold text-zinc-200">Histórico Recente de Fechamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-zinc-800">
                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableHead className="text-zinc-400">Competência</TableHead>
                  <TableHead className="text-zinc-400">Fechado em</TableHead>
                  <TableHead className="text-zinc-400">Observações</TableHead>
                  <TableHead className="text-zinc-400 text-right text-zinc-300">Total Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechamentos.map((f) => (
                  <TableRow key={f.id} className="border-zinc-800 hover:bg-zinc-800/40">
                    <TableCell className="font-semibold text-zinc-100">{formatCompetencia(f.competencia)}</TableCell>
                    <TableCell className="text-zinc-400">{new Date(f.dataFechamento).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-zinc-400 italic max-w-xs truncate">{f.observacao || '—'}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-100">{formatCurrency(f.totalGeral)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
