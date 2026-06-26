import { describe, it, expect } from 'vitest';
import {
  normalizeBoletoNumber,
  supplierFromFileName,
  shouldRejectSupplierName
} from './boletoParser';

// Função de teste espelhada do parsing do OFX
const parseOfxValue = (amtRaw: string): number => {
  let amtClean = amtRaw.replace(/\s/g, '');
  if (amtClean.includes(',') && amtClean.includes('.')) {
    amtClean = amtClean.replace(/\./g, '').replace(',', '.');
  } else if (amtClean.includes(',')) {
    amtClean = amtClean.replace(',', '.');
  }
  return parseFloat(amtClean) || 0;
};

describe('Boleto Parser and Utility Unit Tests', () => {
  
  describe('normalizeBoletoNumber', () => {
    it('should extract and clean numeric characters only', () => {
      expect(normalizeBoletoNumber('34191.79001 01043.513184 91020.150008 7 97070000150550')).toBe('34191790010104351318491020150008797070000150550');
      expect(normalizeBoletoNumber('001-9')).toBe('0019');
      expect(normalizeBoletoNumber('')).toBe('');
      expect(normalizeBoletoNumber(undefined)).toBe('');
    });
  });

  describe('supplierFromFileName', () => {
    it('should extract correct supplier name from PDF filenames', () => {
      expect(supplierFromFileName('BOLETO_CLARO_12_2026.pdf')).toBe('CLARO 12 2026');
      expect(supplierFromFileName('PAGAMENTO-ENERGISA-MAIO.pdf')).toBe('ENERGISA MAIO');
      expect(supplierFromFileName('123456_SANESUL.pdf')).toBe('SANESUL');
    });
  });

  describe('shouldRejectSupplierName', () => {
    it('should reject invalid or garbage supplier names', () => {
      expect(shouldRejectSupplierName('VENCIMENTO')).toBe(true);
      expect(shouldRejectSupplierName('LOCAL DE PAGAMENTO')).toBe(true);
      expect(shouldRejectSupplierName('1234567890')).toBe(true);
      expect(shouldRejectSupplierName('ENERGISA')).toBe(false);
      expect(shouldRejectSupplierName('CLARO BRASIL')).toBe(false);
    });
  });

  describe('OFX Value Parsing (Brazilian vs International formats)', () => {
    it('should parse Brazilian format with thousand dot and decimal comma correctly', () => {
      expect(parseOfxValue('-1.234,56')).toBe(-1234.56);
      expect(parseOfxValue('1.250,5')).toBe(1250.5);
    });

    it('should parse standard international format correctly', () => {
      expect(parseOfxValue('-1234.56')).toBe(-1234.56);
      expect(parseOfxValue('1250.50')).toBe(1250.5);
    });

    it('should parse single decimal separator correctly', () => {
      expect(parseOfxValue('1500,50')).toBe(1500.5);
      expect(parseOfxValue('100')).toBe(100.0);
    });
  });

});
