import { useEffect, useState } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Pencil, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { Segmento, isMonitora } from '../../lib/folhaTypes';
import { formatCurrency } from '../../lib/folhaUtils';

export default function FolhaParametros() {
  const { segmentos, updateSegmento } = useFolha();
  const [segs, setSegs] = useState<Segmento[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Segmento>>({});
  const [monitoraSalario, setMonitoraSalario] = useState<number>(0);

  // Filtra e ordena os segmentos para exibição
  useEffect(() => {
    if (segmentos.length > 0) {
      const priority: Record<string, number> = {
        'Berçário I': 1,
        'Berçário II': 2,
        'Ed. Infantil': 3,
        'Fund. I': 4,
        'Fund. II': 5,
        'Estagiária': 6,
        'Ens. Médio': 7,
      };

      const monitora = segmentos.find((s) => isMonitora(s.nome));
      setMonitoraSalario(Number(monitora?.ajudaCusto) || 0);

      const sorted = [...segmentos]
        .filter((s) => !isMonitora(s.nome))
        .sort((a, b) => (priority[a.nome] || 99) - (priority[b.nome] || 99));
      setSegs(sorted);
    }
  }, [segmentos]);

  const startEdit = (seg: Segmento) => {
    setEditingId(seg.id);
    setEditValues({ ...seg });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const current = segs.find(s => s.id === editingId);
    if (!current) return;

    const horasSemanais = editValues.horasSemanais ?? current.horasSemanais;
    const valorHora = editValues.valorHora ?? current.valorHora;
    const ajudaCusto = editValues.ajudaCusto ?? current.ajudaCusto;
    const horasAtividade = editValues.horasAtividade ?? current.horasAtividade;

    const updatedSeg: Segmento = {
      ...current,
      horasSemanais,
      valorHora,
      ajudaCusto,
      horasAtividade,
    };

    await updateSegmento(updatedSeg);
    setEditingId(null);
    setEditValues({});
    toast.success('Parâmetros da turma atualizados com sucesso!');
  };

  const handleSaveMonitora = async () => {
    const seg = segmentos.find((s) => isMonitora(s.nome));
    if (!seg) {
      toast.error('Segmento Monitora não encontrado.');
      return;
    }

    const ajudaCusto = Number(monitoraSalario) || 0;
    const updatedSeg: Segmento = {
      ...seg,
      horasSemanais: 0,
      valorHora: 0,
      horasAtividade: 0,
      ajudaCusto,
    };

    await updateSegmento(updatedSeg);
    toast.success('Salário da monitora atualizado com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Parâmetros de Cálculo e Valores</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Configure valores hora-aula, ajuda de custo e monitorias</p>
      </div>

      <Tabs defaultValue="segmentos" className="w-full">
        <TabsList className="bg-zinc-905 border border-zinc-800 p-0.5 rounded-lg flex w-fit gap-1 mb-4">
          <TabsTrigger value="segmentos" className="cursor-pointer rounded px-4 py-1.5 text-xs font-semibold text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
            Segmentos (Ensino)
          </TabsTrigger>
          <TabsTrigger value="monitora" className="cursor-pointer rounded px-4 py-1.5 text-xs font-semibold text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
            Monitora (Fixo)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="segmentos" className="space-y-6 outline-none mt-0">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                    <TableHead className="text-zinc-400">Turma/Segmento</TableHead>
                    <TableHead className="text-zinc-400 text-right">Hrs Semanais Padrão</TableHead>
                    <TableHead className="text-zinc-400 text-right">Repouso Semanal</TableHead>
                    <TableHead className="text-zinc-400 text-right">Hora-Atividade (H.A.)</TableHead>
                    <TableHead className="text-zinc-400 text-right">Valor Hora-Aula</TableHead>
                    <TableHead className="text-zinc-400 text-right">Ajuda de Custo (Mensal)</TableHead>
                    <TableHead className="text-zinc-400 text-right w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segs.map((seg) => (
                    <TableRow key={seg.id} className="border-zinc-800 hover:bg-zinc-800/40">
                      <TableCell className="font-semibold text-zinc-150">{seg.nome}</TableCell>
                      {editingId === seg.id ? (
                        <>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto text-right bg-zinc-950 border-zinc-800 text-zinc-100 h-8"
                              value={editValues.horasSemanais ?? ''}
                              onChange={(e) => setEditValues({ ...editValues, horasSemanais: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-zinc-500 text-xs font-mono">1/6 (Fixo)</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-20 ml-auto text-right bg-zinc-950 border-zinc-800 text-zinc-100 h-8"
                              value={editValues.horasAtividade ?? ''}
                              onChange={(e) => setEditValues({ ...editValues, horasAtividade: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 ml-auto text-right bg-zinc-950 border-zinc-800 text-zinc-100 h-8"
                              value={editValues.valorHora ?? ''}
                              onChange={(e) => setEditValues({ ...editValues, valorHora: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 ml-auto text-right bg-zinc-950 border-zinc-800 text-zinc-100 h-8"
                              value={editValues.ajudaCusto ?? ''}
                              onChange={(e) => setEditValues({ ...editValues, ajudaCusto: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-zinc-50 h-8">
                              <Save className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right text-zinc-400 font-mono">{seg.horasSemanais}h</TableCell>
                          <TableCell className="text-right text-zinc-400 font-mono">1/6 (16,67%)</TableCell>
                          <TableCell className="text-right text-zinc-400 font-mono">
                            {seg.horasAtividade.toFixed(2)}h
                            <span className="text-xs text-zinc-500 ml-1">
                              ({((seg.horasAtividade / (seg.horasSemanais * 4.5 || 1)) * 100).toFixed(0)}%)
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-zinc-300 font-bold font-mono">{formatCurrency(seg.valorHora)}</TableCell>
                          <TableCell className="text-right text-zinc-300 font-bold font-mono">{formatCurrency(seg.ajudaCusto)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => startEdit(seg)} className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Fórmulas Explicativas */}
          <Card className="bg-zinc-900 border-zinc-800 mt-6 text-zinc-400 text-xs">
            <CardContent className="pt-6 space-y-3">
              <h4 className="text-sm font-semibold text-zinc-300">Resumo de Fórmulas e Regras</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 bg-zinc-950/40 rounded border border-zinc-800">
                  <div className="text-blue-400 font-bold mb-1">Horas Mensais:</div>
                  <span>Horas Semanais × 4,5</span>
                </div>
                <div className="p-3 bg-zinc-950/40 rounded border border-zinc-800">
                  <div className="text-blue-400 font-bold mb-1">Repouso Semanal Remunerado (RSR):</div>
                  <span>(Horas Mensais + Horas Atividade) ÷ 6</span>
                </div>
                <div className="p-3 bg-zinc-950/40 rounded border border-zinc-800">
                  <div className="text-blue-400 font-bold mb-1">Total de Horas Calculadas:</div>
                  <span>Horas Mensais + Repouso + Horas Atividade</span>
                </div>
                <div className="p-3 bg-zinc-950/40 rounded border border-zinc-800">
                  <div className="text-blue-400 font-bold mb-1">Total a Pagar (Por Turma):</div>
                  <span>Total Horas × Valor da Hora + Ajuda de Custo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitora" className="outline-none mt-0">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end max-w-xl">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="monitoraSal" className="text-zinc-300 text-xs font-semibold">Salário Mensal Fixo (Ajuda de Custo)</Label>
                  <Input
                    id="monitoraSal"
                    type="number"
                    step="0.01"
                    value={monitoraSalario}
                    onChange={(e) => setMonitoraSalario(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 font-bold"
                  />
                  <div className="text-xs text-zinc-500">
                    Valor atualizado: <span className="font-bold text-zinc-300 font-mono">{formatCurrency(monitoraSalario)}</span>
                  </div>
                </div>
                <Button onClick={handleSaveMonitora} className="bg-blue-600 hover:bg-blue-700 text-zinc-50 font-semibold h-10">
                  <Save className="w-4 h-4 mr-2" />Salvar Parâmetro
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
