import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTime, parseCartaoPonto } from '../src/extractors/cartaoPonto.js';
import { parseHolerite } from '../src/extractors/holerite.js';
import { ExtractedDocument } from '../src/services/ocr.js';

test('Normalização de Horários: Trata formatos 08:25, 8:25, 08h25 e incertezas (?)', () => {
  assert.equal(normalizeTime('8:25'), '08:25');
  assert.equal(normalizeTime('08h25'), '08:25');
  assert.equal(normalizeTime('18.30'), '18:30');
  assert.equal(normalizeTime('0?:25'), '0?:25');
});

test('Extrator Cartão de Ponto: Extrai dias e batidas ordenadas sem descartar dias vazios', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          ESPELHO DE PONTO - MAIO 2026
          01/05/2026 FERIADO
          02/05/2026 08:00 12:00 13:00 17:00
          03/05/2026 08:15 17:30
        `
      }
    ]
  };

  const result = parseCartaoPonto(doc);
  assert.equal(result.pages.length, 1);
  const page = result.pages[0]!;

  assert.equal(page.days.length, 3);
  // Dia 1 (feriado, sem batidas)
  assert.equal(page.days[0]!.date_raw, '01/05/2026');
  assert.equal(page.days[0]!.punches.length, 0);

  // Dia 2 (4 batidas)
  assert.equal(page.days[1]!.date_raw, '02/05/2026');
  assert.equal(page.days[1]!.punches.length, 4);
  assert.equal(page.days[1]!.punches[0]!.kind, 'IN');
  assert.equal(page.days[1]!.punches[0]!.time_hhmm, '08:00');
  assert.equal(page.days[1]!.punches[1]!.kind, 'OUT');
  assert.equal(page.days[1]!.punches[1]!.time_hhmm, '12:00');
});

test('Extrator Holerite: Separação estrita de verbas (fields) e bases (bases)', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          DEMONSTRATIVO DE PAGAMENTO DE SALÁRIO
          Competência: 01/2026
          0010 Salário Base 220,00 2.389,77
          0998 INSS 262,87
          
          Base INSS: 2.545,68
          Total Vencimentos: 2.545,68
          Valor Líquido: 2.282,81
        `
      }
    ]
  };

  const result = parseHolerite(doc);
  const page = result.pages[0]!;

  assert.equal(page.month, '01');
  assert.equal(page.year, '2026');

  // Verifica que fields contém as verbas
  assert.ok(page.fields.some(f => f.label.includes('Salário Base') && f.value === '2.389,77'));
  assert.ok(page.fields.some(f => f.label.includes('INSS') && f.value === '262,87'));

  // Verifica que bases contém apenas as bases e totais
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('base inss') && b.value === '2.545,68'));
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('valor líquido') && b.value === '2.282,81'));

  // Garante que 'Valor Líquido' NÃO entrou em fields
  assert.equal(page.fields.some(f => f.label.toLowerCase().includes('valor líquido')), false);
});
