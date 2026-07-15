require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const pastaBoletos = path.join(__dirname, 'boletos_teste');

async function loadPdfParse() {
  try {
    const pdfParseModule = await import('pdf-parse');
    return pdfParseModule.default || pdfParseModule;
  } catch (e) {
    console.log('⚠️  pdf-parse não disponível:', e.message);
    return null;
  }
}

async function loadPdfJsLib() {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return pdfjsLib;
  } catch (e) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      return pdfjsLib;
    } catch (e2) {
      console.log('⚠️  pdfjs-dist não disponível:', e2.message);
      return null;
    }
  }
}

async function loadPuppeteer() {
  try {
    const puppeteer = await import('puppeteer');
    return puppeteer.default || puppeteer;
  } catch (e) {
    console.log('⚠️  puppeteer não disponível:', e.message);
    return null;
  }
}

async function loadTesseract() {
  try {
    const tesseract = await import('tesseract.js');
    return tesseract.createWorker;
  } catch (e) {
    console.log('⚠️  tesseract.js não disponível:', e.message);
    return null;
  }
}

async function loadPdfJs() {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    const pdfjs = await import('pdfjs-dist/web/pdfjs_viewer.mjs');
    return { lib: pdfjsLib, worker: pdfjs };
  } catch (e) {
    console.log('⚠️  pdfjs-dist não disponível:', e.message);
    return null;
  }
}

function formatarData(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function parserLinhaDigitavel(linha) {
  if (!linha) return null;
  const nums = String(linha).replace(/\D/g, '');
  if (nums.length !== 47 && nums.length !== 48) {
    return null;
  }

  try {
    let dados = {};
    
    if (nums.length === 47) {
      dados.banco = nums.substring(0, 3);
      dados.moeda = nums.substring(3, 4);
      dados.digitoVerificador = nums.substring(4, 5);
      dados.fatorVencimento = parseInt(nums.substring(5, 9));
      dados.valor = parseInt(nums.substring(9, 19)) / 100;
      dados.codigoBarras = nums;
      
      const dataBase = new Date('1997-10-07');
      const dias = dados.fatorVencimento;
      const dataVencimento = new Date(dataBase.getTime() + dias * 24 * 60 * 60 * 1000);
      dados.vencimento = formatarData(dataVencimento);
      
      dados.codigoEmpresa = nums.substring(19, 22);
      dados.nossoNumero = nums.substring(22, 43);
      dados.digito = nums.substring(3, 4);
    }
    
    return dados;
  } catch (e) {
    return null;
  }
}

function extrairDadosDoTexto(texto) {
  console.log('DEBUG extrair: received texto type:', typeof texto);
  const dados = {
    fornecedor: '',
    descricao: '',
    valor: 0,
    vencimento: '',
    empresa: '',
    linhaDigitavel: ''
  };

  if (!texto) {
    console.log('⚠️  Texto vazio!');
    return dados;
  }

  try {
    const linhas = texto.split('\n').map(l => l ? l.trim() : '').filter(l => l);
    console.log('DEBUG: linhas:', linhas.length);
    const textoUpper = texto.toUpperCase();

  // Primeiro, procurar campos explícitos no formato "CAMPO: valor"
  for (const linha of linhas) {
    const matchFornecedor = linha.match(/^FORNECEDOR[\s:]+(.+)$/i);
    if (matchFornecedor && matchFornecedor[1]) {
      dados.fornecedor = matchFornecedor[1].trim();
      break;
    }
  }

  const regexValor = /(?:R\$|VALOR|VALOR DO BOLETO|Valor|VALOR\s*[:\-]?\s*)[\s]*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i;
  const regexData = /(?:VENCIMENTO|Vcto|Vencimento|Venc\.|Data Venc|Validade|Data)[\s]*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
  const regexCNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
  const regexCodigoBarras = /\d{47,48}/g;
  const regexNumeros = /\b\d{1,3}(?:[\s,\.]?\d{3})*(?:[,\.]\d{2})\b/g;

  for (const linha of linhas) {
    const matchValor = linha ? linha.match(regexValor) : null;
    if (matchValor && matchValor[1] && !dados.valor) {
      const valorStr = String(matchValor[1]).replace(/\./g, '').replace(',', '.');
      dados.valor = parseFloat(valorStr);
    }

    const matchData = linha ? linha.match(regexData) : null;
    if (matchData && matchData[1]) {
      const dataStr = matchData[1];
      const partes = dataStr.split(/[\/\-]/);
      if (partes.length === 3) {
        let dia = partes[0], mes = partes[1], ano = partes[2];
        if (ano.length === 2) ano = '20' + ano;
        dados.vencimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
    }
  }

  const cnpjs = texto.match(regexCNPJ);
  if (cnpjs && cnpjs.length > 0) {
    dados.cnpj = cnpjs[0];
  }

  const cnpjMap = {
    '14330000007900': 'EDITORA E DISTRIBUIDORA',
    '14.330.000/0799-00': 'EDITORA E DISTRIBUIDORA',
    '43300007900': 'EDITORA E DISTRIBUIDORA'
  };
  
  if (dados.cnpj) {
    const cnpjLimpo = dados.cnpj.replace(/\D/g, '');
    for (const [cnpjPadrao, fornecedor] of Object.entries(cnpjMap)) {
      if (cnpjLimpo.includes(cnpjPadrao.replace(/\D/g, ''))) {
        dados.fornecedor = fornecedor;
        break;
      }
    }
  }

  const codigosBarras = texto.match(regexCodigoBarras);
  if (codigosBarras && codigosBarras.length > 0) {
    dados.linhaDigitavel = codigosBarras[0];
  }
  
  if (!dados.linhaDigitavel) {
    const digitosLinha = texto.match(/\b\d{43,48}\b/g);
    if (digitosLinha && digitosLinha.length > 0) {
      for (const d of digitosLinha) {
        const num = d.replace(/\D/g, '');
        if (num.length >= 43 && num.length <= 48) {
          dados.linhaDigitavel = num;
          break;
        }
      }
    }
  }
  
  if (!dados.linhaDigitavel) {
    const todosNumeros = texto.match(/\d+/g);
    if (todosNumeros) {
      for (const n of todosNumeros) {
        if (n.length >= 43 && n.length <= 48) {
          dados.linhaDigitavel = n;
          break;
        }
      }
    }
  }
  
  if (dados.linhaDigitavel) {
    const parsed = parserLinhaDigitavel(dados.linhaDigitavel);
    if (parsed) {
      if (!dados.valor) dados.valor = parsed.valor;
      if (!dados.vencimento) dados.vencimento = parsed.vencimento;
    }
  }

  // Só busca palavras-chave se não encontrou campo FORNECEDOR explícito
  if (!dados.fornecedor) {
    const palavrasFornecedor = [
      'ENERGISA', 'SANESUL', 'HAPVIDA', 'CLARO', 'VIVO', 'TIM',
      'BRADESCO', 'BB', 'BANCO DO BRASIL', 'ITAU', 'SANTANDER',
      'COPISA', 'IEL', 'FGTS', 'INSS', 'RECEITA FEDERAL', 'SIMPLES NACIONAL',
      'GPS', 'DARF', 'FOPAG', 'FOLHA', 'ANHANGUERA', 'KROTON', 'UNOPAR',
      'VSC', 'CONTABILIDADE', 'EDUCBANK', 'USONET', 'INVIOLAVEL'
    ];

    const textoUpper = texto.toUpperCase();
    for (const palavra of palavrasFornecedor) {
      if (textoUpper.includes(palavra)) {
        dados.fornecedor = palavra;
        break;
      }
    }

    if (!dados.fornecedor) {
      for (const linha of linhas.slice(0, 5)) {
        if (linha.length > 3 && linha.length < 50 && !linha.match(/^\d/) && !linha.includes('R$')) {
          dados.fornecedor = linha;
          break;
        }
      }
    }
  }

  const palavrasDescricao = [
    'energia', 'água', 'esgoto', 'saúde', 'plano', 'telefone', 'internet',
    'mensalidade', 'parcela', 'empréstimo', 'financiamento', 'aluguel',
    'imposto', 'taxa', 'serviço', 'honorários', 'manutenção'
  ];

  for (const palavra of palavrasDescricao) {
    if (textoUpper.includes(palavra.toUpperCase())) {
      dados.descricao = palavra.charAt(0).toUpperCase() + palavra.slice(1);
      break;
    }
  }

  if (!dados.descricao && linhas.length > 1) {
    for (const linha of linhas) {
      if (linha.length > 5 && linha.length < 60 && !linha.match(/^\d/) && !linha.includes('R$')) {
        dados.descricao = linha;
        break;
      }
    }
  }

  const empresas = ['CN', 'FACEMS', 'UNOPAR', 'LAB', 'CEI', 'GERAL'];
  for (const emp of empresas) {
    if (textoUpper.includes(emp)) {
      dados.empresa = emp;
      break;
    }
  }

  } catch (e) {
    console.log('Erro ao extrair dados:', e.message);
  }

  return dados;
}

async function loadPdfParse() {
  try {
    const pdfParseModule = await import('pdf-parse');
    return pdfParseModule.default || pdfParseModule;
  } catch (e) {
    console.log('⚠️  pdf-parse não disponível:', e.message);
    return null;
  }
}

async function processarArquivo(caminhoArquivo) {
  console.log('\n========================================');
  console.log('  PROCESSANDO BOLETO');
  console.log('========================================\n');

  const ext = path.extname(caminhoArquivo).toLowerCase();
  const nomeArquivo = path.basename(caminhoArquivo);

  console.log('Arquivo:', nomeArquivo);
  console.log('Tipo:', ext);

  let texto = '';
  let dados = {};

  if (ext === '.txt') {
    texto = fs.readFileSync(caminhoArquivo, 'utf-8');
    console.log('DEBUG: texto lido, tamanho:', texto.length);
    dados = extrairDadosDoTexto(texto);
    console.log('DEBUG: dados extraidos:', JSON.stringify(dados));
  } else if (ext === '.pdf') {
    const parser = await loadPdfParse();
    if (!parser) {
      console.log('\n⚠️  pdf-parse não disponível, não é possível processar PDF');
      return;
    }
    const pdfBuffer = fs.readFileSync(caminhoArquivo);
    let pdfData;
    try {
      pdfData = await parser(pdfBuffer);
    } catch (e) {
      pdfData = { text: '' };
    }
    texto = pdfData.text;
    console.log('DEBUG: PDF extraído, tamanho do texto:', texto.length);

    if (texto.length < 10) {
      console.log('⚠️  PDF é imagem escaneada. Convertendo para imagem e usando OCR...');
      const puppeteerFn = await loadPuppeteer();
      const createWorker = await loadTesseract();
      
      if (puppeteerFn && createWorker) {
        try {
          console.log('Iniciando conversão PDF -> imagem...');
          const browser = await puppeteerFn.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          const page = await browser.newPage();
          
          const pdfPath = path.resolve(caminhoArquivo);
          await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
          
          const screenshotPath = path.join(__dirname, 'temp_screenshot.png');
          await page.screenshot({ path: screenshotPath, fullPage: true, scale: 'device' });
          await browser.close();
          
          console.log('Imagem salva (alta resolução), executando OCR...');
          const worker = await createWorker('por', {
            logger: m => console.log('OCR:', m.status)
          });
          const ret = await worker.recognize(screenshotPath);
          texto = ret.data.text;
          await worker.terminate();
          
          fs.unlinkSync(screenshotPath);
          console.log('DEBUG: OCR extraído, tamanho do texto:', texto.length);
        } catch (e) {
          console.log('Erro na conversão/OCR:', e.message);
        }
      }
      
      if (!texto || texto.length < 10) {
        console.log('');
        console.log('========================================');
        console.log('  PDF ESCANEADO DETECTADO');
        console.log('========================================');
        console.log('');
        console.log('Para processar, por favor:');
        console.log('1. Abra o PDF em um visualizador');
        console.log('2. Exporte como imagem PNG');
        console.log('3. Salve a imagem na pasta');
        console.log('');
        dados = {
          fornecedor: '',
          descricao: '',
          valor: 0,
          vencimento: '',
          empresa: '',
          arquivo: nomeArquivo,
          manual: true
        };
      } else {
        dados = extrairDadosDoTexto(texto);
        console.log('DEBUG: dados extraidos:', JSON.stringify(dados));
      }
    } else {
      dados = extrairDadosDoTexto(texto);
      console.log('DEBUG: dados extraidos:', JSON.stringify(dados));
    }
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
    const createWorker = await loadTesseract();
    if (createWorker) {
      console.log('⚠️  Imagem detectada, usando OCR...');
      const worker = await createWorker('por');
      const ret = await worker.recognize(caminhoArquivo);
      texto = ret.data.text;
      await worker.terminate();
      console.log('DEBUG: OCR extraído, tamanho do texto:', texto.length);
      dados = extrairDadosDoTexto(texto);
      console.log('DEBUG: dados extraidos:', JSON.stringify(dados));
    } else {
      console.log('\n⚠️  tesseract.js não disponível');
      dados = {
        fornecedor: '',
        descricao: '',
        valor: 0,
        vencimento: '',
        empresa: '',
        arquivo: nomeArquivo,
        manual: true
      };
    }
  } else {
    console.log('❌ Tipo de arquivo não suportado:', ext);
    return;
  }

  console.log('\n--- DADOS EXTRAÍDOS ---');
  console.log('Fornecedor:', dados.fornecedor || '(não identificado)');
  console.log('Descrição:', dados.descricao || '(não identificada)');
  console.log('Valor:', dados.valor ? `R$ ${dados.valor.toFixed(2)}` : '(não identificado)');
  console.log('Vencimento:', dados.vencimento || '(não identificado)');
  console.log('Empresa:', dados.empresa || '(não identificada)');

  if (dados.linhaDigitavel) {
    console.log('Linha Digitável:', dados.linhaDigitavel);
  }

  console.log('\n--- CONFIRMAÇÃO ---');
  console.log('Os dados acima estão corretos?');

  if (!dados.fornecedor || !dados.valor || !dados.vencimento) {
    console.log('\n⚠️  ATENÇÃO: Alguns dados não foram identificados!');
    console.log('Você precisará inserir manualmente.');
  }

  return dados;
}

async function inserirBoleto(dados) {
  const uid = process.env.APP_UID || 'odair';
  
  const client = await pool.connect();
  let contaContabilId = null;
  try {
    contaContabilId = await getContaContabilId(client, dados.fornecedor, dados.descricao, 'DESPESA');
  } catch (err) {
    console.error('Erro ao buscar conta contábil:', err.message);
  } finally {
    client.release();
  }

  const result = await pool.query(
    `INSERT INTO transactions (uid, fornecedor, descricao, empresa, vencimento, valor, status, conta_contabil_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDENTE', $7)
     RETURNING id`,
    [uid, dados.fornecedor, dados.descricao, dados.empresa || 'CN', dados.vencimento, dados.valor, contaContabilId]
  );

  console.log('\n✅ Boleto inserido com sucesso!');
  console.log('ID:', result.rows[0].id);
  console.log('Fornecedor:', dados.fornecedor);
  console.log('Valor:', `R$ ${dados.valor.toFixed(2)}`);
  console.log('Vencimento:', dados.vencimento);
  console.log('Conta Contábil ID:', contaContabilId || 'Nenhuma');
}

async function getContaContabilId(client, fornecedor, descricao, tipo = 'DESPESA') {
  const fUpper = String(fornecedor || '').toUpperCase();
  const dUpper = String(descricao || '').toUpperCase();
  const text = `${fUpper} ${dUpper}`;

  let targetCodigo = null;

  if (tipo === 'RECEITA') {
    if (text.includes('MENSALIDADE') || text.includes('ALUNO') || text.includes('MATRICULA') || text.includes('MATRÍCULA')) {
      targetCodigo = '4.1';
    } else if (text.includes('REPASSE') || text.includes('CONVÊNIO') || text.includes('CONVENIO')) {
      targetCodigo = '4.2';
    } else if (text.includes('MATRICULA') || text.includes('MATRÍCULA')) {
      targetCodigo = '4.3';
    } else if (text.includes('PERMUTA')) {
      targetCodigo = '4.4';
    } else if (text.includes('APLICAÇÃO') || text.includes('APLICACAO') || text.includes('RENDIMENTO')) {
      targetCodigo = '4.5';
    } else {
      targetCodigo = '4.6';
    }
  } else {
    // DESPESA
    if (text.includes('FGTS')) {
      targetCodigo = '3.13';
    } else if (text.includes('GPS') || text.includes('INSS') || text.includes('PREVIDENCIA') || text.includes('PREVIDÊNCIA')) {
      targetCodigo = '3.14';
    } else if (text.includes('MULTA RESCISORIA') || text.includes('MULTA RESCISÓRIA') || text.includes('GRRF')) {
      targetCodigo = '3.16';
    } else if (text.includes('FOLHA') || text.includes('FOPAG') || text.includes('SALARIO') || text.includes('SALÁRIO') || text.includes('CONTRIBUIÇÃO SINDICAL') || text.includes('RESCISÃO') || text.includes('13º') || text.includes('DECIMO')) {
      targetCodigo = '3.1';
    } else if (text.includes('ALUGUEL') || text.includes('LOCAÇÃO') || text.includes('LOCACAO')) {
      targetCodigo = '3.2';
    } else if (text.includes('ENERGISA') || text.includes('SANESUL') || text.includes('AGUA') || text.includes('ÁGUA') || text.includes('LUZ') || text.includes('TELEFONE') || text.includes('CLARO') || text.includes('VIVO') || text.includes('TIM') || text.includes('TELECOM')) {
      targetCodigo = '3.3';
    } else if (text.includes('PAPELARIA') || text.includes('ESCRITÓRIO') || text.includes('ESCRITORIO') || text.includes('MATERIAL') || text.includes('IMPRESSÃO') || text.includes('IMPRESSAO')) {
      targetCodigo = '3.4';
    } else if (text.includes('INVIOLAVEL') || text.includes('SEGURANÇA') || text.includes('SEGURANCA') || text.includes('VIGILANCIA') || text.includes('VIGILÂNCIA')) {
      targetCodigo = '3.5';
    } else if (text.includes('EDITOR') || text.includes('LIVRO') || text.includes('APOSTILA')) {
      targetCodigo = '3.6';
    } else if (text.includes('IMPOSTO') || text.includes('DARF') || text.includes('DAS') || text.includes('SIMPLES NACIONAL') || text.includes('RECEITA FEDERAL') || text.includes('TRIBUTO') || text.includes('CONTRIBUIÇÃO SOCIAL')) {
      targetCodigo = '3.7';
    } else if (text.includes('MANUTENÇÃO') || text.includes('MANUTENCAO') || text.includes('REFORMA') || text.includes('REPARO') || text.includes('CONSERTO')) {
      targetCodigo = '3.8';
    } else if (text.includes('TARIFA') || text.includes('MENSALIDADE CONTA') || text.includes('MENSALIDADE BANCARIA') || text.includes('SERVIÇOS BANCÁRIOS') || text.includes('SERVICOS BANCARIOS')) {
      targetCodigo = '3.9';
    } else if (text.includes('JUROS') || text.includes('MULTA') || text.includes('ENCARGOS')) {
      targetCodigo = '3.10';
    } else if (text.includes('CONTABILIDADE') || text.includes('ASSESSORIA') || text.includes('VSC') || text.includes('HONORÁRIOS') || text.includes('HONORARIOS')) {
      targetCodigo = '3.11';
    }
  }

  if (targetCodigo) {
    const res = await client.query('SELECT id FROM contas_contabeis WHERE codigo = $1 AND ativo = true LIMIT 1', [targetCodigo]);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
  }

  return null;
}

async function main() {
  const arquivos = fs.readdirSync(pastaBoletos).filter(f => 
    ['.txt', '.pdf', '.jpg', '.jpeg', '.png'].includes(path.extname(f).toLowerCase())
  );

  if (arquivos.length === 0) {
    console.log('\n❌ Nenhum arquivo encontrado na pasta:', pastaBoletos);
    console.log('\nPara usar:');
    console.log('1. Coloque o arquivo do boleto (PDF, imagem ou TXT) na pasta "boletos_teste/"');
    console.log('2. Rode este script novamente');
    console.log('\nExemplos de formatos suportados:');
    console.log('  - TXT (texto com dados do boleto)');
    console.log('  - PDF (precisa de processamento manual)');
    console.log('  - Imagem (precisa de processamento manual)');
    pool.end();
    return;
  }

  console.log('\n📁 Arquivos encontrados:', arquivos.length);

  for (const arquivo of arquivos) {
    const caminho = path.join(pastaBoletos, arquivo);
    const dados = await processarArquivo(caminho);

    if (dados && dados.fornecedor && dados.valor && dados.vencimento) {
      await inserirBoleto(dados);
      
      console.log('\n📦 Movendo arquivo para pasta processado...');
      const pastaProcessado = path.join(pastaBoletos, 'processado');
      if (!fs.existsSync(pastaProcessado)) {
        fs.mkdirSync(pastaProcessado, { recursive: true });
      }
      const novoNome = `${Date.now()}_${arquivo}`;
      fs.renameSync(caminho, path.join(pastaProcessado, novoNome));
      console.log('✅ Arquivo movido para: processado/' + novoNome);
    } else {
      console.log('\n⚠️  Dados incompletos. Precisa de preenchimento manual.');
      console.log('Por favor, edite o arquivo e adicione as informações faltantes.');
    }
  }

  pool.end();
}

main().catch(e => {
  console.error('Erro:', e.message);
  pool.end();
});
