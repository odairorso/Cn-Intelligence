import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Segmento, Professor, Fechamento, Lancamento, Cargo } from '../lib/folhaTypes';
import { toast } from 'sonner';

interface FolhaContextType {
  segmentos: Segmento[];
  professores: Professor[];
  fechamentos: Fechamento[];
  cargos: Cargo[];
  loading: boolean;
  refreshData: () => Promise<void>;
  addProfessor: (p: Omit<Professor, 'id'>) => Promise<any>;
  updateProfessor: (id: string, patch: Partial<Professor>) => Promise<void>;
  deleteProfessor: (id: string) => Promise<void>;
  addFechamento: (f: Omit<Fechamento, 'id'>, lancs: Omit<Lancamento, 'id'>[], lancsFin: { nome: string; totalPagar: number }[]) => Promise<void>;
  updateSegmento: (seg: Segmento) => Promise<void>;
  createSegmento: (seg: Omit<Segmento, 'id'>) => Promise<void>;
  createCargo: (nome: string) => Promise<void>;
  deleteCargo: (id: string) => Promise<void>;
}

const FolhaContext = createContext<FolhaContextType | undefined>(undefined);

export const useFolha = () => {
  const context = useContext(FolhaContext);
  if (!context) throw new Error('useFolha deve ser usado dentro de um FolhaProvider');
  return context;
};

export const FolhaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [segsData, profsData, fechsData, cargosData] = await Promise.all([
        api.getFolhaSegmentos(),
        api.getFolhaProfessores(),
        api.getFolhaFechamentos(),
        api.getFolhaCargos(),
      ]);

      // Mapeia segmentos do backend para o formato do frontend
      const mappedSegs = segsData.map((s: any) => {
        const hs = Number(s.horas_semanais) || 10;
        const haPercent = Number(s.ha_percent) || 0;
        const percRepouso = Number(s.perc_repouso) || (1 / 6);
        return {
          id: s.id,
          nome: s.nome,
          horasSemanais: hs,
          percRepouso,
          horasAtividade: hs * 4.5 * haPercent,
          valorHora: Number(s.valor_hora) || 0,
          ajudaCusto: Number(s.ajuda_custo) || 0,
        } as Segmento;
      });

      // Mapeia professores
      const mappedProfs = profsData.map((p: any) => {
        const segmentoHoras: Record<string, number> = {};
        if (p.segmentoHoras) {
          for (const [k, v] of Object.entries(p.segmentoHoras)) {
            segmentoHoras[k] = Number(v) || 0;
          }
        }
        return {
          id: p.id,
          nome: p.nome,
          cpf: p.cpf,
          dataAdmissao: p.data_admissao ? p.data_admissao.split('T')[0] : '',
          cargo: p.cargo || '',
          salarioFixo: Number(p.salario_fixo) || 0,
          segmentoIds: p.segmentoIds || [],
          segmentoHoras,
          ativo: p.ativo !== false,
          fichaCadastro: p.ficha_cadastro || {},
        } as Professor;
      });

      // Mapeia fechamentos
      const mappedFechs = fechsData.map((f: any) => ({
        id: f.id,
        competencia: f.competencia,
        dataFechamento: f.data_fechamento ? f.data_fechamento.split('T')[0] : '',
        observacao: f.observacao || '',
        totalGeral: Number(f.total_geral) || 0,
      })) as Fechamento[];

      setSegmentos(mappedSegs);
      setProfessores(mappedProfs);
      setFechamentos(mappedFechs);
      setCargos(cargosData.map((c: any) => ({ id: c.id, nome: c.nome })));
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao sincronizar dados da folha de pagamento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addProfessor = async (p: Omit<Professor, 'id'>) => {
    try {
      const segmentosList = p.segmentoIds.map(sid => ({
        segmentoId: sid,
        horasSemanais: p.segmentoHoras?.[sid] || 0,
      })).filter(s => s.segmentoId);

      const body = {
        nome: p.nome,
        cpf: p.cpf,
        dataAdmissao: p.dataAdmissao,
        segmentos: segmentosList,
        ativo: p.ativo,
      };

      const data = await api.createFolhaProfessor(body);
      toast.success('Professor cadastrado com sucesso!');
      await refreshData();
      return data;
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao cadastrar professor.');
    }
  };

  const updateProfessor = async (id: string, patch: Partial<Professor>) => {
    try {
      const body: Record<string, any> = { id };
      if (patch.nome !== undefined) body.nome = patch.nome;
      if (patch.cpf !== undefined) body.cpf = patch.cpf;
      if (patch.dataAdmissao !== undefined) body.dataAdmissao = patch.dataAdmissao;
      if (patch.ativo !== undefined) body.ativo = patch.ativo;
      if (patch.cargo !== undefined) body.cargo = patch.cargo;
      if (patch.salarioFixo !== undefined) body.salarioFixo = patch.salarioFixo;
      if (patch.segmentoIds && patch.segmentoHoras) {
        body.segmentos = patch.segmentoIds.map(sid => ({
          segmentoId: sid,
          horasSemanais: patch.segmentoHoras?.[sid] || 0,
        })).filter(s => s.segmentoId);
      }

      await api.updateFolhaProfessor(body);
      toast.success('Professor atualizado com sucesso!');
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao atualizar professor.');
    }
  };

  const deleteProfessor = async (id: string) => {
    try {
      await api.deleteFolhaProfessor(id);
      toast.success('Professor excluído com sucesso!');
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao excluir professor.');
    }
  };

  const addFechamento = async (
    f: Omit<Fechamento, 'id'>, 
    lancs: Omit<Lancamento, 'id'>[],
    lancsFin: { nome: string; totalPagar: number }[]
  ) => {
    try {
      const body = {
        competencia: f.competencia,
        observacao: f.observacao,
        totalGeral: f.totalGeral,
        lancamentos: lancs.map(l => ({
          professorId: l.professorId,
          segmentoId: l.segmentoId,
          horasMensais: l.horasMensais,
          repouso: l.repouso,
          horasAtividade: l.horasAtividade,
          totalHoras: l.totalHoras,
          ajudaCusto: l.ajudaCusto,
          totalPagar: l.totalPagar
        })),
        lancamentosFinanceiros: lancsFin
      };

      await api.createFolhaFechamento(body);
      toast.success('Folha fechada e despesas integradas com sucesso!');
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao fechar folha.');
    }
  };

  const updateSegmento = async (seg: Segmento) => {
    try {
      // Converte horasAtividade de volta para ha_percent
      const mensais = seg.horasSemanais * 4.5;
      const haPercent = mensais > 0 ? (seg.horasAtividade / mensais) : 0;

      const body = {
        id: seg.id,
        nome: seg.nome,
        horas_semanais: seg.horasSemanais,
        perc_repouso: seg.percRepouso,
        ha_percent: haPercent,
        valor_hora: seg.valorHora,
        ajuda_custo: seg.ajudaCusto,
      };

      await api.updateFolhaSegmento(body);
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao salvar parâmetros da turma ${seg.nome}`);
    }
  };

  const createSegmento = async (seg: Omit<Segmento, 'id'>) => {
    try {
      const mensais = seg.horasSemanais * 4.5;
      const haPercent = mensais > 0 ? (seg.horasAtividade / mensais) : 0;

      const body = {
        nome: seg.nome,
        horas_semanais: seg.horasSemanais,
        perc_repouso: seg.percRepouso,
        ha_percent: haPercent,
        valor_hora: seg.valorHora,
        ajuda_custo: seg.ajudaCusto,
      };

      const res = await api.createFolhaSegmento(body);
      toast.success(`Turma ${res.nome} criada com sucesso!`);
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao criar turma.');
    }
  };

  const createCargo = async (nome: string) => {
    try {
      await api.createFolhaCargo(nome);
      toast.success('Cargo criado com sucesso!');
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao criar cargo.');
    }
  };

  const deleteCargo = async (id: string) => {
    try {
      await api.deleteFolhaCargo(id);
      toast.success('Cargo excluído!');
      await refreshData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao excluir cargo.');
    }
  };

  return (
    <FolhaContext.Provider
      value={{
        segmentos,
        professores,
        fechamentos,
        cargos,
        loading,
        refreshData,
        addProfessor,
        updateProfessor,
        deleteProfessor,
        addFechamento,
        updateSegmento,
        createSegmento,
        createCargo,
        deleteCargo,
      }}
    >
      {children}
    </FolhaContext.Provider>
  );
};
