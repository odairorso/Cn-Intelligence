import React, { useState, useEffect } from 'react';
import { Professor } from '../../lib/folhaTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { useFolha } from '../../contexts/FolhaContext';
import { api } from '../../api';

interface FichaCadastroModalProps {
  professor: Professor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FichaCadastroModal({ professor, open, onOpenChange }: FichaCadastroModalProps) {
  const { refreshData } = useFolha();
  const [activeTab, setActiveTab] = useState('pessoais');
  const [saving, setSaving] = useState(false);

  // --- Estados do Formulário ---
  // Empresa e Cabeçalho
  const [empresa, setEmpresa] = useState('COLEGIO NAVIRAI');
  const [cnpj, setCnpj] = useState('24.227.497/0001-43');
  const [encarregado, setEncarregado] = useState('ODAIR ROBERTO DOS SANTOS DE OLIVEIRA');
  const [foneRamal, setFoneRamal] = useState('67999748109');

  // 1. Dados Pessoais
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [municipioNascimento, setMunicipioNascimento] = useState('');
  const [nomePai, setNomePai] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('Solteiro');
  const [raca, setRaca] = useState('Branca');
  const [cpf, setCpf] = useState('');
  const [pisPasep, setPisPasep] = useState('');
  const [rg, setRg] = useState('');
  const [estadoEmissor, setEstadoEmissor] = useState('');
  const [dataEmissaoRg, setDataEmissaoRg] = useState('');
  const [ctpsDigital, setCtpsDigital] = useState('Sim');
  const [ctps, setCtps] = useState('');
  const [serieCtps, setSerieCtps] = useState('');
  const [dataEmissaoCtps, setDataEmissaoCtps] = useState('');
  const [cnh, setCnh] = useState('');
  const [categoriaCnh, setCategoriaCnh] = useState('');
  const [validadeCnh, setValidadeCnh] = useState('');
  const [dataEmissaoCnh, setDataEmissaoCnh] = useState('');
  const [dataPrimeiraHabilitacao, setDataPrimeiraHabilitacao] = useState('');
  const [tituloEleitor, setTituloEleitor] = useState('');
  const [zona, setZona] = useState('');
  const [secao, setSecao] = useState('');
  const [reservista, setReservista] = useState('');
  const [categoriaReservista, setCategoriaReservista] = useState('');
  const [dataEmissaoReservista, setDataEmissaoReservista] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // 2. Dados Complementares (Endereço & Contato)
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [municipio, setMunicipio] = useState('NAVIRAI');
  const [estado, setEstado] = useState('MS');
  const [cep, setCep] = useState('');
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [telefoneCelular, setTelefoneCelular] = useState('');
  const [email, setEmail] = useState('');

  // 3. Escolaridade
  const [escolaridade, setEscolaridade] = useState('Educação Superior completa');

  // 4. Informações Bancárias
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [numeroConta, setNumeroConta] = useState('');
  const [tipoConta, setTipoConta] = useState('Conta Corrente');
  const [obsBancarias, setObsBancarias] = useState('');

  // 5. Dependentes
  const [dep1Nome, setDep1Nome] = useState('');
  const [dep1Cpf, setDep1Cpf] = useState('');
  const [dep1Nascimento, setDep1Nascimento] = useState('');
  const [dep1SalFamilia, setDep1SalFamilia] = useState('Não');
  const [dep1IR, setDep1IR] = useState('Não');

  const [dep2Nome, setDep2Nome] = useState('');
  const [dep2Cpf, setDep2Cpf] = useState('');
  const [dep2Nascimento, setDep2Nascimento] = useState('');
  const [dep2SalFamilia, setDep2SalFamilia] = useState('Não');
  const [dep2IR, setDep2IR] = useState('Não');

  const [dep3Nome, setDep3Nome] = useState('');
  const [dep3Cpf, setDep3Cpf] = useState('');
  const [dep3Nascimento, setDep3Nascimento] = useState('');
  const [dep3SalFamilia, setDep3SalFamilia] = useState('Não');
  const [dep3IR, setDep3IR] = useState('Não');

  const [dep4Nome, setDep4Nome] = useState('');
  const [dep4Cpf, setDep4Cpf] = useState('');
  const [dep4Nascimento, setDep4Nascimento] = useState('');
  const [dep4SalFamilia, setDep4SalFamilia] = useState('Não');
  const [dep4IR, setDep4IR] = useState('Não');

  const [nomeConjuge, setNomeConjuge] = useState('');
  const [cpfConjuge, setCpfConjuge] = useState('');
  const [nascimentoConjuge, setNascimentoConjuge] = useState('');

  // 6. Vínculo Emprego
  const [primeiroEmprego, setPrimeiroEmprego] = useState('Não');
  const [multiplosVinculos, setMultiplosVinculos] = useState('Não');
  const [empresaOutroVinculo, setEmpresaOutroVinculo] = useState('');
  const [cnpjOutroVinculo, setCnpjOutroVinculo] = useState('');

  // 7. Dados do Contrato
  const [cargoFuncao, setCargoFuncao] = useState('');
  const [horarioTrabalho, setHorarioTrabalho] = useState('');
  const [servicoObra, setServicoObra] = useState('');
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [dataAdmissaoFutura, setDataAdmissaoFutura] = useState('');
  const [salario, setSalario] = useState('');
  const [salarioTipo, setSalarioTipo] = useState('mês');
  const [valeTransporte, setValeTransporte] = useState('Não');
  const [periculidade, setPericulidade] = useState('Não');
  const [insalubridade, setInsalubridade] = useState('Não');
  const [experiencia, setExperiencia] = useState('30 + 60');
  const [exEmpregado, setExEmpregado] = useState('Não');

  // LGPD Concordância
  const [lgpdConcorda, setLgpdConcorda] = useState(true);

  // Inicializa com dados do professor
  useEffect(() => {
    if (professor) {
      setNome(professor.nome || '');
      setCpf(professor.cpf || '');
      setDataAdmissaoFutura(professor.dataAdmissao || '');

      const f = professor.fichaCadastro || {};
      setEmpresa(f.empresa || 'COLEGIO NAVIRAI');
      setCnpj(f.cnpj || '24.227.497/0001-43');
      setEncarregado(f.encarregado || 'ODAIR ROBERTO DOS SANTOS DE OLIVEIRA');
      setFoneRamal(f.foneRamal || '67999748109');

      setDataNascimento(f.dataNascimento || '');
      setMunicipioNascimento(f.municipioNascimento || '');
      setNomePai(f.nomePai || '');
      setNomeMae(f.nomeMae || '');
      setEstadoCivil(f.estadoCivil || 'Solteiro');
      setRaca(f.raca || 'Branca');
      setPisPasep(f.pisPasep || '');
      setRg(f.rg || '');
      setEstadoEmissor(f.estadoEmissor || '');
      setDataEmissaoRg(f.dataEmissaoRg || '');
      setCtpsDigital(f.ctpsDigital || 'Sim');
      setCtps(f.ctps || '');
      setSerieCtps(f.serieCtps || '');
      setDataEmissaoCtps(f.dataEmissaoCtps || '');
      setCnh(f.cnh || '');
      setCategoriaCnh(f.categoriaCnh || '');
      setValidadeCnh(f.validadeCnh || '');
      setDataEmissaoCnh(f.dataEmissaoCnh || '');
      setDataPrimeiraHabilitacao(f.dataPrimeiraHabilitacao || '');
      setTituloEleitor(f.tituloEleitor || '');
      setZona(f.zona || '');
      setSecao(f.secao || '');
      setReservista(f.reservista || '');
      setCategoriaReservista(f.categoriaReservista || '');
      setDataEmissaoReservista(f.dataEmissaoReservista || '');
      setObservacoes(f.observacoes || '');

      setEndereco(f.endereco || '');
      setNumero(f.numero || '');
      setComplemento(f.complemento || '');
      setBairro(f.bairro || '');
      setMunicipio(f.municipio || 'NAVIRAI');
      setEstado(f.estado || 'MS');
      setCep(f.cep || '');
      setTelefoneFixo(f.telefoneFixo || '');
      setTelefoneCelular(f.telefoneCelular || '');
      setEmail(f.email || '');

      setEscolaridade(f.escolaridade || 'Educação Superior completa');

      setBanco(f.banco || '');
      setAgencia(f.agencia || '');
      setNumeroConta(f.numeroConta || '');
      setTipoConta(f.tipoConta || 'Conta Corrente');
      setObsBancarias(f.obsBancarias || '');

      setDep1Nome(f.dep1Nome || '');
      setDep1Cpf(f.dep1Cpf || '');
      setDep1Nascimento(f.dep1Nascimento || '');
      setDep1SalFamilia(f.dep1SalFamilia || 'Não');
      setDep1IR(f.dep1IR || 'Não');

      setDep2Nome(f.dep2Nome || '');
      setDep2Cpf(f.dep2Cpf || '');
      setDep2Nascimento(f.dep2Nascimento || '');
      setDep2SalFamilia(f.dep2SalFamilia || 'Não');
      setDep2IR(f.dep2IR || 'Não');

      setDep3Nome(f.dep3Nome || '');
      setDep3Cpf(f.dep3Cpf || '');
      setDep3Nascimento(f.dep3Nascimento || '');
      setDep3SalFamilia(f.dep3SalFamilia || 'Não');
      setDep3IR(f.dep3IR || 'Não');

      setDep4Nome(f.dep4Nome || '');
      setDep4Cpf(f.dep4Cpf || '');
      setDep4Nascimento(f.dep4Nascimento || '');
      setDep4SalFamilia(f.dep4SalFamilia || 'Não');
      setDep4IR(f.dep4IR || 'Não');

      setNomeConjuge(f.nomeConjuge || '');
      setCpfConjuge(f.cpfConjuge || '');
      setNascimentoConjuge(f.nascimentoConjuge || '');

      setPrimeiroEmprego(f.primeiroEmprego || 'Não');
      setMultiplosVinculos(f.multiplosVinculos || 'Não');
      setEmpresaOutroVinculo(f.empresaOutroVinculo || '');
      setCnpjOutroVinculo(f.cnpjOutroVinculo || '');

      setCargoFuncao(f.cargoFuncao || '');
      setHorarioTrabalho(f.horarioTrabalho || '');
      setServicoObra(f.servicoObra || '');
      setDiasSemana(f.diasSemana || []);
      setSalario(f.salario || '');
      setSalarioTipo(f.salarioTipo || 'mês');
      setValeTransporte(f.valeTransporte || 'Não');
      setPericulidade(f.periculidade || 'Não');
      setInsalubridade(f.insalubridade || 'Não');
      setExperiencia(f.experiencia || '30 + 60');
      setExEmpregado(f.exEmpregado || 'Não');

      setLgpdConcorda(f.lgpdConcorda !== false);
    }
  }, [professor]);

  // Coleta dados inseridos
  const getFichaPayload = () => {
    return {
      empresa, cnpj, encarregado, foneRamal,
      dataNascimento, municipioNascimento, nomePai, nomeMae, estadoCivil, raca,
      pisPasep, rg, estadoEmissor, dataEmissaoRg, ctpsDigital, ctps, serieCtps, dataEmissaoCtps,
      cnh, categoriaCnh, validadeCnh, dataEmissaoCnh, dataPrimeiraHabilitacao,
      tituloEleitor, zona, secao, reservista, categoriaReservista, dataEmissaoReservista, observacoes,
      endereco, numero, complemento, bairro, municipio, estado, cep, telefoneFixo, telefoneCelular, email,
      escolaridade,
      banco, agencia, numeroConta, tipoConta, obsBancarias,
      dep1Nome, dep1Cpf, dep1Nascimento, dep1SalFamilia, dep1IR,
      dep2Nome, dep2Cpf, dep2Nascimento, dep2SalFamilia, dep2IR,
      dep3Nome, dep3Cpf, dep3Nascimento, dep3SalFamilia, dep3IR,
      dep4Nome, dep4Cpf, dep4Nascimento, dep4SalFamilia, dep4IR,
      nomeConjuge, cpfConjuge, nascimentoConjuge,
      primeiroEmprego, multiplosVinculos, empresaOutroVinculo, cnpjOutroVinculo,
      cargoFuncao, horarioTrabalho, servicoObra, diasSemana, salario, salarioTipo,
      valeTransporte, periculidade, insalubridade, experiencia, exEmpregado,
      lgpdConcorda
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        id: professor.id,
        nome,
        cpf,
        dataAdmissao: dataAdmissaoFutura,
        ativo: professor.ativo,
        fichaCadastro: getFichaPayload()
      };

      await api.patch('/api?route=folha-professores', payload);
      toast.success('Ficha cadastral salva com sucesso!');
      await refreshData();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar ficha: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const data = getFichaPayload();
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Por favor, permita popups para imprimir.');
      return;
    }

    const checkbox = (val: boolean) => val ? '☒' : '☐';
    const checked = (val1: string, val2: string) => val1 === val2 ? '☒' : '☐';

    const formatBRDate = (d: string) => {
      if (!d) return '';
      const p = d.split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
      return d;
    };

    const docHTML = `
      <html>
      <head>
        <title>Ficha de Admissão - ${nome}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
          body {
            font-family: 'Roboto', 'Arial', sans-serif;
            font-size: 11px;
            color: #111;
            margin: 0;
            padding: 20px;
            background: #fff;
          }
          .page {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            page-break-after: always;
            position: relative;
            box-sizing: border-box;
          }
          .page:last-child {
            page-break-after: avoid;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .header-table td {
            border: 1px solid #999;
            padding: 8px;
            vertical-align: middle;
          }
          .title-container {
            text-align: center;
          }
          .title-container h1 {
            font-size: 15px;
            margin: 0 0 5px 0;
            font-weight: 700;
          }
          .title-container h2 {
            font-size: 13px;
            margin: 0;
            color: #333;
            font-weight: 700;
          }
          .section-title {
            background-color: #f0f0f0;
            font-weight: 700;
            padding: 4px 6px;
            margin-top: 10px;
            margin-bottom: 5px;
            border-left: 4px solid #101f42;
            font-size: 11px;
          }
          .form-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .form-table td {
            border: 1px solid #ccc;
            padding: 4px 6px;
            vertical-align: top;
          }
          .field-label {
            font-size: 9px;
            color: #555;
            display: block;
            margin-bottom: 2px;
            font-weight: 500;
          }
          .field-value {
            font-size: 11px;
            font-weight: 700;
            color: #000;
          }
          .checkbox-label {
            display: inline-flex;
            align-items: center;
            margin-right: 15px;
            font-size: 10px;
            line-height: 1;
          }
          .checkbox-box {
            font-size: 13px;
            margin-right: 4px;
            font-family: monospace;
          }
          .footer-note {
            margin-top: 20px;
            font-size: 10px;
            text-align: center;
            border-top: 1px solid #ccc;
            padding-top: 8px;
            color: #666;
          }
          .signature-row {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px solid #444;
            padding-top: 5px;
            font-size: 11px;
            font-weight: 700;
          }
          .page-num {
            position: absolute;
            bottom: 0;
            right: 0;
            font-size: 10px;
            color: #888;
          }
          .lgpd-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            font-weight: 700;
          }
          .bullet-list {
            margin: 5px 0;
            padding-left: 20px;
          }
          .bullet-list li {
            margin-bottom: 3px;
          }
          @media print {
            body {
              padding: 0;
            }
            .page {
              padding: 0;
              margin: 0;
              min-height: 98vh;
            }
          }
        </style>
      </head>
      <body>

        <!-- PÁGINA 1 -->
        <div class="page">
          <table class="header-table">
            <tr>
              <td style="width: 20%; text-align: center;">
                <img src="/logo-colegio.jpg" style="max-height: 50px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'" />
                <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">COLÉGIO NAVIRAÍ</div>
              </td>
              <td style="width: 60%;" class="title-container">
                <h1>FICHA DE ADMISSÃO</h1>
                <h2>DADOS PESSOAIS - LGPD</h2>
              </td>
              <td style="width: 20%; text-align: center;">
                <div class="lgpd-badge">
                  <div style="text-align: right; line-height: 1.1;">
                    <span style="color:#0f2c59; font-size:12px; font-weight:bold;">LGPD</span><br/>
                    <span style="font-size:7px; color:#555;">Lei Geral de Proteção<br/>de Dados Pessoais</span>
                  </div>
                  <span style="font-size:20px; color:#0f2c59;">🔒</span>
                </div>
              </td>
            </tr>
          </table>

          <table class="form-table">
            <tr>
              <td colspan="2" style="width: 50%;">
                <span class="field-label">Empresa:</span>
                <span class="field-value">${empresa}</span>
              </td>
              <td colspan="2" style="width: 50%;">
                <span class="field-label">CNPJ:</span>
                <span class="field-value">${cnpj}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2">
                <span class="field-label">Encarregado:</span>
                <span class="field-value">${encarregado}</span>
              </td>
              <td colspan="2">
                <span class="field-label">Fone-Ramal:</span>
                <span class="field-value">${foneRamal}</span>
              </td>
            </tr>
          </table>

          <div style="font-size: 9px; color: #444; border: 1px solid #bbb; padding: 6px; background-color: #fcfcfc; margin-bottom: 10px;">
            <strong>OBS:</strong> Cada dado solicitado na admissão tem uma finalidade conforme a LGPD (Lei Geral de Proteção de Dados).
            As finalidades estão presentes ao lado de cada campo, numeradas, seguindo a tabela ao final da ficha.
          </div>

          <div class="section-title">1 - Dados Pessoais: (Obrigatório)</div>
          <table class="form-table">
            <tr>
              <td colspan="3">
                <span class="field-label">Nome Completo: <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 2, 3, 4, 5 e 6</span></span>
                <span class="field-value">${nome}</span>
              </td>
            </tr>
            <tr>
              <td style="width: 35%;">
                <span class="field-label">Data Nascimento: <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 2, 3, 4, 5 e 6</span></span>
                <span class="field-value">${formatBRDate(dataNascimento)}</span>
              </td>
              <td colspan="2" style="width: 65%;">
                <span class="field-label">Município Nascimento: <span style="float:right; font-size:8px; color:#888;">LGPD: 3</span></span>
                <span class="field-value">${municipioNascimento}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Nome do Pai: <span style="float:right; font-size:8px; color:#888;">LGPD: 5 e 6</span></span>
                <span class="field-value">${nomePai}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Nome da Mãe: <span style="float:right; font-size:8px; color:#888;">LGPD: 6</span></span>
                <span class="field-value">${nomeMae}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Estado Civil:</span>
                <div style="margin-top: 4px;">
                  <span class="checkbox-label"><span class="checkbox-box">${checked(estadoCivil, 'Solteiro')}</span> Solteiro</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(estadoCivil, 'Casado')}</span> Casado</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(estadoCivil, 'Divorciado')}</span> Divorciado</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(estadoCivil, 'União Estável')}</span> União Estável</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(estadoCivil, 'Viúvo')}</span> Viúvo</span>
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Raça: (Obrigatório) <span style="float:right; font-size:8px; color:#888;">LGPD: 1 e 3</span></span>
                <div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 8px;">
                  <span class="checkbox-label"><span class="checkbox-box">${checked(raca, 'Branca')}</span> Branca</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(raca, 'Preta')}</span> Preta</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(raca, 'Parda')}</span> Parda</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(raca, 'Amarela')}</span> Amarela</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(raca, 'Indígena')}</span> Indígena</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="width: 35%;">
                <span class="field-label">CPF: <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 2, 3, 4, 5 e 6</span></span>
                <span class="field-value">${cpf}</span>
              </td>
              <td colspan="2" style="width: 65%;">
                <span class="field-label">PIS/PASEP: <span style="float:right; font-size:8px; color:#888;">LGPD: 2 e 5</span></span>
                <span class="field-value">${pisPasep}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">RG - Carteira Identidade:</span>
                <span class="field-value">${rg}</span>
              </td>
              <td>
                <span class="field-label">Estado Emissor:</span>
                <span class="field-value">${estadoEmissor}</span>
              </td>
              <td>
                <span class="field-label">Data de Emissão:</span>
                <span class="field-value">${formatBRDate(dataEmissaoRg)}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Carteira de Trabalho Digital: <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 2, 3, 5 e 6</span></span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(ctpsDigital, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(ctpsDigital, 'Não')}</span> Não</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">CTPS - Carteira de Trabalho:</span>
                <span class="field-value">${ctps}</span>
              </td>
              <td>
                <span class="field-label">Série:</span>
                <span class="field-value">${serieCtps}</span>
              </td>
              <td>
                <span class="field-label">Data de Emissão:</span>
                <span class="field-value">${formatBRDate(dataEmissaoCtps)}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">CNH - Carteira Motorista:</span>
                <span class="field-value">${cnh}</span>
              </td>
              <td>
                <span class="field-label">Categoria / Validade:</span>
                <span class="field-value">${categoriaCnh ? categoriaCnh + ' / ' + formatBRDate(validadeCnh) : ''}</span>
              </td>
              <td>
                <span class="field-label">Emissão / 1ª Habilitação:</span>
                <span class="field-value">${dataEmissaoCnh ? formatBRDate(dataEmissaoCnh) + ' / ' + formatBRDate(dataPrimeiraHabilitacao) : ''}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">Título de Eleitor:</span>
                <span class="field-value">${tituloEleitor}</span>
              </td>
              <td>
                <span class="field-label">Zona:</span>
                <span class="field-value">${zona}</span>
              </td>
              <td>
                <span class="field-label">Seção:</span>
                <span class="field-value">${secao}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">Carteira Reservista:</span>
                <span class="field-value">${reservista}</span>
              </td>
              <td>
                <span class="field-label">Categoria:</span>
                <span class="field-value">${categoriaReservista}</span>
              </td>
              <td>
                <span class="field-label">Data de Emissão:</span>
                <span class="field-value">${formatBRDate(dataEmissaoReservista)}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Observações:</span>
                <span class="field-value">${observacoes}</span>
              </td>
            </tr>
          </table>

          <div class="section-title">2 - Dados Complementares: (Obrigatório)</div>
          <table class="form-table">
            <tr>
              <td colspan="2" style="width: 80%;">
                <span class="field-label">Endereço: <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 2 e 5</span></span>
                <span class="field-value">${endereco}</span>
              </td>
              <td style="width: 20%;">
                <span class="field-label">Número:</span>
                <span class="field-value">${numero}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">Complemento:</span>
                <span class="field-value">${complemento}</span>
              </td>
              <td colspan="2">
                <span class="field-label">Bairro:</span>
                <span class="field-value">${bairro}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">Município:</span>
                <span class="field-value">${municipio}</span>
              </td>
              <td>
                <span class="field-label">Estado:</span>
                <span class="field-value">${estado}</span>
              </td>
              <td>
                <span class="field-label">CEP:</span>
                <span class="field-value">${cep}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="field-label">Telefone fixo: <span style="float:right; font-size:8px; color:#888;">LGPD: 2 e 8</span></span>
                <span class="field-value">${telefoneFixo}</span>
              </td>
              <td colspan="2">
                <span class="field-label">Telefone celular: <span style="float:right; font-size:8px; color:#888;">LGPD: 2 e 8</span></span>
                <span class="field-value">${telefoneCelular}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Endereço de E-mail:</span>
                <span class="field-value">${email}</span>
              </td>
            </tr>
          </table>

          <div class="section-title">3 - Escolaridade: (Obrigatório) <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 3 e 6</span></div>
          <div style="border: 1px solid #ccc; padding: 6px; border-radius: 4px; display: flex; flex-direction: column; gap: 4px;">
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Analfabeto')}</span> Analfabeto</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Até o 5º ano incompleto')}</span> Até o 5º ano incompleto do Ensino Fundamental</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, '5º ano completo')}</span> 5º ano completo do Ensino Fundamental</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Do 6º ao 9º ano incompleto')}</span> Do 6º ao 9º ano do Ensino Fundamental incompleto</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Ensino Fundamental completo')}</span> Ensino Fundamental completo</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Ensino Médio incompleto')}</span> Ensino Médio incompleto</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Ensino Médio completo')}</span> Ensino Médio completo</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Educação Superior incompleta')}</span> Educação Superior incompleta</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Educação Superior completa')}</span> Educação Superior completa</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Pós Graduação')}</span> Pós Graduação</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Mestrado')}</span> Mestrado</span>
            <span class="checkbox-label"><span class="checkbox-box">${checked(escolaridade, 'Doutorado')}</span> Doutorado</span>
          </div>

          <div class="page-num">página 1/3</div>
        </div>

        <!-- PÁGINA 2 -->
        <div class="page">
          <div class="section-title">4 - Informações Bancárias (caso a empresa pague por remessa bancária) <span style="float:right; font-size:8px; color:#888;">LGPD: 9</span></div>
          <table class="form-table">
            <tr>
              <td style="width: 35%;">
                <span class="field-label">Banco:</span>
                <span class="field-value">${banco}</span>
              </td>
              <td style="width: 30%;">
                <span class="field-label">Agência:</span>
                <span class="field-value">${agencia}</span>
              </td>
              <td style="width: 35%;">
                <span class="field-label">Número da Conta:</span>
                <span class="field-value">${numeroConta}</span>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Tipo de Conta:</span>
                <div style="margin-top: 4px;">
                  <span class="checkbox-label"><span class="checkbox-box">${checked(tipoConta, 'Conta Corrente')}</span> Conta Corrente</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(tipoConta, 'Conta Poupança')}</span> Conta Poupança</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checked(tipoConta, 'Outra')}</span> Outra</span>
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="field-label">Observações:</span>
                <span class="field-value">${obsBancarias}</span>
              </td>
            </tr>
          </table>

          <div class="section-title">5 - Dependentes <span style="float:right; font-size:8px; color:#888;">LGPD: 1 e 4</span></div>
          
          <table class="form-table" style="margin-bottom: 5px;">
            <tr>
              <td colspan="3"><strong>Dependente 1</strong></td>
            </tr>
            <tr>
              <td style="width: 40%;"><span class="field-label">Nome:</span><span class="field-value">${dep1Nome}</span></td>
              <td style="width: 30%;"><span class="field-label">CPF:</span><span class="field-value">${dep1Cpf}</span></td>
              <td style="width: 30%;"><span class="field-label">Data de Nascimento:</span><span class="field-value">${formatBRDate(dep1Nascimento)}</span></td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="checkbox-label">Salário-Família: <span class="checkbox-box">${checked(dep1SalFamilia, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep1SalFamilia, 'Não')}</span> Não</span>
                <span class="checkbox-label">Imposto de Renda: <span class="checkbox-box">${checked(dep1IR, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep1IR, 'Não')}</span> Não</span>
              </td>
            </tr>
          </table>

          <table class="form-table" style="margin-bottom: 5px;">
            <tr>
              <td colspan="3"><strong>Dependente 2</strong></td>
            </tr>
            <tr>
              <td style="width: 40%;"><span class="field-label">Nome:</span><span class="field-value">${dep2Nome}</span></td>
              <td style="width: 30%;"><span class="field-label">CPF:</span><span class="field-value">${dep2Cpf}</span></td>
              <td style="width: 30%;"><span class="field-label">Data de Nascimento:</span><span class="field-value">${formatBRDate(dep2Nascimento)}</span></td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="checkbox-label">Salário-Família: <span class="checkbox-box">${checked(dep2SalFamilia, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep2SalFamilia, 'Não')}</span> Não</span>
                <span class="checkbox-label">Imposto de Renda: <span class="checkbox-box">${checked(dep2IR, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep2IR, 'Não')}</span> Não</span>
              </td>
            </tr>
          </table>

          <table class="form-table" style="margin-bottom: 5px;">
            <tr>
              <td colspan="3"><strong>Dependente 3</strong></td>
            </tr>
            <tr>
              <td style="width: 40%;"><span class="field-label">Nome:</span><span class="field-value">${dep3Nome}</span></td>
              <td style="width: 30%;"><span class="field-label">CPF:</span><span class="field-value">${dep3Cpf}</span></td>
              <td style="width: 30%;"><span class="field-label">Data de Nascimento:</span><span class="field-value">${formatBRDate(dep3Nascimento)}</span></td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="checkbox-label">Salário-Família: <span class="checkbox-box">${checked(dep3SalFamilia, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep3SalFamilia, 'Não')}</span> Não</span>
                <span class="checkbox-label">Imposto de Renda: <span class="checkbox-box">${checked(dep3IR, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep3IR, 'Não')}</span> Não</span>
              </td>
            </tr>
          </table>

          <table class="form-table" style="margin-bottom: 5px;">
            <tr>
              <td colspan="3"><strong>Dependente 4</strong></td>
            </tr>
            <tr>
              <td style="width: 40%;"><span class="field-label">Nome:</span><span class="field-value">${dep4Nome}</span></td>
              <td style="width: 30%;"><span class="field-label">CPF:</span><span class="field-value">${dep4Cpf}</span></td>
              <td style="width: 30%;"><span class="field-label">Data de Nascimento:</span><span class="field-value">${formatBRDate(dep4Nascimento)}</span></td>
            </tr>
            <tr>
              <td colspan="3">
                <span class="checkbox-label">Salário-Família: <span class="checkbox-box">${checked(dep4SalFamilia, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep4SalFamilia, 'Não')}</span> Não</span>
                <span class="checkbox-label">Imposto de Renda: <span class="checkbox-box">${checked(dep4IR, 'Sim')}</span> Sim <span class="checkbox-box">${checked(dep4IR, 'Não')}</span> Não</span>
              </td>
            </tr>
          </table>

          <table class="form-table" style="margin-bottom: 10px;">
            <tr>
              <td colspan="3"><strong>CASO O CÔNJUGE SEJA DEPENDENTE EM PLANO DE SAÚDE, PREENCHER:</strong> <span style="float:right; font-size:8px; color:#888;">LGPD: 1 e 4</span></td>
            </tr>
            <tr>
              <td style="width: 40%;"><span class="field-label">Nome Cônjuge:</span><span class="field-value">${nomeConjuge}</span></td>
              <td style="width: 30%;"><span class="field-label">CPF Cônjuge:</span><span class="field-value">${cpfConjuge}</span></td>
              <td style="width: 30%;"><span class="field-label">Data de Nascimento:</span><span class="field-value">${formatBRDate(nascimentoConjuge)}</span></td>
            </tr>
          </table>

          <div class="section-title">6 - Informações do vínculo de emprego <span style="float:right; font-size:8px; color:#888;">LGPD: 1 e 3</span></div>
          <table class="form-table">
            <tr>
              <td style="width: 50%;">
                <span class="field-label">Primeiro Emprego?</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(primeiroEmprego, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(primeiroEmprego, 'Não')}</span> Não</span>
              </td>
              <td style="width: 50%;">
                <span class="field-label">Múltiplos vínculos trabalhistas?</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(multiplosVinculos, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(multiplosVinculos, 'Não')}</span> Não</span>
              </td>
            </tr>
            ${multiplosVinculos === 'Sim' ? `
            <tr>
              <td><span class="field-label">Empresa outro vínculo:</span><span class="field-value">${empresaOutroVinculo}</span></td>
              <td><span class="field-label">CNPJ outro vínculo:</span><span class="field-value">${cnpjOutroVinculo}</span></td>
            </tr>
            ` : ''}
          </table>

          <div class="section-title">7 - Dados do Contrato (Obrigatório) <span style="float:right; font-size:8px; color:#888;">LGPD: 1, 2, 3, 4, 5 e 6</span></div>
          <table class="form-table">
            <tr>
              <td colspan="4">
                <span class="field-label">Cargo/Função:</span>
                <span class="field-value">${cargoFuncao}</span>
              </td>
            </tr>
            <tr>
              <td colspan="4">
                <span class="field-label">Horário de Trabalho:</span>
                <span class="field-value">${horarioTrabalho}</span>
              </td>
            </tr>
            <tr>
              <td colspan="4">
                <span class="field-label">Serviço/Obra Alocado:</span>
                <span class="field-value">${servicoObra}</span>
              </td>
            </tr>
            <tr>
              <td colspan="4">
                <span class="field-label">Dias da Semana que trabalha:</span>
                <div style="margin-top: 4px;">
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Segunda-feira'))}</span> Segunda-feira</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Terça-feira'))}</span> Terça-feira</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Quarta-feira'))}</span> Quarta-feira</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Quinta-feira'))}</span> Quinta-feira</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Sexta-feira'))}</span> Sexta-feira</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Sábado'))}</span> Sábado</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Domingo'))}</span> Domingo</span>
                  <span class="checkbox-label"><span class="checkbox-box">${checkbox(diasSemana.includes('Escala 12x36'))}</span> Escala 12x36</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="width: 30%;">
                <span class="field-label">Data de Admissão:</span>
                <span class="field-value">${formatBRDate(dataAdmissaoFutura)}</span>
              </td>
              <td style="width: 30%;">
                <span class="field-label">Salário:</span>
                <span class="field-value">${salario}</span>
              </td>
              <td style="width: 40%; vertical-align: middle;">
                <span class="checkbox-label"><span class="checkbox-box">${checked(salarioTipo, 'mês')}</span> mês</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(salarioTipo, 'hora')}</span> hora</span>
              </td>
            </tr>
            <tr>
              <td colspan="2">
                <span class="field-label">Vale Transporte:</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(valeTransporte, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(valeTransporte, 'Não')}</span> Não</span>
              </td>
              <td>
                <span class="field-label">Periculozidade?</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(periculidade, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(periculidade, 'Não')}</span> Não</span>
              </td>
              <td>
                <span class="field-label">Insalubridade?</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(insalubridade, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(insalubridade, 'Não')}</span> Não</span>
              </td>
            </tr>
            <tr>
              <td colspan="2">
                <span class="field-label">Período de Experiência:</span>
                <span class="field-value">${experiencia} dias</span>
              </td>
              <td colspan="2">
                <span class="field-label">Já foi ex-empregado da empresa?</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(exEmpregado, 'Sim')}</span> Sim</span>
                <span class="checkbox-label"><span class="checkbox-box">${checked(exEmpregado, 'Não')}</span> Não</span>
              </td>
            </tr>
          </table>

          <div class="signature-row" style="margin-top: 40px;">
            <div class="signature-box">CIENTE: Empregado</div>
            <div class="signature-box">COLÉGIO NAVIRAÍ</div>
          </div>

          <div class="page-num">página 2/3</div>
        </div>

        <!-- PÁGINA 3 -->
        <div class="page">
          <div class="section-title">8 - Docs para Admissão (ENTREGAR COM ANTECEDÊNCIA DE 3 DIAS ÚTEIS DA DATA DE ADMISSÃO)</div>
          <ul class="bullet-list" style="font-size: 11px; line-height: 1.5;">
            <li><strong>CÓPIA CPF;</strong></li>
            <li><strong>CÓPIA CARTEIRA DE HABILITAÇÃO (Somente para motoristas);</strong></li>
            <li><strong>CÓPIA CERTIDÃO DE NASCIMENTO E CPF DOS FILHOS MENORES DE 14 ANOS;</strong></li>
            <li><strong>ATESTADO MÉDICO ADMISSIONAL EFETUADO PELO MÉDICO DO TRABALHO (OBRIGATÓRIO).</strong></li>
          </ul>
          <p style="font-size: 10px; margin-top: 5px;">Endereço para qualificação cadastral: <strong>http://consultacadastral.inss.gov.br/Esocial/pages/index.xhtml</strong></p>

          <div class="section-title" style="margin-top: 20px;">LGPD (Lei Geral de Proteção de Dados)</div>
          <p style="font-size: 10px; text-align: justify; line-height: 1.4; margin: 5px 0;">
            1 - Comunicamos ao Titular e aos dependentes que estes dados serão utilizados para elaboração do Contrato de Trabalho e ainda para cumprimento de outras obrigações legais impostas pela Receita Federal, Previdência Social, Caixa Econômica Federal, Portal do eSocial, Empregador Web e Portal Gov.br.<br/>
            2 - Solicitamos consentimento ao titular para compartilhamento dos dados com prestadores de serviços contratados para cumprimento das obrigações legais impostas pelos órgãos citados acima.<br/>
            3 - Cumprindo as regras trazidas pela Lei 13.709 (Lei Geral de Proteção de Dados), no tratamento de dados adotaremos medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito. Respeitando os seguintes princípios: Finalidade, Adequação, Necessidade, Livre acesso, Qualidade dos dados, Transparência, Segurança, Prevenção, Não Discriminação, Responsabilização e prestação de contas.
          </p>

          <table class="form-table" style="margin-top: 15px;">
            <thead>
              <tr style="background-color: #f2f2f2; font-weight: bold;">
                <td style="width: 15%; text-align: center;">Item</td>
                <td>Finalidades LGPD - Ficha de Admissão</td>
              </tr>
            </thead>
            <tbody>
              <tr><td style="text-align: center;">1</td><td>eSocial</td></tr>
              <tr><td style="text-align: center;">2</td><td>Caixa Econômica - SEFIP e Conectividade</td></tr>
              <tr><td style="text-align: center;">3</td><td>RAIS</td></tr>
              <tr><td style="text-align: center;">4</td><td>DIRF - Receita Federal</td></tr>
              <tr><td style="text-align: center;">5</td><td>Empregador Web</td></tr>
              <tr><td style="text-align: center;">6</td><td>PIS (quando não cadastrado)</td></tr>
              <tr><td style="text-align: center;">7</td><td>Transportadoras atividade remunerada</td></tr>
              <tr><td style="text-align: center;">8</td><td>Contato Empresa</td></tr>
              <tr><td style="text-align: center;">9</td><td>Remessa Bancária</td></tr>
            </tbody>
          </table>

          <div class="section-title" style="margin-top: 25px; text-align: center;">Titular</div>
          <p style="text-align: justify; font-size: 10px; line-height: 1.4; margin: 10px 0;">
            Estou ciente que os dados relacionados acima foram colhidos para cumprimento de obrigação Legal (artigo 7º da Lei 13.709), bem como estou de acordo que os mesmos sejam compartilhados com terceiros para o devido cumprimento legal e serão arquivados a partir desta data e por até 2 anos após meu desligamento da empresa, data em que serão eliminados ou anonimizados.
          </p>

          <div style="display: flex; justify-content: center; gap: 40px; margin-top: 20px; margin-bottom: 30px;">
            <span class="checkbox-label" style="font-size: 12px; font-weight: bold;"><span class="checkbox-box" style="font-size: 16px;">${checkbox(lgpdConcorda)}</span> Concordo</span>
            <span class="checkbox-label" style="font-size: 12px; font-weight: bold;"><span class="checkbox-box" style="font-size: 16px;">${checkbox(!lgpdConcorda)}</span> Não Concordo</span>
          </div>

          <table class="form-table" style="margin-top: 30px; border: none;">
            <tr style="border: none;">
              <td style="border: none; width: 60%; vertical-align: bottom;">
                <div style="border-bottom: 1px solid #000; width: 90%; height: 25px;"></div>
                <div style="font-size: 8px; color: #555; margin-top: 3px;">Ciente</div>
              </td>
              <td style="border: none; width: 40%; vertical-align: bottom;">
                <div style="border-bottom: 1px solid #000; width: 100%; height: 25px; text-align: center; font-weight: bold; font-size: 11px;">
                  ___/___/______
                </div>
                <div style="font-size: 8px; color: #555; margin-top: 3px; text-align: center;">Data</div>
              </td>
            </tr>
          </table>

          <div class="page-num">página 3/3</div>
        </div>

      </body>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
      </html>
    `;

    win.document.open();
    win.document.write(docHTML);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border border-surface-variant text-on-surface max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-xl">
        <DialogHeader className="border-b border-surface-variant pb-3 mb-4">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">Ficha de Admissão (LGPD) - {professor?.nome}</DialogTitle>
            <Button onClick={handlePrint} variant="outline" className="border-primary text-primary hover:bg-primary/10 flex items-center gap-2 text-xs h-8">
              🖨️ Imprimir Ficha Oficial
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-background border border-surface-variant p-1 w-full justify-start overflow-x-auto flex-nowrap whitespace-nowrap">
            <TabsTrigger value="pessoais" className="text-xs py-1.5 px-3">1. Dados Pessoais</TabsTrigger>
            <TabsTrigger value="complementares" className="text-xs py-1.5 px-3">2. Endereço & Contatos</TabsTrigger>
            <TabsTrigger value="bancarios" className="text-xs py-1.5 px-3">3. Banco & Cônjuge</TabsTrigger>
            <TabsTrigger value="dependentes" className="text-xs py-1.5 px-3">4. Dependentes</TabsTrigger>
            <TabsTrigger value="contrato" className="text-xs py-1.5 px-3">5. Contrato e Vínculos</TabsTrigger>
          </TabsList>

          {/* TAB 1: DADOS PESSOAIS */}
          <TabsContent value="pessoais" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nomeCompleto">Nome Completo</Label>
                <Input id="nomeCompleto" value={nome} onChange={(e) => setNome(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                <Input id="dataNascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="municipioNascimento">Município de Nascimento</Label>
                <Input id="municipioNascimento" value={municipioNascimento} onChange={(e) => setMunicipioNascimento(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="estadoCivil">Estado Civil</Label>
                <select id="estadoCivil" value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Solteiro">Solteiro(a)</option>
                  <option value="Casado">Casado(a)</option>
                  <option value="Divorciado">Divorciado(a)</option>
                  <option value="União Estável">União Estável</option>
                  <option value="Viúvo">Viúvo(a)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nomePai">Nome do Pai</Label>
                <Input id="nomePai" value={nomePai} onChange={(e) => setNomePai(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="nomeMae">Nome da Mãe</Label>
                <Input id="nomeMae" value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="raca">Raça/Cor</Label>
                <select id="raca" value={raca} onChange={(e) => setRaca(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Branca">Branca</option>
                  <option value="Preta">Preta</option>
                  <option value="Parda">Parda</option>
                  <option value="Amarela">Amarela</option>
                  <option value="Indígena">Indígena</option>
                </select>
              </div>
              <div>
                <Label htmlFor="cpfFicha">CPF</Label>
                <Input id="cpfFicha" value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="pisPasep">PIS / PASEP</Label>
                <Input id="pisPasep" value={pisPasep} onChange={(e) => setPisPasep(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-surface-variant pt-4 mt-2">
              <div>
                <Label htmlFor="rg">RG (Identidade)</Label>
                <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="estadoEmissor">Estado Emissor</Label>
                <Input id="estadoEmissor" placeholder="EX: MS" value={estadoEmissor} onChange={(e) => setEstadoEmissor(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="dataEmissaoRg">Data de Emissão</Label>
                <Input id="dataEmissaoRg" type="date" value={dataEmissaoRg} onChange={(e) => setDataEmissaoRg(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-surface-variant pt-4">
              <div>
                <Label htmlFor="ctpsDigital">CTPS Digital?</Label>
                <select id="ctpsDigital" value={ctpsDigital} onChange={(e) => setCtpsDigital(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ctps">Nº CTPS</Label>
                <Input id="ctps" value={ctps} onChange={(e) => setCtps(e.target.value)} className="bg-background border-surface-variant text-on-surface" disabled={ctpsDigital === 'Sim'} />
              </div>
              <div>
                <Label htmlFor="serieCtps">Série</Label>
                <Input id="serieCtps" value={serieCtps} onChange={(e) => setSerieCtps(e.target.value)} className="bg-background border-surface-variant text-on-surface" disabled={ctpsDigital === 'Sim'} />
              </div>
              <div>
                <Label htmlFor="dataEmissaoCtps">Data Emissão CTPS</Label>
                <Input id="dataEmissaoCtps" type="date" value={dataEmissaoCtps} onChange={(e) => setDataEmissaoCtps(e.target.value)} className="bg-background border-surface-variant text-on-surface" disabled={ctpsDigital === 'Sim'} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-surface-variant pt-4">
              <div>
                <Label htmlFor="cnh">Nº CNH (Carteira de Motorista)</Label>
                <Input id="cnh" value={cnh} onChange={(e) => setCnh(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="categoriaCnh">Categoria CNH</Label>
                <Input id="categoriaCnh" placeholder="Ex: AB" value={categoriaCnh} onChange={(e) => setCategoriaCnh(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="validadeCnh">Validade CNH</Label>
                <Input id="validadeCnh" type="date" value={validadeCnh} onChange={(e) => setValidadeCnh(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="dataEmissaoCnh">Data Emissão CNH</Label>
                <Input id="dataEmissaoCnh" type="date" value={dataEmissaoCnh} onChange={(e) => setDataEmissaoCnh(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-surface-variant pt-4">
              <div className="md:col-span-2">
                <Label htmlFor="tituloEleitor">Título de Eleitor</Label>
                <Input id="tituloEleitor" value={tituloEleitor} onChange={(e) => setTituloEleitor(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="zona">Zona</Label>
                <Input id="zona" value={zona} onChange={(e) => setZona(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="secao">Seção</Label>
                <Input id="secao" value={secao} onChange={(e) => setSecao(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-surface-variant pt-4">
              <div>
                <Label htmlFor="reservista">Reservista (Militar)</Label>
                <Input id="reservista" value={reservista} onChange={(e) => setReservista(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="categoriaReservista">Categoria</Label>
                <Input id="categoriaReservista" value={categoriaReservista} onChange={(e) => setCategoriaReservista(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="dataEmissaoReservista">Data Emissão Reservista</Label>
                <Input id="dataEmissaoReservista" type="date" value={dataEmissaoReservista} onChange={(e) => setDataEmissaoReservista(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div>
              <Label htmlFor="escolaridadeSelect">Grau de Instrução (Escolaridade)</Label>
              <select id="escolaridadeSelect" value={escolaridade} onChange={(e) => setEscolaridade(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                <option value="Analfabeto">Analfabeto</option>
                <option value="Até o 5º ano incompleto">Até o 5º ano incompleto do Ensino Fundamental</option>
                <option value="5º ano completo">5º ano completo do Ensino Fundamental</option>
                <option value="Do 6º ao 9º ano incompleto">Do 6º ao 9º ano do Ensino Fundamental incompleto</option>
                <option value="Ensino Fundamental completo">Ensino Fundamental completo</option>
                <option value="Ensino Médio incompleto">Ensino Médio incompleto</option>
                <option value="Ensino Médio completo">Ensino Médio completo</option>
                <option value="Educação Superior incompleta">Educação Superior incompleta</option>
                <option value="Educação Superior completa">Educação Superior completa</option>
                <option value="Pós Graduação">Pós Graduação</option>
                <option value="Mestrado">Mestrado</option>
                <option value="Doutorado">Doutorado</option>
              </select>
            </div>
          </TabsContent>

          {/* TAB 2: ENDEREÇO & CONTATOS */}
          <TabsContent value="complementares" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <Label htmlFor="endereco">Endereço (Alameda/Rua/Av)</Label>
                <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="municipio">Município</Label>
                <Input id="municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-surface-variant pt-4">
              <div>
                <Label htmlFor="telefoneFixo">Telefone Fixo</Label>
                <Input id="telefoneFixo" value={telefoneFixo} onChange={(e) => setTelefoneFixo(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="telefoneCelular">Telefone Celular</Label>
                <Input id="telefoneCelular" value={telefoneCelular} onChange={(e) => setTelefoneCelular(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>

            <div>
              <Label htmlFor="emailFicha">E-mail para Contato</Label>
              <Input id="emailFicha" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
            </div>

            <div className="border border-surface-variant bg-background/50 rounded-lg p-3 text-xs space-y-2 mt-4">
              <span className="font-bold block text-primary">Informações de Integração (Batistote / Colégio Naviraí)</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="empresa" className="text-[10px]">Nome da Empresa no Timbre</Label>
                  <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="bg-background border-surface-variant text-on-surface h-7 text-xs" />
                </div>
                <div>
                  <Label htmlFor="cnpj" className="text-[10px]">CNPJ da Empresa</Label>
                  <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="bg-background border-surface-variant text-on-surface h-7 text-xs" />
                </div>
                <div>
                  <Label htmlFor="encarregado" className="text-[10px]">Encarregado / Responsável</Label>
                  <Input id="encarregado" value={encarregado} onChange={(e) => setEncarregado(e.target.value)} className="bg-background border-surface-variant text-on-surface h-7 text-xs" />
                </div>
                <div>
                  <Label htmlFor="foneRamal" className="text-[10px]">Telefone Encarregado</Label>
                  <Input id="foneRamal" value={foneRamal} onChange={(e) => setFoneRamal(e.target.value)} className="bg-background border-surface-variant text-on-surface h-7 text-xs" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: BANCO & CÔNJUGE */}
          <TabsContent value="bancarios" className="space-y-4">
            <div className="border-b border-surface-variant pb-2">
              <span className="font-bold text-sm block">4 - Informações Bancárias (para Recebimento)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="banco">Nome do Banco</Label>
                <Input id="banco" value={banco} onChange={(e) => setBanco(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="agencia">Agência</Label>
                <Input id="agencia" value={agencia} onChange={(e) => setAgencia(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="numeroConta">Número da Conta</Label>
                <Input id="numeroConta" value={numeroConta} onChange={(e) => setNumeroConta(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>
            <div>
              <Label htmlFor="tipoConta">Tipo de Conta</Label>
              <select id="tipoConta" value={tipoConta} onChange={(e) => setTipoConta(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                <option value="Conta Corrente">Conta Corrente</option>
                <option value="Conta Poupança">Conta Poupança</option>
                <option value="Outra">Outra (Salário, Digital, etc.)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="obsBancarias">Observações de Pagamento</Label>
              <Input id="obsBancarias" value={obsBancarias} onChange={(e) => setObsBancarias(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
            </div>

            <div className="border-b border-surface-variant pb-2 pt-4">
              <span className="font-bold text-sm block">Cônjuge (Dependente em Plano de Saúde)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nomeConjuge">Nome do Cônjuge</Label>
                <Input id="nomeConjuge" value={nomeConjuge} onChange={(e) => setNomeConjuge(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="cpfConjuge">CPF do Cônjuge</Label>
                <Input id="cpfConjuge" value={cpfConjuge} onChange={(e) => setCpfConjuge(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="nascimentoConjuge">Nascimento do Cônjuge</Label>
                <Input id="nascimentoConjuge" type="date" value={nascimentoConjuge} onChange={(e) => setNascimentoConjuge(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: DEPENDENTES */}
          <TabsContent value="dependentes" className="space-y-4">
            <div className="border-b border-surface-variant pb-2">
              <span className="font-bold text-sm block">5 - Dependentes (Para Salário-Família ou Imposto de Renda)</span>
            </div>

            {/* DEPENDENTE 1 */}
            <div className="border border-surface-variant bg-background/30 rounded-lg p-3 space-y-3">
              <span className="font-semibold text-xs text-primary block">Dependente 1</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px]">Nome Completo</Label>
                  <Input value={dep1Nome} onChange={(e) => setDep1Nome(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">CPF</Label>
                  <Input value={dep1Cpf} onChange={(e) => setDep1Cpf(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Data Nascimento</Label>
                  <Input type="date" value={dep1Nascimento} onChange={(e) => setDep1Nascimento(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-6 mt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep1SalFamilia === 'Sim'} onChange={(e) => setDep1SalFamilia(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Salário-Família?</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep1IR === 'Sim'} onChange={(e) => setDep1IR(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Dependente IR?</span>
                </label>
              </div>
            </div>

            {/* DEPENDENTE 2 */}
            <div className="border border-surface-variant bg-background/30 rounded-lg p-3 space-y-3">
              <span className="font-semibold text-xs text-primary block">Dependente 2</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px]">Nome Completo</Label>
                  <Input value={dep2Nome} onChange={(e) => setDep2Nome(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">CPF</Label>
                  <Input value={dep2Cpf} onChange={(e) => setDep2Cpf(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Data Nascimento</Label>
                  <Input type="date" value={dep2Nascimento} onChange={(e) => setDep2Nascimento(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-6 mt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep2SalFamilia === 'Sim'} onChange={(e) => setDep2SalFamilia(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Salário-Família?</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep2IR === 'Sim'} onChange={(e) => setDep2IR(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Dependente IR?</span>
                </label>
              </div>
            </div>

            {/* DEPENDENTE 3 */}
            <div className="border border-surface-variant bg-background/30 rounded-lg p-3 space-y-3">
              <span className="font-semibold text-xs text-primary block">Dependente 3</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px]">Nome Completo</Label>
                  <Input value={dep3Nome} onChange={(e) => setDep3Nome(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">CPF</Label>
                  <Input value={dep3Cpf} onChange={(e) => setDep3Cpf(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Data Nascimento</Label>
                  <Input type="date" value={dep3Nascimento} onChange={(e) => setDep3Nascimento(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-6 mt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep3SalFamilia === 'Sim'} onChange={(e) => setDep3SalFamilia(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Salário-Família?</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep3IR === 'Sim'} onChange={(e) => setDep3IR(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Dependente IR?</span>
                </label>
              </div>
            </div>

            {/* DEPENDENTE 4 */}
            <div className="border border-surface-variant bg-background/30 rounded-lg p-3 space-y-3">
              <span className="font-semibold text-xs text-primary block">Dependente 4</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px]">Nome Completo</Label>
                  <Input value={dep4Nome} onChange={(e) => setDep4Nome(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">CPF</Label>
                  <Input value={dep4Cpf} onChange={(e) => setDep4Cpf(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Data Nascimento</Label>
                  <Input type="date" value={dep4Nascimento} onChange={(e) => setDep4Nascimento(e.target.value)} className="bg-background border-surface-variant text-on-surface h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-6 mt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep4SalFamilia === 'Sim'} onChange={(e) => setDep4SalFamilia(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Salário-Família?</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dep4IR === 'Sim'} onChange={(e) => setDep4IR(e.target.checked ? 'Sim' : 'Não')} className="rounded bg-background border-surface-variant" />
                  <span>Dependente IR?</span>
                </label>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: CONTRATO & OUTROS VÍNCULOS */}
          <TabsContent value="contrato" className="space-y-4">
            <div className="border-b border-surface-variant pb-2">
              <span className="font-bold text-sm block">6 - Informações de Vínculo de Emprego</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primeiroEmprego">É o primeiro emprego do trabalhador?</Label>
                <select id="primeiroEmprego" value={primeiroEmprego} onChange={(e) => setPrimeiroEmprego(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div>
                <Label htmlFor="multiplosVinculos">Possui múltiplos vínculos (trabalha em outro lugar)?</Label>
                <select id="multiplosVinculos" value={multiplosVinculos} onChange={(e) => setMultiplosVinculos(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            </div>

            {multiplosVinculos === 'Sim' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-surface-variant bg-background/30 p-3 rounded-lg">
                <div>
                  <Label htmlFor="empresaOutro">Nome da outra Empresa</Label>
                  <Input id="empresaOutro" value={empresaOutroVinculo} onChange={(e) => setEmpresaOutroVinculo(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
                </div>
                <div>
                  <Label htmlFor="cnpjOutro">CNPJ da outra Empresa</Label>
                  <Input id="cnpjOutro" value={cnpjOutroVinculo} onChange={(e) => setCnpjOutroVinculo(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
                </div>
              </div>
            )}

            <div className="border-b border-surface-variant pb-2 pt-4">
              <span className="font-bold text-sm block">7 - Dados do Contrato de Trabalho</span>
            </div>
            <div>
              <Label htmlFor="cargoFuncao">Cargo / Função detalhada</Label>
              <Input id="cargoFuncao" placeholder="Ex: PROFESSORA DE CIÊNCIAS 6º E 7º ANO..." value={cargoFuncao} onChange={(e) => setCargoFuncao(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
            </div>

            <div>
              <Label htmlFor="horarioTrabalho">Horário de Trabalho / Carga Horária Mensal</Label>
              <Input id="horarioTrabalho" placeholder="Ex: 18 HORAS SEMANAIS, 99,22 HRS MENSAIS" value={horarioTrabalho} onChange={(e) => setHorarioTrabalho(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dataAdmissaoFicha">Data de Admissão</Label>
                <Input id="dataAdmissaoFicha" type="date" value={dataAdmissaoFutura} onChange={(e) => setDataAdmissaoFutura(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="salarioFicha">Salário Contratual (R$)</Label>
                <Input id="salarioFicha" placeholder="Ex: 2.221,51" value={salario} onChange={(e) => setSalario(e.target.value)} className="bg-background border-surface-variant text-on-surface" />
              </div>
              <div>
                <Label htmlFor="salarioTipo">Tipo de Salário</Label>
                <select id="salarioTipo" value={salarioTipo} onChange={(e) => setSalarioTipo(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="mês">Por Mês</option>
                  <option value="hora">Por Hora-Aula</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="valeTransporte">Vale Transporte?</Label>
                <select id="valeTransporte" value={valeTransporte} onChange={(e) => setValeTransporte(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div>
                <Label htmlFor="periculidade">Adicional Periculosidade?</Label>
                <select id="periculidade" value={periculidade} onChange={(e) => setPericulidade(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div>
                <Label htmlFor="insalubridade">Adicional Insalubridade?</Label>
                <select id="insalubridade" value={insalubridade} onChange={(e) => setInsalubridade(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="experiencia">Período de Experiência</Label>
                <select id="experiencia" value={experiencia} onChange={(e) => setExperiencia(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="30 + 60">30 + 60 dias (Padrão)</option>
                  <option value="45 + 45">45 + 45 dias</option>
                  <option value="Sem experiência">Sem contrato de experiência</option>
                </select>
              </div>
              <div>
                <Label htmlFor="exEmpregado">Já foi funcionário antes?</Label>
                <select id="exEmpregado" value={exEmpregado} onChange={(e) => setExEmpregado(e.target.value)} className="w-full bg-background border border-surface-variant text-on-surface rounded p-2 text-sm h-10">
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            </div>

            <div className="border border-surface-variant bg-background/20 p-3 rounded-lg mt-2 space-y-2">
              <span className="font-bold text-xs block text-primary">🔒 Lei Geral de Proteção de Dados (LGPD)</span>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="checkbox" checked={lgpdConcorda} onChange={(e) => setLgpdConcorda(e.target.checked)} className="rounded bg-background border-surface-variant" />
                <span>O funcionário concorda com os termos de consentimento e compartilhamento do eSocial/LGPD</span>
              </label>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-surface-variant pt-4 mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-white hover:bg-primary-dark">
            {saving ? 'Salvando...' : 'Salvar Dados Cadastrais'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
