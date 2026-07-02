import { useMemo } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Users, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { formatCurrency, formatCompetencia } from '../../lib/folhaUtils';
import { Segmento, gerarLancamento } from '../../lib/folhaTypes';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function FolhaDashboard() {
  const { professores, segmentos } = useFolha();

  const ativos = professores.filter((p) => p.ativo).length;
  const comp = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Calcula lançamentos dinamicamente para o mês atual
  const lancamentos = useMemo(() => {
    const segMap = new Map<string, Segmento>(segmentos.map(s => [s.id, s]));
    return professores.filter(p => p.ativo).flatMap((prof) =>
      prof.segmentoIds.flatMap((segId) => {
        const seg = segMap.get(segId);
        if (!seg) return [];
        const l = gerarLancamento(prof, seg, comp);
        return [{ professorId: prof.id, segmentoId: segId, totalPagar: l.totalPagar, totalHoras: l.totalHoras }];
      })
    );
  }, [professores, segmentos, comp]);

  const totalFolha = useMemo(() => lancamentos.reduce((sum, l) => sum + l.totalPagar, 0), [lancamentos]);
  const totalHoras = useMemo(() => lancamentos.reduce((sum, l) => sum + l.totalHoras, 0), [lancamentos]);

  // Custo por segmento
  const segData = useMemo(() => segmentos.map((seg) => {
    const segLancs = lancamentos.filter((l) => l.segmentoId === seg.id);
    return {
      nome: seg.nome,
      total: segLancs.reduce((s, l) => s + l.totalPagar, 0),
      horas: segLancs.reduce((s, l) => s + l.totalHoras, 0),
      professores: segLancs.length,
    };
  }), [lancamentos, segmentos]);

  const pieData = segData.filter((s) => s.total > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Professores Ativos</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{ativos}</div>
            <p className="text-xs text-zinc-500 mt-1">{professores.length} cadastrados</p>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total da Folha</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{formatCurrency(totalFolha)}</div>
            <p className="text-xs text-zinc-500 mt-1">Competência {formatCompetencia(comp)}</p>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total de Horas</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{totalHoras.toFixed(1)}h</div>
            <p className="text-xs text-zinc-500 mt-1">Horas estimadas semanais</p>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Turmas</CardTitle>
            <TrendingUp className="w-4 h-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-50">{segmentos.length}</div>
            <p className="text-xs text-zinc-500 mt-1">Níveis cadastrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-200">Custo Mensal por Turma/Segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={segData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="nome" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '6px' }}
                  labelStyle={{ color: '#f4f4f5' }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 2 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-200">Distribuição Financeira</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="total"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '6px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
