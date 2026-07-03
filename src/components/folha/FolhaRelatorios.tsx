import { useEffect, useMemo, useState } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download, FileText, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../../api';
import { gerarLancamento, isMonitora } from '../../lib/folhaTypes';
import { formatCurrency, formatCompetencia, gerarMesesDisponiveis, competenciaAtual, formatDateBR } from '../../lib/folhaUtils';

const MESES = gerarMesesDisponiveis(12);
const TODOS_PROFESSORES = '__all__';

export default function FolhaRelatorios() {
  const { professores, segmentos, fechamentos } = useFolha();
  const [comp, setComp] = useState(competenciaAtual);
  const [professorId, setProfessorId] = useState<string>(TODOS_PROFESSORES);
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

  const profMap = useMemo(() => new Map(professores.map(p => [String(p.id), p])), [professores]);
  const segMap = useMemo(() => new Map(segmentos.map(s => [s.id, s])), [segmentos]);

  const optionsProfessores = useMemo(() => {
    const list = [{ value: TODOS_PROFESSORES, label: "Todos os professores" }];
    professores
      .filter((p) => p.ativo)
      .forEach((p) => {
        list.push({ value: String(p.id), label: p.nome });
      });
    return list;
  }, [professores]);

  // Cálculo reativo para o mês aberto
  const dynamicLancs = useMemo((): any[] => {
    const list: any[] = [];
    professores.filter(p => p.ativo).forEach(p => {
      p.segmentoIds.forEach(segId => {
        const seg = segMap.get(segId);
        if (!seg) return;
        const l = gerarLancamento(p, seg, comp);
        list.push({ ...l, professorId: p.id, segmentoId: segId, id: `l-${p.id}-${segId}-${comp}` });
      });
    });
    return list;
  }, [professores, comp, segMap]);

  const compLancs = isFechado ? frozenLancs : dynamicLancs;

  const lancsFiltrados = useMemo(() => {
    if (professorId === TODOS_PROFESSORES) return compLancs;
    return compLancs.filter((l) => String(l.professorId || l.professor_id || '') === String(professorId));
  }, [compLancs, professorId]);

  const professorSelecionado = useMemo(() => {
    if (professorId === TODOS_PROFESSORES) return null;
    return profMap.get(String(professorId)) ?? null;
  }, [professorId, profMap]);

  const segData = useMemo(() => {
    return segmentos.map((seg) => {
      const segLancs = lancsFiltrados.filter((l) => (l.segmentoId || l.segmento_id) === seg.id);
      return {
        segmento: seg.nome,
        professores: segLancs.length,
        totalHoras: segLancs.reduce((s, l) => s + Number(l.total_horas || l.totalHoras || 0), 0),
        totalPagar: segLancs.reduce((s, l) => s + Number(l.total_pagar || l.totalPagar || 0), 0),
      };
    }).filter((s) => s.professores > 0);
  }, [lancsFiltrados, segmentos]);

  const totalGeral = useMemo(() => lancsFiltrados.reduce((s, l) => s + Number(l.total_pagar || l.totalPagar || 0), 0), [lancsFiltrados]);

  const totaisPorProfessor = useMemo(() => {
    const map = new Map<string, { nome: string; totalHoras: number; totalPagar: number }>();
    lancsFiltrados.forEach((l) => {
      const pId = l.professorId || l.professor_id;
      const nome = profMap.get(String(pId))?.nome ?? pId;
      const cur = map.get(String(pId)) ?? { nome, totalHoras: 0, totalPagar: 0 };
      cur.totalHoras += Number(l.total_horas || l.totalHoras || 0);
      cur.totalPagar += Number(l.total_pagar || l.totalPagar || 0);
      map.set(String(pId), cur);
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [lancsFiltrados, profMap]);

  const exportCSV = () => {
    const header1 = 'Professor,Segmento,Hrs Mensais,Repouso,H.A.,Total Hrs,Ajuda Custo,Total Pagar\n';
    const rows1 = lancsFiltrados.map((l) => {
      const pId = l.professorId || l.professor_id;
      const sId = l.segmentoId || l.segmento_id;
      const prof = profMap.get(String(pId));
      const seg = segMap.get(sId);
      return `${prof?.nome},${seg?.nome},${l.horas_mensais || l.horasMensais},${l.repouso},${l.horas_atividade || l.horasAtividade},${l.total_horas || l.totalHoras},${l.ajuda_custo || l.ajudaCusto},${l.total_pagar || l.totalPagar}`;
    }).join('\n');
    const header2 = '\n\nTotais por Professor\nProfessor,Total Horas,Total a Pagar\n';
    const rows2 = totaisPorProfessor.map((r) => `${r.nome},${r.totalHoras.toFixed(2)},${r.totalPagar.toFixed(2)}`).join('\n');
    const blob = new Blob([header1 + rows1 + header2 + rows2], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${comp}${professorSelecionado ? `-${professorSelecionado.nome}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const title = `Relatório — ${formatCompetencia(comp)}${professorSelecionado ? ` — ${professorSelecionado.nome}` : ''}`;
    const sanitize = (name: string) => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '')
        .toLowerCase();
    };

    const dataGeracao = new Date().toLocaleString('pt-BR');
    const doc = new jsPDF({
      orientation: professorSelecionado ? 'portrait' : 'landscape',
      unit: 'pt',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();

    const didDrawPage = (data: { pageNumber: number }) => {
      doc.setFontSize(12);
      doc.text('Cálculo Salário Professores', 40, 28);
      doc.setFontSize(10);
      doc.text(title, 40, 46);
      doc.text(`Gerado em: ${dataGeracao}`, pageWidth - 40, 28, { align: 'right' });
      doc.text(`Página ${data.pageNumber}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 18, { align: 'right' });
    };

    const commonTable = {
      theme: 'grid' as const,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [30, 50, 80] as [number, number, number] },
      alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
      margin: { top: 70, left: 40, right: 40, bottom: 30 },
      didDrawPage,
    };

    if (professorSelecionado) {
      const totalHoras = lancsFiltrados.reduce((s, l) => s + Number(l.total_horas || l.totalHoras || 0), 0);
      const totalPagar = lancsFiltrados.reduce((s, l) => s + Number(l.total_pagar || l.totalPagar || 0), 0);

      doc.setFontSize(10);
      doc.text(`Professor: ${professorSelecionado.nome}`, 40, 64);
      doc.text(`CPF: ${professorSelecionado.cpf}`, 40, 80);
      doc.text(`Admissão: ${formatDateBR(professorSelecionado.dataAdmissao)}`, 40, 96);
      doc.text(`Total do mês: ${formatCurrency(totalPagar)} (${totalHoras.toFixed(2)}h)`, 40, 112);

      autoTable(doc, {
        ...commonTable,
        startY: 130,
        head: [['Segmento', 'Valor Hora', 'Hrs Mensais', 'Repouso', 'H.A.', 'Total Hrs', 'Ajuda Custo', 'Total a Pagar']],
        body: lancsFiltrados.map((l) => {
          const sId = l.segmentoId || l.segmento_id;
          const seg = segMap.get(sId);
          return [
            seg?.nome ?? '',
            seg ? formatCurrency(seg.valorHora) : '',
            `${Number(l.horas_mensais || l.horasMensais || 0).toFixed(2)}h`,
            `${Number(l.repouso || 0).toFixed(2)}h`,
            `${Number(l.horas_atividade || l.horasAtividade || 0).toFixed(2)}h`,
            `${Number(l.total_horas || l.totalHoras || 0).toFixed(2)}h`,
            formatCurrency(Number(l.ajuda_custo || l.ajudaCusto || 0)),
            formatCurrency(Number(l.total_pagar || l.totalPagar || 0)),
          ];
        }),
        foot: [[
          'TOTAL',
          '',
          '',
          '',
          '',
          `${totalHoras.toFixed(2)}h`,
          '',
          formatCurrency(totalPagar),
        ]],
        footStyles: { fillColor: [230, 233, 238] as [number, number, number], textColor: 20, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 150 },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
        },
      });
    } else {
      doc.setFontSize(10);
      doc.text(`Total geral: ${formatCurrency(totalGeral)}`, 40, 64);

      autoTable(doc, {
        ...commonTable,
        startY: 80,
        head: [['Consolidado por Segmento', 'Professores', 'Total Horas', 'Total a Pagar']],
        body: segData.map((s) => [s.segmento, String(s.professores), `${s.totalHoras.toFixed(2)}h`, formatCurrency(s.totalPagar)]),
        foot: [['TOTAL', '', '', formatCurrency(totalGeral)]],
        footStyles: { fillColor: [230, 233, 238] as [number, number, number], textColor: 20, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      });

      const y1 = (doc as any).lastAutoTable?.finalY ?? 80;
      autoTable(doc, {
        ...commonTable,
        startY: y1 + 18,
        head: [['Totais por Professor (Mensal)', 'Total Horas', 'Total a Pagar']],
        body: totaisPorProfessor.map((r) => [r.nome, `${r.totalHoras.toFixed(2)}h`, formatCurrency(r.totalPagar)]),
        foot: [[
          'TOTAL',
          `${totaisPorProfessor.reduce((s, r) => s + r.totalHoras, 0).toFixed(2)}h`,
          formatCurrency(totaisPorProfessor.reduce((s, r) => s + r.totalPagar, 0)),
        ]],
        footStyles: { fillColor: [230, 233, 238] as [number, number, number], textColor: 20, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      });

      const y2 = (doc as any).lastAutoTable?.finalY ?? y1 + 18;
      autoTable(doc, {
        ...commonTable,
        startY: y2 + 18,
        styles: { fontSize: 8, cellPadding: 3 },
        head: [['Detalhamento', 'Segmento', 'Hrs Mensais', 'Repouso', 'H.A.', 'Total Hrs', 'Ajuda Custo', 'Total a Pagar']],
        body: lancsFiltrados.map((l) => {
          const pId = l.professorId || l.professor_id;
          const sId = l.segmentoId || l.segmento_id;
          const p = profMap.get(String(pId));
          const seg = segMap.get(sId);
          return [
            p?.nome ?? '',
            seg?.nome ?? '',
            `${Number(l.horas_mensais || l.horasMensais || 0).toFixed(2)}h`,
            `${Number(l.repouso || 0).toFixed(2)}h`,
            `${Number(l.horas_atividade || l.horasAtividade || 0).toFixed(2)}h`,
            `${Number(l.total_horas || l.totalHoras || 0).toFixed(2)}h`,
            formatCurrency(Number(l.ajuda_custo || l.ajudaCusto || 0)),
            formatCurrency(Number(l.total_pagar || l.totalPagar || 0)),
          ];
        }),
        columnStyles: {
          0: { cellWidth: 150 },
          1: { cellWidth: 120 },
        },
      });
    }

    const fileName = `relatorio-${comp}${professorSelecionado ? `-${sanitize(professorSelecionado.nome)}` : ''}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      {/* Filtros superiores */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Relatórios e Demonstrativos</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">Visualize estatísticas detalhadas e exporte os recibos em PDF/CSV</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchableSelect
            value={professorId}
            onValueChange={setProfessorId}
            options={optionsProfessores}
            placeholder="Todos os professores"
            searchPlaceholder="Pesquisar professor..."
            emptyMessage="Nenhum professor encontrado."
            className="w-[200px]"
          />
          <Select value={comp} onValueChange={setComp}>
            <SelectTrigger className="w-[160px] bg-surface border-surface-variant text-on-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface border-surface-variant text-on-surface-variant">
              {MESES.map(m => (
                <SelectItem key={m.value} value={m.value} className="cursor-pointer">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportPDF} className="bg-blue-600 hover:bg-blue-700 text-on-surface font-semibold">
            <FileDown className="w-4 h-4 mr-2" />Exportar PDF
          </Button>
          <Button onClick={exportCSV} variant="outline" className="border-surface-variant text-on-surface-variant hover:bg-surface-variant/50">
            <Download className="w-4 h-4 mr-2" />CSV
          </Button>
        </div>
      </div>

      {/* Consolidado por Segmento */}
      <Card className="bg-surface border-surface-variant">
        <CardHeader className="border-b border-surface-variant">
          <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            Resumo por Segmento de Ensino
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-surface-variant">
              <TableRow className="border-surface-variant hover:bg-surface/50">
                <TableHead className="text-on-surface-variant">Segmento</TableHead>
                <TableHead className="text-on-surface-variant text-right">Professores</TableHead>
                <TableHead className="text-on-surface-variant text-right">Carga Horária Total</TableHead>
                <TableHead className="text-on-surface-variant text-right text-on-surface-variant font-semibold">Valor Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLancs ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-on-surface-variant animate-pulse">
                    Carregando consolidados...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {segData.map((s) => (
                    <TableRow key={s.segmento} className="border-surface-variant hover:bg-surface-variant/50/40">
                      <TableCell className="font-medium text-zinc-150">{s.segmento}</TableCell>
                      <TableCell className="text-right text-on-surface-variant">{s.professores}</TableCell>
                      <TableCell className="text-right text-on-surface-variant">{s.totalHoras.toFixed(2)}h</TableCell>
                      <TableCell className="text-right font-bold text-on-surface">{formatCurrency(s.totalPagar)}</TableCell>
                    </TableRow>
                  ))}
                  {segData.length > 0 && (
                    <TableRow className="bg-surface/50 font-bold border-surface-variant">
                      <TableCell colSpan={3} className="text-right text-on-surface-variant uppercase text-xs tracking-wider">Total Acumulado</TableCell>
                      <TableCell className="text-right text-blue-400 text-sm font-extrabold">{formatCurrency(totalGeral)}</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gráfico */}
      {segData.length > 0 && (
        <Card className="bg-surface border-surface-variant">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface">Custos por Turma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={segData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="segmento" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '6px' }}
                />
                <Bar dataKey="totalPagar" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detalhado */}
      <Card className="bg-surface border-surface-variant">
        <CardHeader className="border-b border-surface-variant">
          <CardTitle className="text-sm font-semibold text-on-surface">Demonstrativo por Lançamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-surface-variant">
              <TableRow className="border-surface-variant hover:bg-surface/50">
                <TableHead className="text-on-surface-variant">Professor</TableHead>
                <TableHead className="text-on-surface-variant">Turma/Segmento</TableHead>
                <TableHead className="text-on-surface-variant text-right">Hrs Mensais</TableHead>
                <TableHead className="text-on-surface-variant text-right">Repouso</TableHead>
                <TableHead className="text-on-surface-variant text-right">H.A. (Atividade)</TableHead>
                <TableHead className="text-on-surface-variant text-right font-medium">Total Hrs</TableHead>
                <TableHead className="text-on-surface-variant text-right">Ajuda Custo</TableHead>
                <TableHead className="text-on-surface-variant text-right text-on-surface-variant font-semibold">Total a Pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLancs ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-on-surface-variant animate-pulse">
                    Carregando demonstrativo detalhado...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {lancsFiltrados.map((l) => {
                    const prof = profMap.get(String(l.professorId || l.professor_id));
                    const seg = segMap.get(l.segmentoId || l.segmento_id);
                    const isMon = seg && isMonitora(seg.nome);
                    const hsMensais = Number(l.horas_mensais || l.horasMensais || 0);
                    const hsRepouso = Number(l.repouso || 0);
                    const hsAtividade = Number(l.horas_atividade || l.horasAtividade || 0);
                    const hsTotal = Number(l.total_horas || l.totalHoras || 0);
                    const ajudaC = Number(l.ajuda_custo || l.ajudaCusto || 0);
                    const totalP = Number(l.total_pagar || l.totalPagar || 0);

                    return (
                      <TableRow key={l.id} className="border-surface-variant hover:bg-surface-variant/50/40">
                        <TableCell className="font-medium text-zinc-150">{prof?.nome || 'Professor não encontrado'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-surface-variant/40 border-surface-variant text-on-surface-variant text-[10px] font-normal">
                            {seg?.nome || 'Turma não encontrada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-zinc-450">{isMon ? '-' : hsMensais.toFixed(2)}h</TableCell>
                        <TableCell className="text-right text-zinc-455">{isMon ? '-' : hsRepouso.toFixed(2)}h</TableCell>
                        <TableCell className="text-right text-zinc-455">{isMon ? '-' : hsAtividade.toFixed(2)}h</TableCell>
                        <TableCell className="text-right font-medium text-on-surface-variant">{isMon ? '-' : `${hsTotal.toFixed(2)}h`}</TableCell>
                        <TableCell className="text-right text-zinc-455">{ajudaC > 0 ? formatCurrency(ajudaC) : '-'}</TableCell>
                        <TableCell className="text-right font-bold text-on-surface">{formatCurrency(totalP)}</TableCell>
                      </TableRow>
                    );
                  })}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumos por Professor */}
      {totaisPorProfessor.length > 0 && (
        <Card className="bg-surface border-surface-variant">
          <CardHeader className="border-b border-surface-variant">
            <CardTitle className="text-sm font-semibold text-on-surface">Demonstrativo por Funcionário</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-surface-variant">
                <TableRow className="border-surface-variant hover:bg-surface/50">
                  <TableHead className="text-on-surface-variant">Professor</TableHead>
                  <TableHead className="text-on-surface-variant text-right">Total de Horas</TableHead>
                  <TableHead className="text-on-surface-variant text-right text-on-surface-variant font-semibold">Valor Total a Receber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLancs ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-on-surface-variant animate-pulse">
                      Carregando totais...
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {totaisPorProfessor.map((r) => (
                      <TableRow key={r.nome} className="border-surface-variant hover:bg-surface-variant/50/40">
                        <TableCell className="font-medium text-zinc-150">{r.nome}</TableCell>
                        <TableCell className="text-right text-on-surface-variant">{r.totalHoras.toFixed(2)}h</TableCell>
                        <TableCell className="text-right font-bold text-on-surface">{formatCurrency(r.totalPagar)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-surface/50 font-bold border-surface-variant">
                      <TableCell className="text-right text-on-surface-variant uppercase text-xs tracking-wider">Total Geral</TableCell>
                      <TableCell className="text-right text-on-surface-variant">
                        {totaisPorProfessor.reduce((s, r) => s + r.totalHoras, 0).toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right text-blue-400 text-sm font-extrabold">
                        {formatCurrency(totaisPorProfessor.reduce((s, r) => s + r.totalPagar, 0))}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
