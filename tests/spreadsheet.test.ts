import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSpreadsheet } from '../src/services/spreadsheet.js';
import { CartaoPontoTranscription, HoleriteTranscription } from '../src/types/index.js';

test('Gerador de Planilha: Gera arquivos XLSX, CSV e JSON para Cartão de Ponto', async () => {
  const cp: CartaoPontoTranscription = {
    pages: [
      {
        page: 1,
        days: [
          {
            date_raw: '01/05/2026',
            punches: [
              { kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' },
              { kind: 'OUT', time_raw: '17:00', time_hhmm: '17:00' }
            ]
          }
        ]
      }
    ]
  };

  // JSON
  const jsonRes = await generateSpreadsheet('cartao-ponto', cp, 'json');
  assert.equal(jsonRes.contentType, 'application/json');
  assert.ok(jsonRes.buffer.length > 0);

  // CSV
  const csvRes = await generateSpreadsheet('cartao-ponto', cp, 'csv');
  assert.ok(csvRes.contentType.includes('text/csv'));
  const csvText = csvRes.buffer.toString('utf-8');
  assert.ok(csvText.includes('Data;Entrada 1;Saída 1'));
  assert.ok(csvText.includes('01/05/2026;08:00;17:00'));

  // XLSX
  const xlsxRes = await generateSpreadsheet('cartao-ponto', cp, 'xlsx');
  assert.equal(xlsxRes.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(xlsxRes.buffer.length > 0);
});

test('Gerador de Planilha: Gera matriz correta para Holerite', async () => {
  const hol: HoleriteTranscription = {
    pages: [
      {
        page: 1,
        month: '01',
        year: '2026',
        fields: [
          { code: '10', label: 'Salário Base', reference: '', value: '3.000,00' },
          { code: '20', label: 'Gratificação', reference: '', value: '500,00' }
        ],
        bases: []
      },
      {
        page: 2,
        month: '02',
        year: '2026',
        fields: [
          { code: '10', label: 'Salário Base', reference: '', value: '3.000,00' }
        ],
        bases: []
      }
    ]
  };

  const csvRes = await generateSpreadsheet('holerite', hol, 'csv');
  const csvText = csvRes.buffer.toString('utf-8');
  assert.ok(csvText.includes('Salário Base'));
  assert.ok(csvText.includes('Gratificação'));
});
