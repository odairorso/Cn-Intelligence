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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserX, UserCheck, FileText } from 'lucide-react';
import { Professor, gerarLancamento, isMonitora, isEstagiaria } from '../../lib/folhaTypes';
import { formatDateBR, formatCurrency, toNumberBR, formatNumberBR } from '../../lib/folhaUtils';
import { toast } from 'sonner';
import FichaCadastroModal from './FichaCadastroModal';

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

  const [fichaOpen, setFichaOpen] = useState(false);
  const [selectedProfForFicha, setSelectedProfForFicha] = useState<Professor | null>(null);

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

  const handleCreate = async (openFicha = false) => {
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

    const prof = await addProfessor({
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

    if (openFicha && prof) {
      setSelectedProfForFicha(prof as Professor);
      setFichaOpen(true);
    }
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
      return <div className="text-on-surface-variant text-xs py-2">Selecione ao menos 1 turma com horas para ver a simulação.</div>;
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
      <div className="bg-background border border-surface-variant rounded p-3 text-xs space-y-1.5 text-on-surface-variant mt-2 font-mono">
        <div className="font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">Simulação Salarial</div>
        {items.map((it, idx) => (
          <div key={idx}>{it}</div>
        ))}
        <div className="border-t border-surface-variant pt-1.5 font-bold text-on-surface flex justify-between">
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
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant" />
          <Input
            placeholder="Pesquisar professor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface border-surface-variant text-on-surface placeholder:text-on-surface-variant"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-on-surface">
          <Plus className="w-4 h-4 mr-2" />Novo Professor
        </Button>
      </div>

      {/* Tabela */}
      <Card className="bg-surface border-surface-variant">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-surface-variant">
              <TableRow className="border-surface-variant hover:bg-surface/50">
                <TableHead className="text-on-surface-variant">Professor</TableHead>
                <TableHead className="text-on-surface-variant">CPF</TableHead>
                <TableHead className="text-on-surface-variant">Admissão</TableHead>
                <TableHead className="text-on-surface-variant">Turmas / Horas</TableHead>
                <TableHead className="text-on-surface-variant text-right">Status</TableHead>
                <TableHead className="text-on-surface-variant text-right w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((prof) => (
                <TableRow key={prof.id} className="border-surface-variant hover:bg-surface-variant/50/40">
                  <TableCell className="font-semibold text-on-surface">{prof.nome}</TableCell>
                  <TableCell className="text-on-surface-variant">{prof.cpf}</TableCell>
                  <TableCell className="text-on-surface-variant">{formatDateBR(prof.dataAdmissao)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {prof.segmentoIds.map((sid) => {
                        const seg = segmentos.find((s) => s.id === sid);
                        const hs = prof.segmentoHoras?.[sid] || 0;
                        const isMon = seg && isMonitora(seg.nome);
                        return (
                          <Badge key={sid} variant="secondary" className="bg-surface-variant/40 border-surface-variant text-on-surface-variant text-[10px] py-0 px-2 font-normal">
                            {seg?.nome || '?'} {isMon ? '' : `(${hs}h)`}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={prof.ativo ? 'default' : 'secondary'} className={prof.ativo ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10' : 'bg-surface-variant/50 text-on-surface-variant'}>
                      {prof.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-surface border-surface-variant text-on-surface-variant">
                        <DropdownMenuItem onClick={() => { setSelectedProfForFicha(prof); setFichaOpen(true); }} className="hover:bg-surface-variant/50 cursor-pointer">
                          <FileText className="w-4 h-4 mr-2 text-blue-500" />Ficha Cadastral (LGPD)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(prof)} className="hover:bg-surface-variant/50 cursor-pointer">
                          <Pencil className="w-4 h-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleAtivo(prof)} className="hover:bg-surface-variant/50 cursor-pointer">
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
                        <DropdownMenuItem onClick={() => handleDelete(prof.id)} className="hover:bg-surface-variant/50 text-red-400 cursor-pointer">
                          <Trash2 className="w-4 h-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-on-surface-variant">
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
        <DialogContent className="bg-surface border-surface-variant text-on-surface max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Professor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-on-surface-variant text-xs">Nome Completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-on-surface-variant text-xs">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataAdmissao" className="text-on-surface-variant text-xs">Data de Admissão</Label>
              <Input id="dataAdmissao" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
            </div>

            <div className="border-t border-surface-variant pt-4">
              <Label className="text-on-surface-variant font-semibold text-xs block mb-3">Horas Semanais por Turma</Label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {slots.map((slot, index) => {
                  const seg = segmentos.find((s) => s.id === slot.segId);
                  return (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-on-surface-variant font-medium truncate flex-1">{seg?.nome}</span>
                      <Input
                        type="text"
                        placeholder="0"
                        value={slot.horas}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSlots(slots.map((s, idx) => (idx === index ? { ...s, horas: val } : s)));
                        }}
                        className="w-20 text-right bg-background border-surface-variant text-on-surface h-8"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {renderPreview(slots)}
          </div>
          <DialogFooter className="border-t border-surface-variant pt-4 mt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50">
              Cancelar
            </Button>
            <div className="flex gap-2">
              <Button onClick={() => handleCreate(false)} variant="outline" className="border-surface-variant text-on-surface hover:bg-surface-variant/50">
                Apenas Cadastrar
              </Button>
              <Button onClick={() => handleCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-on-surface">
                <FileText className="w-4 h-4 mr-2" />
                Cadastrar e Preencher Ficha Completa
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-surface border-surface-variant text-on-surface max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Professor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editNome" className="text-on-surface-variant text-xs">Nome Completo</Label>
                <Input id="editNome" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCpf" className="text-on-surface-variant text-xs">CPF</Label>
                <Input id="editCpf" value={editCpf} onChange={(e) => setEditCpf(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDataAdmissao" className="text-on-surface-variant text-xs">Data de Admissão</Label>
              <Input id="editDataAdmissao" type="date" value={editDataAdmissao} onChange={(e) => setEditDataAdmissao(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
            </div>

            <div className="border-t border-surface-variant pt-4">
              <Label className="text-on-surface-variant font-semibold text-xs block mb-3">Horas Semanais por Turma</Label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {editSlots.map((slot, index) => {
                  const seg = segmentos.find((s) => s.id === slot.segId);
                  return (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-on-surface-variant font-medium truncate flex-1">{seg?.nome}</span>
                      <Input
                        type="text"
                        placeholder="0"
                        value={slot.horas}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditSlots(editSlots.map((s, idx) => (idx === index ? { ...s, horas: val } : s)));
                        }}
                        className="w-20 text-right bg-background border-surface-variant text-on-surface h-8"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {renderPreview(editSlots)}
          </div>
          <DialogFooter className="border-t border-surface-variant pt-4 mt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-on-surface">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedProfForFicha && (
        <FichaCadastroModal 
          professor={selectedProfForFicha} 
          open={fichaOpen} 
          onOpenChange={setFichaOpen} 
        />
      )}
    </div>
  );
}
