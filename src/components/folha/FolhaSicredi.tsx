import { useState } from 'react';
import { useFolha } from '../../contexts/FolhaContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Printer, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDateBR } from '../../lib/folhaUtils';
import { toast } from 'sonner';
import { Professor } from '../../lib/folhaTypes';

export default function FolhaSicredi() {
  const { professores, updateProfessor } = useFolha();
  const [printing, setPrinting] = useState(false);

  // Filtra colaboradores ativos
  const colaboradoresAtivos = professores.filter(p => p.ativo);

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
            <p className="font-semibold text-on-surface">O que é a Relação de Beneficiários Sicredi?</p>
            <p>
              Esta listagem reúne os dados cadastrais (CPF, RG, Salário, Endereço completo) exigidos pelo Sicredi para a abertura/vinculação das contas salário dos colaboradores.
              A marcação <strong>Optante de TEC</strong> indica se o colaborador escolheu transferir automaticamente os recursos salariais para outro banco.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Visualização */}
      <Card className="bg-surface border-surface-variant overflow-hidden">
        <CardHeader className="border-b border-surface-variant pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-on-surface">
            <FileSpreadsheet className="w-4 h-4 text-green-500" />
            Visualização dos Dados de Abertura de Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="border-surface-variant bg-surface-variant/20">
              <TableRow className="border-surface-variant hover:bg-transparent">
                <TableHead className="text-on-surface-variant text-xs">Colaborador</TableHead>
                <TableHead className="text-on-surface-variant text-xs">Nascimento</TableHead>
                <TableHead className="text-on-surface-variant text-xs">CPF / RG</TableHead>
                <TableHead className="text-on-surface-variant text-xs">Salário Base</TableHead>
                <TableHead className="text-on-surface-variant text-xs">Endereço Completo</TableHead>
                <TableHead className="text-on-surface-variant text-xs text-center">Optante TEC*</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradoresAtivos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-on-surface-variant">
                    Nenhum colaborador ativo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                colaboradoresAtivos.map((c) => {
                  const f = c.fichaCadastro || {};
                  const opta = f.optanteTec === 'Sim';
                  const enderecoCompleto = [
                    f.endereco ? `${f.endereco}, ${f.numero}` : '',
                    f.bairro || '',
                    f.municipio ? `${f.municipio}-${f.estado || 'MS'}` : '',
                    f.cep || ''
                  ].filter(Boolean).join(' - ');

                  const salarioFinal = parseFloat(f.salario) || c.salarioFixo || 0;

                  return (
                    <TableRow key={c.id} className="border-surface-variant hover:bg-surface-variant/40">
                      <TableCell className="font-semibold text-on-surface text-xs">{c.nome}</TableCell>
                      <TableCell className="text-on-surface-variant text-xs">{f.dataNascimento ? formatDateBR(f.dataNascimento) : '—'}</TableCell>
                      <TableCell className="text-on-surface-variant text-xs">
                        <div className="font-mono">{c.cpf}</div>
                        <div className="text-[10px] opacity-70">RG: {f.rg || '—'} {f.estadoEmissor ? `(${f.estadoEmissor})` : ''}</div>
                      </TableCell>
                      <TableCell className="text-on-surface text-xs font-semibold">
                        {salarioFinal > 0 ? formatCurrency(salarioFinal) : '—'}
                      </TableCell>
                      <TableCell className="text-on-surface-variant text-[11px] max-w-[250px] truncate" title={enderecoCompleto}>
                        {enderecoCompleto || '—'}
                      </TableCell>
                      <TableCell className="text-center">
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
            width: 100%;
            display: block !important;
            font-family: Arial, sans-serif;
            color: #000;
            font-size: 9px;
            background: white;
          }
          .sicredi-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .sicredi-table th, .sicredi-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            text-align: left;
            font-size: 8px;
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
            font-size: 11px;
            padding: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .sicredi-subheader {
            border: 1px solid #000;
            border-top: none;
            padding: 8px;
            font-size: 9px;
            line-height: 1.4;
            text-align: center;
          }
          .sicredi-meta-row {
            display: flex;
            border: 1px solid #000;
            border-top: none;
            font-size: 9px;
          }
          .sicredi-meta-label {
            font-weight: bold;
            padding: 6px;
            border-right: 1px solid #000;
            background-color: #f2f2f2;
            width: 150px;
            text-transform: uppercase;
          }
          .sicredi-meta-value {
            padding: 6px;
            flex-grow: 1;
            font-weight: bold;
          }
          .sicredi-footer-note {
            border: 1px solid #000;
            padding: 8px;
            margin-top: 10px;
            font-size: 8px;
            line-height: 1.4;
            text-align: justify;
          }
          .sicredi-signature-box {
            margin-top: 25px;
            border-top: 1px solid #000;
            padding-top: 4px;
            font-size: 8px;
            width: 250px;
          }
          .sicredi-footer-meta {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            color: #555;
            border-top: 1px solid #eee;
            padding-top: 4px;
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
            {colaboradoresAtivos.map((c) => {
              const f = c.fichaCadastro || {};
              const opta = f.optanteTec === 'Sim' ? 'Sim' : '';
              const salarioFinal = parseFloat(f.salario) || c.salarioFixo || 0;

              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 'bold' }}>{c.nome?.toUpperCase()}</td>
                  <td style={{ textAlign: 'center' }}>{f.dataNascimento ? formatDateBR(f.dataNascimento) : ''}</td>
                  <td style={{ textAlign: 'center' }}>{c.cpf}</td>
                  <td style={{ textAlign: 'center' }}>{f.rg || ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    {f.estadoEmissor ? `${f.estadoEmissor}` : ''}
                  </td>
                  <td style={{ textAlign: 'center' }}>{f.dataEmissaoRg ? formatDateBR(f.dataEmissaoRg) : ''}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {salarioFinal > 0 ? formatCurrency(salarioFinal) : ''}
                  </td>
                  <td>{f.endereco ? `${f.endereco?.toUpperCase()}, ${f.numero}` : ''}</td>
                  <td>{f.bairro?.toUpperCase() || ''}</td>
                  <td>{f.municipio ? `${f.municipio?.toUpperCase()}-${f.estado || 'MS'}` : 'NAVIRAI-MS'}</td>
                  <td style={{ textAlign: 'center' }}>{f.cep || ''}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{opta}</td>
                </tr>
              );
            })}
            {/* Linhas vazias para preenchimento se houver espaço/estilo */}
            {Array.from({ length: Math.max(0, 10 - colaboradoresAtivos.length) }).map((_, idx) => (
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
