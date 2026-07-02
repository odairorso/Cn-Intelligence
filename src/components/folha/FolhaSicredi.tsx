import { useState, useEffect } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Printer, FileSpreadsheet, ShieldCheck, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateBR } from '../../lib/folhaUtils';
import { toast } from 'sonner';
import { Professor } from '../../lib/folhaTypes';

export default function FolhaSicredi() {
  const { professores, updateProfessor } = useFolha();
  const [printing, setPrinting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Controle de seleção para impressão
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Estados locais para inputs em foco
  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});

  // Filtra colaboradores ativos
  const colaboradoresAtivos = professores.filter(p => p.ativo);

  // Inicializa a seleção com todos os ativos
  useEffect(() => {
    if (professores.length > 0 && selectedIds.length === 0) {
      setSelectedIds(professores.filter(p => p.ativo).map(p => p.id));
    }
  }, [professores]);

  // Sincroniza dados iniciais locais
  useEffect(() => {
    const initialValues: Record<string, Record<string, string>> = {};
    colaboradoresAtivos.forEach((c) => {
      const f = c.fichaCadastro || {};
      initialValues[c.id] = {
        dataNascimento: f.dataNascimento || '',
        rg: f.rg || '',
        estadoEmissor: f.estadoEmissor || '',
        dataEmissaoRg: f.dataEmissaoRg || '',
        salario: f.salario || (c.salarioFixo ? String(c.salarioFixo) : ''),
        endereco: f.endereco || '',
        numero: f.numero || '',
        bairro: f.bairro || '',
        municipio: f.municipio || 'NAVIRAI',
        estado: f.estado || 'MS',
        cep: f.cep || ''
      };
    });
    setLocalValues(initialValues);
  }, [professores]);

  const handleLocalChange = (colabId: string, field: string, value: string) => {
    setLocalValues(prev => ({
      ...prev,
      [colabId]: {
        ...(prev[colabId] || {}),
        [field]: value
      }
    }));
  };

  const saveField = async (colabId: string, field: string, value: string) => {
    const colab = professores.find(p => p.id === colabId);
    if (!colab) return;

    const currentFicha = colab.fichaCadastro || {};
    // Evita salvar se o valor não mudou
    if (currentFicha[field] === value) return;

    setSavingId(colabId);
    try {
      const updatedFicha = {
        ...currentFicha,
        [field]: value
      };

      const patch: Partial<Professor> = { fichaCadastro: updatedFicha };
      // Se alterou salário, também sincroniza com o salário fixo do professor
      if (field === 'salario') {
        patch.salarioFixo = parseFloat(value.replace(',', '.')) || 0;
      }

      await updateProfessor(colab.id, patch);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar campo.');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleTec = async (colabId: string, checked: boolean) => {
    const colab = professores.find(p => p.id === colabId);
    if (!colab) return;

    try {
      const currentFicha = colab.fichaCadastro || {};
      const updatedFicha = {
        ...currentFicha,
        optanteTec: checked ? 'Sim' : 'Não'
      };

      await updateProfessor(colab.id, {
        fichaCadastro: updatedFicha
      });
      toast.success(`${colab.nome} atualizado(a) com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar opção de TEC.');
    }
  };

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho de Ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Conta Salário Sicredi (TEC)</h2>
          <p className="text-xs text-on-surface-variant">Relação de Beneficiários e Optantes pela Transferência Especial de Crédito.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Relação Oficial
          </Button>
        </div>
      </div>

      {/* Informativo */}
      <Card className="bg-surface border-surface-variant border-l-4 border-l-green-500">
        <CardContent className="p-4 flex gap-3 items-start text-xs text-on-surface-variant leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-on-surface">Dados Inteligentes e Edição Inline ⚡</p>
            <p>
              Todos os dados abaixo são extraídos do cadastro oficial. 
              <strong> Você pode clicar e alterar qualquer valor direto na tabela</strong> — as alterações são salvas automaticamente assim que você clica fora da caixa de entrada!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Visualização */}
      <Card className="bg-surface border-surface-variant overflow-hidden">
        <CardHeader className="border-b border-surface-variant pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-on-surface">
            <FileSpreadsheet className="w-4 h-4 text-green-500" />
            Visualização e Edição Rápida de Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="border-surface-variant bg-surface-variant/20">
              <TableRow className="border-surface-variant hover:bg-transparent">
                <TableHead className="text-on-surface-variant text-xs py-2 w-[40px] text-center">
                  <input
                    type="checkbox"
                    checked={colaboradoresAtivos.length > 0 && selectedIds.length === colaboradoresAtivos.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(colaboradoresAtivos.map(c => c.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-surface-variant text-green-600 focus:ring-green-500 bg-background accent-green-600 cursor-pointer"
                  />
                </TableHead>
                <TableHead className="text-on-surface-variant text-xs py-2">Colaborador</TableHead>
                <TableHead className="text-on-surface-variant text-xs py-2 w-[110px]">Nascimento</TableHead>
                <TableHead className="text-on-surface-variant text-xs py-2 w-[220px]">CPF & Identidade (RG / UF / Emissão)</TableHead>
                <TableHead className="text-on-surface-variant text-xs py-2 w-[110px]">Salário (R$)</TableHead>
                <TableHead className="text-on-surface-variant text-xs py-2">Endereço Completo (Rua, Nº, Bairro, CEP)</TableHead>
                <TableHead className="text-on-surface-variant text-xs py-2 text-center w-[90px]">Optante TEC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradoresAtivos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-on-surface-variant">
                    Nenhum colaborador ativo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                colaboradoresAtivos.map((c) => {
                  const f = c.fichaCadastro || {};
                  const opta = f.optanteTec === 'Sim';
                  const rowValues = localValues[c.id] || {};
                  const isSelected = selectedIds.includes(c.id);

                  return (
                    <TableRow key={c.id} className="border-surface-variant hover:bg-surface-variant/20 py-1">
                      {/* Checkbox de Seleção */}
                      <TableCell className="text-center py-1">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, c.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-surface-variant text-green-600 focus:ring-green-500 bg-background accent-green-600 cursor-pointer"
                          />
                        </div>
                      </TableCell>

                      {/* Nome */}
                      <TableCell className="font-semibold text-on-surface text-xs py-1">
                        <div className="flex items-center gap-1.5">
                          {savingId === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />}
                          {c.nome}
                        </div>
                      </TableCell>

                      {/* Nascimento */}
                      <TableCell className="py-1">
                        <input
                          type="date"
                          value={rowValues.dataNascimento || ''}
                          onChange={(e) => handleLocalChange(c.id, 'dataNascimento', e.target.value)}
                          onBlur={(e) => saveField(c.id, 'dataNascimento', e.target.value)}
                          className="w-full text-xs bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-on-surface p-1 rounded hover:bg-surface-variant/30"
                        />
                      </TableCell>

                      {/* CPF / RG */}
                      <TableCell className="py-1 space-y-1">
                        <div className="font-mono text-xs p-1">{c.cpf}</div>
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            placeholder="RG"
                            value={rowValues.rg || ''}
                            onChange={(e) => handleLocalChange(c.id, 'rg', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'rg', e.target.value)}
                            className="w-20 text-[10px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded text-center"
                          />
                          <input
                            type="text"
                            placeholder="UF"
                            value={rowValues.estadoEmissor || ''}
                            onChange={(e) => handleLocalChange(c.id, 'estadoEmissor', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'estadoEmissor', e.target.value)}
                            className="w-8 text-[10px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded text-center uppercase"
                          />
                          <input
                            type="date"
                            title="Data Emissão"
                            value={rowValues.dataEmissaoRg || ''}
                            onChange={(e) => handleLocalChange(c.id, 'dataEmissaoRg', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'dataEmissaoRg', e.target.value)}
                            className="w-24 text-[9px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded"
                          />
                        </div>
                      </TableCell>

                      {/* Salário */}
                      <TableCell className="py-1">
                        <input
                          type="text"
                          placeholder="0,00"
                          value={rowValues.salario || ''}
                          onChange={(e) => handleLocalChange(c.id, 'salario', e.target.value)}
                          onBlur={(e) => saveField(c.id, 'salario', e.target.value)}
                          className="w-full text-xs font-semibold bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-on-surface p-1 rounded hover:bg-surface-variant/30 text-right"
                        />
                      </TableCell>

                      {/* Endereço Completo */}
                      <TableCell className="py-1">
                        <div className="flex flex-wrap gap-1 items-center">
                          <input
                            type="text"
                            placeholder="Endereço / Logradouro"
                            value={rowValues.endereco || ''}
                            onChange={(e) => handleLocalChange(c.id, 'endereco', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'endereco', e.target.value)}
                            className="w-[180px] text-[10px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded"
                          />
                          <input
                            type="text"
                            placeholder="Nº"
                            value={rowValues.numero || ''}
                            onChange={(e) => handleLocalChange(c.id, 'numero', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'numero', e.target.value)}
                            className="w-10 text-[10px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded text-center"
                          />
                          <input
                            type="text"
                            placeholder="Bairro"
                            value={rowValues.bairro || ''}
                            onChange={(e) => handleLocalChange(c.id, 'bairro', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'bairro', e.target.value)}
                            className="w-24 text-[10px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded"
                          />
                          <input
                            type="text"
                            placeholder="CEP"
                            value={rowValues.cep || ''}
                            onChange={(e) => handleLocalChange(c.id, 'cep', e.target.value)}
                            onBlur={(e) => saveField(c.id, 'cep', e.target.value)}
                            className="w-20 text-[10px] bg-transparent border border-transparent hover:border-surface-variant focus:border-green-500 focus:ring-0 text-on-surface p-0.5 rounded text-center"
                          />
                        </div>
                      </TableCell>

                      {/* Optante TEC */}
                      <TableCell className="text-center py-1">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={opta}
                            onChange={(e) => handleToggleTec(c.id, e.target.checked)}
                            className="w-4 h-4 rounded border-surface-variant text-green-600 focus:ring-green-500 bg-background accent-green-600 cursor-pointer"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ÁREA DE IMPRESSÃO (ESCONDIDA NA TELA, APARECE APENAS NO PRINT) */}
      <style>{`
        @media screen {
          .sicredi-print-area {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .sicredi-print-area, .sicredi-print-area * {
            visibility: visible;
          }
          .sicredi-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 297mm;
            height: 210mm;
            padding: 8mm 12mm;
            box-sizing: border-box;
            display: block !important;
            font-family: Arial, sans-serif;
            color: #000;
            font-size: 8px;
            background: white;
          }
          .sicredi-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
            margin-bottom: 5px;
          }
          .sicredi-table th, .sicredi-table td {
            border: 1px solid #000;
            padding: 3px 4px;
            text-align: left;
            font-size: 7px;
            line-height: 1.1;
            height: 18px;
          }
          .sicredi-table th {
            background-color: #e2efda !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: bold;
            text-align: center;
          }
          .sicredi-header {
            border: 1px solid #000;
            background-color: #e2efda !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
            padding: 5px;
            text-transform: uppercase;
          }
          .sicredi-subheader {
            border: 1px solid #000;
            border-top: none;
            padding: 5px;
            font-size: 8px;
            line-height: 1.2;
            text-align: center;
          }
          .sicredi-meta-row {
            display: flex;
            border: 1px solid #000;
            border-top: none;
            font-size: 8px;
          }
          .sicredi-meta-label {
            font-weight: bold;
            padding: 4px 6px;
            border-right: 1px solid #000;
            background-color: #f2f2f2;
            width: 120px;
            text-transform: uppercase;
          }
          .sicredi-meta-value {
            padding: 4px 6px;
            flex-grow: 1;
            font-weight: bold;
          }
          .sicredi-footer-note {
            border: 1px solid #000;
            padding: 6px;
            margin-top: 5px;
            font-size: 7px;
            line-height: 1.3;
            text-align: justify;
          }
          .sicredi-signature-box {
            margin-top: 15px;
            border-top: 1px solid #000;
            padding-top: 3px;
            font-size: 7.5px;
            width: 250px;
          }
          .sicredi-footer-meta {
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 6.5px;
            color: #444;
            border-top: 1.5px solid #000;
            padding-top: 3px;
          }
        }
      `}</style>

      <div className="sicredi-print-area">
        {/* Cabeçalho idêntico */}
        <div className="sicredi-header">
          Relação de Beneficiários
        </div>
        <div className="sicredi-subheader">
          Nos termos do que dispõe a legislação aplicável, segue a relação dos beneficiários que deverão dispor de conta de contas não movimentáveis por cheques destinadas ao registro e controle do fluxo de recursos.
        </div>

        {/* Informações da Empresa */}
        <div className="sicredi-meta-row">
          <div className="sicredi-meta-label">Nome da Empresa:</div>
          <div className="sicredi-meta-value">COLÉGIO NAVIRAÍ</div>
        </div>

        {/* Tabela Oficial Sicredi */}
        <table className="sicredi-table">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Nome Colaborador</th>
              <th style={{ width: '8%' }}>NASCIMENTO</th>
              <th style={{ width: '10%' }}>CPF</th>
              <th style={{ width: '10%' }}>RG</th>
              <th style={{ width: '8%' }}>ÓRGÃO EMISSOR / UF</th>
              <th style={{ width: '8%' }}>DATA EMISSÃO</th>
              <th style={{ width: '8%' }}>SALÁRIO</th>
              <th style={{ width: '16%' }}>ENDEREÇO</th>
              <th style={{ width: '8%' }}>BAIRRO</th>
              <th style={{ width: '10%' }}>CIDADE/UF</th>
              <th style={{ width: '7%' }}>CEP</th>
              <th style={{ width: '6%' }}>Optante de TEC*</th>
            </tr>
          </thead>
          <tbody>
            {colaboradoresAtivos.filter(c => selectedIds.includes(c.id)).map((c) => {
              const rowValues = localValues[c.id] || {};
              const f = c.fichaCadastro || {};
              const opta = f.optanteTec === 'Sim' ? 'Sim' : '';
              
              // Endereço formatado para impressão
              const endImprimir = rowValues.endereco ? `${rowValues.endereco?.toUpperCase()}, ${rowValues.numero}` : '';
              const cidadeImprimir = rowValues.municipio ? `${rowValues.municipio?.toUpperCase()}-${rowValues.estado || 'MS'}` : '';

              const salarioFinal = parseFloat(rowValues.salario) || 0;

              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 'bold' }}>{c.nome?.toUpperCase()}</td>
                  <td style={{ textAlign: 'center' }}>{rowValues.dataNascimento ? formatDateBR(rowValues.dataNascimento) : ''}</td>
                  <td style={{ textAlign: 'center' }}>{c.cpf}</td>
                  <td style={{ textAlign: 'center' }}>{rowValues.rg || ''}</td>
                  <td style={{ textAlign: 'center' }}>{rowValues.estadoEmissor?.toUpperCase() || ''}</td>
                  <td style={{ textAlign: 'center' }}>{rowValues.dataEmissaoRg ? formatDateBR(rowValues.dataEmissaoRg) : ''}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {salarioFinal > 0 ? formatCurrency(salarioFinal) : ''}
                  </td>
                  <td>{endImprimir}</td>
                  <td>{rowValues.bairro?.toUpperCase() || ''}</td>
                  <td>{cidadeImprimir}</td>
                  <td style={{ textAlign: 'center' }}>{rowValues.cep || ''}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{opta}</td>
                </tr>
              );
            })}
            {/* Linhas vazias para preenchimento se houver espaço/estilo */}
            {Array.from({ length: Math.max(0, 10 - colaboradoresAtivos.filter(c => selectedIds.includes(c.id)).length) }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Nota Legal do Sicredi */}
        <div className="sicredi-footer-note">
          *TEC - Transferência Especial de Crédito: mecanismo que permitirá às empresas depositarem os salários nas contas correntes escolhidas por seus funcionários. A TEC poderá ser empregada em situações em que se tenha um pagador para diversos beneficiários, que podem ser correntistas de diferentes bancos, conforme esclarece a determinação do Banco Central. ( Necessário assinatura no TERMO DE AUTORIZAÇÃO PARA TRANSFERÊNCIA DE RECURSOS)
        </div>

        {/* Rodapé da Empresa */}
        <div style={{ marginTop: '15px', padding: '5px', fontSize: '9px' }}>
          <strong>Empresa:</strong> COLÉGIO NAVIRAÍ <br />
          <strong>CNPJ:</strong> 24.227.497/0001-43
        </div>

        {/* Assinatura eletrônica / ZapSign style */}
        <div className="sicredi-signature-box">
          Documento assinado eletronicamente por ELAINE CRISTINA CAMACHO CAVALCANTE
        </div>

        {/* Metadados de Rodapé do Documento */}
        <div className="sicredi-footer-meta">
          <span>RQ-004.04 (12/14) Classificação da Informação: Uso Irrestrito</span>
          <span>ZapSign - Documento assinado eletronicamente, conforme MP 2.200-2/2001 e Lei 14.063/2020.</span>
        </div>
      </div>
    </div>
  );
}
