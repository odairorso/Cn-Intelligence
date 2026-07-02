import test from 'node:test';
import assert from 'node:assert';

// Defina variáveis de ambiente de mock para evitar falhas na inicialização do pool do pg
process.env.DATABASE_URL = 'postgresql://localhost:5432/mock';
process.env.JWT_SECRET = 'mock-secret';

// Agora podemos importar os arquivos com segurança
import {
  normalizeBoletoNumber,
  isValidCnpj,
  supplierFromFileName,
  sanitizeInput,
  sanitizeObject
} from '../api/_utils.js';

import { parseDateToPg } from '../api/_db.js';

test('normalizeBoletoNumber', () => {
  // Strings normais com pontos e espaços
  assert.strictEqual(normalizeBoletoNumber('34191.79001 01043.513184 91020.150008 7 90020000026000'), '34191790010104351318491020150008790020000026000');
  
  // Boleto inválido/curto demais
  assert.strictEqual(normalizeBoletoNumber('12345'), '12345');
  
  // Valores vazios/nulos
  assert.strictEqual(normalizeBoletoNumber(null), '');
  assert.strictEqual(normalizeBoletoNumber(undefined), '');
  assert.strictEqual(normalizeBoletoNumber(''), '');
  assert.strictEqual(normalizeBoletoNumber('UNDEFINED'), '');

  // Valores puramente alfabéticos ou na blacklist (devem retornar vazio)
  assert.strictEqual(normalizeBoletoNumber('CONSTATADO'), '');
  assert.strictEqual(normalizeBoletoNumber('CONTRATADO'), '');
  assert.strictEqual(normalizeBoletoNumber('ISENTO'), '');
  assert.strictEqual(normalizeBoletoNumber('ABCDEF'), '');

  // Valor alfanumérico contendo dígitos (deve ser preservado e normalizado)
  assert.strictEqual(normalizeBoletoNumber('12345-ABC'), '12345ABC');
});

test('isValidCnpj', () => {
  // CNPJ válido (exemplo real de gerador)
  assert.strictEqual(isValidCnpj('11.222.333/0001-81'), true);
  
  // CNPJ inválido
  assert.strictEqual(isValidCnpj('11.222.333/0001-00'), false);
  
  // CNPJ com tamanho incorreto
  assert.strictEqual(isValidCnpj('123'), false);
  
  // CNPJ com dígitos repetidos
  assert.strictEqual(isValidCnpj('00000000000000'), false);
});

test('supplierFromFileName', () => {
  assert.strictEqual(supplierFromFileName('BOL_FORNECEDOR_TESTE.pdf'), 'FORNECEDOR TESTE');
  assert.strictEqual(supplierFromFileName('BOLETO-FORNECEDOR_2025.pdf'), 'FORNECEDOR 2025');
  assert.strictEqual(supplierFromFileName('MAT-fornecedor-teste-15-08-2025.pdf'), 'fornecedor teste 15 08 2025');
  assert.strictEqual(supplierFromFileName('just_name.pdf'), 'just name');
});

test('sanitizeInput', () => {
  // Remove tags HTML simples
  assert.strictEqual(sanitizeInput('<div>teste</div>'), 'divteste/div');
  
  // Preserva caracteres válidos
  assert.strictEqual(sanitizeInput("D'Angelo"), "D'Angelo");
  assert.strictEqual(sanitizeInput("A & B"), "A & B");
  
  // Trunca em valores muito grandes
  const largeInput = 'a'.repeat(15000);
  assert.strictEqual(sanitizeInput(largeInput).length, 10000);
});

test('sanitizeObject', () => {
  const dirty = {
    name: '<b>João</b>',
    details: {
      address: 'Rua 1 <script>alert(1)</script>',
      items: ['<tag>', 'ok']
    },
    age: 30
  };

  const clean = sanitizeObject(dirty);

  assert.strictEqual(clean.name, 'bJoão/b');
  assert.strictEqual(clean.details.address, 'Rua 1 scriptalert(1)/script');
  assert.strictEqual(clean.details.items[0], '<tag>'); // Arrays de strings simples passam como estão pela implementação atual de sanitizeObject
  assert.strictEqual(clean.details.items[1], 'ok');
  assert.strictEqual(clean.age, 30);
});

test('parseDateToPg', () => {
  // Formato YYYY-MM-DD
  assert.strictEqual(parseDateToPg('2025-08-15'), '2025-08-15');
  
  // Formato DD/MM/YYYY
  assert.strictEqual(parseDateToPg('15/08/2025'), '2025-08-15');
  
  // Formato DD.MM.YY
  assert.strictEqual(parseDateToPg('15.08.25'), '2025-08-15');
  
  // Formato inválido
  assert.strictEqual(parseDateToPg('Data Inválida'), null);
});
