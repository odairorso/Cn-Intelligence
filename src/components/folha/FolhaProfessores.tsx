import { useState, useMemo, useEffect } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserX, UserCheck } from 'lucide-react';
import { Professor, gerarLancamento, isMonitora, isEstagiaria } from '../../lib/folhaTypes';
import { formatDateBR, formatCurrency, toNumberBR, formatNumberBR } from '../../lib/folhaUtils';
import { toast } from 'sonner';

interface SegSlot {
  segId: string;
  horas: string;
}

export default function FolhaProfessores() {
  const { segmentos, professores, addProfessor, updateProfessor, deleteProfessor } = useFolha();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<SegSlot[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Professor | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editDataAdmissao, setEditDataAdmissao] = useState('');
  const [editSlots, setEditSlots] = useState<SegSlot[]>([]);

  // Prepara os slots ao abrir a criação
  useEffect(() => {
    if (dialogOpen && segmentos.length > 0) {
      setSlots(segmentos.map((s) => ({ segId: s.id, horas: '' })));
      setDataAdmissao(new Date().toISOString().split('T')[0]);
    }
  }, [dialogOpen, segmentos]);

  const filtered = useMemo(() => {
    return professores.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));
  }, [professores, search]);

  const handleCreate = async () => {
    const validSlots = slots.filter((s) => {
      if (!s.segId) return false;
      return toNumberBR(s.horas) > 0;
    });

    if (!nome.trim()) {
      toast.error('Informe o nome do professor');
      return;
    }
    if (validSlots.length === 0) {
      toast.error('Informe horas em pelo menos uma turma');
      return;
    }

    const segmentoHoras: Record<string, number> = {};
    const segmentoIds: string[] = [];
    validSlots.forEach((s) => {
      const horas = toNumberBR(s.horas) || 0;
      if (!segmentoIds.includes(s.segId)) {
        segmentoIds.push(s.segId);
        segmentoHoras[s.segId] = horas;
      } else {
        segmentoHoras[s.segId] += horas;
      }
    });

    await addProfessor({
      nome: nome.trim(),
      cpf: cpf.trim() || 'NÃO INFORMADO',
      dataAdmissao,
      segmentoIds,
      segmentoHoras,
      ativo: true,
    });

    setNome('');
    setCpf('');
    setDialogOpen(false);
  };

  const openEdit = (p: Professor) => {
    setEditing(p);
    setEditNome(p.nome);
    setEditCpf(p.cpf);
    setEditDataAdmissao(p.dataAdmissao || '');

    const newSlots = segmentos.map((s) => {
      const h = p.segmentoHoras?.[s.id];
      return { segId: s.id, horas: (h !== undefined && h !== null) ? String(h) : '' };
    });
    setEditSlots(newSlots);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const validSlots = editSlots.filter((s) => {
      if (!s.segId) return false;
      return toNumberBR(s.horas) > 0;
    });

    if (!editNome.trim()) {
      toast.error('Informe o nome do professor');
      return;
    }
    if (validSlots.length === 0) {
      toast.error('Informe horas em pelo menos uma turma');
      return;
    }

    const segmentoHoras: Record<string, number> = {};
    const segmentoIds: string[] = [];
    validSlots.forEach((s) => {
      const horas = toNumberBR(s.horas) || 0;
      if (!segmentoIds.includes(s.segId)) {
        segmentoIds.push(s.segId);
        segmentoHoras[s.segId] = horas;
      } else {
        segmentoHoras[s.segId] += horas;
      }
    });

    await updateProfessor(editing.id, {
      nome: editNome.trim(),
      cpf: editCpf.trim() || 'NÃO INFORMADO',
      dataAdmissao: editDataAdmissao,
      segmentoIds,
      segmentoHoras,
    });

    setEditOpen(false);
    setEditing(null);
  };

  const handleToggleAtivo = async (p: Professor) => {
    await updateProfessor(p.id, { ativo: !p.ativo });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este professor? Todos os históricos e turmas dele serão apagados.')) {
      await deleteProfessor(id);
    }
  };

  // Renderiza o preview salarial em tempo real
  const renderPreview = (currentSlots: SegSlot[]) => {
    const valid = currentSlots.filter((s) => {
      if (!s.segId) return false;
      return toNumberBR(s.horas) > 0;
    });

    if (valid.length === 0) {
      return <div className="text-zinc-500 text-xs py-2">Selecione ao menos 1 turma com horas para ver a simulação.</div>;
    }

    let salario = 0;
    const items: string[] = [];

    const dummyProf: Professor = {
      id: 'preview',
      nome: '',
      cpf: '',
      dataAdmissao: '',
      segmentoIds: [],
      segmentoHoras: {},
      ativo: true,
    };

    valid.forEach((s) => {
      const seg = segmentos.find((x) => x.id === s.segId);
      if (!seg) return;
      const hs = toNumberBR(s.horas);

      if (isMonitora(seg.nome)) {
        const fixo = Number(seg.ajudaCusto) || 0;
        salario += fixo;
        items.push(`${seg.nome}: ${formatCurrency(fixo)} (fixo)`);
        return;
      }

      dummyProf.segmentoHoras![seg.id] = hs;
      const l = gerarLancamento(dummyProf, seg, '');
      salario += l.totalPagar;
      items.push(`${seg.nome} (${hs}h): ${formatCurrency(l.totalPagar)}`);
    });

    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs space-y-1.5 text-zinc-300 mt-2 font-mono">
        <div className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Simulação Salarial</div>
        {items.map((it, idx) => (
          <div key={idx}>{it}</div>
        ))}
        <div className="border-t border-zinc-800 pt-1.5 font-bold text-zinc-50 flex justify-between">
          <span>TOTAL ESTIMADO:</span>
          <span>{formatCurrency(salario)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de Pesquisa e Novo */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Pesquisar professor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-zinc-50">
          <Plus className="w-4 h-4 mr-2" />Novo Professor
        </Button>
      </div>

      {/* Tabela */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-zinc-800">
              <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="text-zinc-400">Professor</TableHead>
                <TableHead className="text-zinc-400">CPF</TableHead>
                <TableHead className="text-zinc-400">Admissão</TableHead>
                <TableHead className="text-zinc-400">Turmas / Horas</TableHead>
                <TableHead className="text-zinc-400 text-right">Status</TableHead>
                <TableHead className="text-zinc-400 text-right w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((prof) => (
                <TableRow key={prof.id} className="border-zinc-800 hover:bg-zinc-800/40">
                  <TableCell className="font-semibold text-zinc-100">{prof.nome}</TableCell>
                  <TableCell className="text-zinc-400">{prof.cpf}</TableCell>
                  <TableCell className="text-zinc-400">{formatDateBR(prof.dataAdmissao)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {prof.segmentoIds.map((sid) => {
                        const seg = segmentos.find((s) => s.id === sid);
                        const hs = prof.segmentoHoras?.[sid] || 0;
                        const isMon = seg && isMonitora(seg.nome);
                        return (
                          <Badge key={sid} variant="secondary" className="bg-zinc-850 border-zinc-700 text-zinc-300 text-[10px] py-0 px-2 font-normal">
                            {seg?.nome || '?'} {isMon ? '' : `(${hs}h)`}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={prof.ativo ? 'default' : 'secondary'} className={prof.ativo ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10' : 'bg-zinc-800 text-zinc-400'}>
                      {prof.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                        <DropdownMenuItem onClick={() => openEdit(prof)} className="hover:bg-zinc-800 cursor-pointer">
                          <Pencil className="w-4 h-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleAtivo(prof)} className="hover:bg-zinc-800 cursor-pointer">
                          {prof.ativo ? (
                            <>
                              <UserX className="w-4 h-4 mr-2 text-amber-500" />Desativar
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-2 text-emerald-500" />Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(prof.id)} className="hover:bg-zinc-800 text-red-400 cursor-pointer">
                          <Trash2 className="w-4 h-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                    Nenhum professor encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Cadastro */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Professor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-zinc-300 text-xs">Nome Completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-zinc-300 text-xs">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataAdmissao" className="text-zinc-300 text-xs">Data de Admissão</Label>
              <Input id="dataAdmissao" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <Label className="text-zinc-300 font-semibold text-xs block mb-3">Horas Semanais por Turma</Label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {slots.map((slot, index) => {
                  const seg = segmentos.find((s) => s.id === slot.segId);
                  return (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-400 font-medium truncate flex-1">{seg?.nome}</span>
                      <Input
                        type="text"
                        placeholder="0"
                        value={slot.horas}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSlots(slots.map((s, idx) => (idx === index ? { ...s, horas: val } : s)));
                        }}
                        className="w-20 text-right bg-zinc-950 border-zinc-800 text-zinc-100 h-8"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {renderPreview(slots)}
          </div>
          <DialogFooter className="border-t border-zinc-800 pt-4 mt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
              Cancelar
            </Button>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-zinc-50">
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Professor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editNome" className="text-zinc-300 text-xs">Nome Completo</Label>
                <Input id="editNome" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCpf" className="text-zinc-300 text-xs">CPF</Label>
                <Input id="editCpf" value={editCpf} onChange={(e) => setEditCpf(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDataAdmissao" className="text-zinc-300 text-xs">Data de Admissão</Label>
              <Input id="editDataAdmissao" type="date" value={editDataAdmissao} onChange={(e) => setEditDataAdmissao(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <Label className="text-zinc-300 font-semibold text-xs block mb-3">Horas Semanais por Turma</Label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {editSlots.map((slot, index) => {
                  const seg = segmentos.find((s) => s.id === slot.segId);
                  return (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-400 font-medium truncate flex-1">{seg?.nome}</span>
                      <Input
                        type="text"
                        placeholder="0"
                        value={slot.horas}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditSlots(editSlots.map((s, idx) => (idx === index ? { ...s, horas: val } : s)));
                        }}
                        className="w-20 text-right bg-zinc-950 border-zinc-800 text-zinc-100 h-8"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {renderPreview(editSlots)}
          </div>
          <DialogFooter className="border-t border-zinc-800 pt-4 mt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-zinc-50">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
