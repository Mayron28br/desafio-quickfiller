import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCartaoPontoAlerts, calculateHoleriteAlerts } from '../src/services/alerts.js';
import { CartaoPontoPage, HoleritePage } from '../src/types/index.js';

test('Alertas Cartão de Ponto: Batida Ímpar gera alerta amarelo', () => {
  const pages: CartaoPontoPage[] = [
    {
      page: 1,
      days: [
        {
          date_raw: '01/05/2026',
          punches: [
            { kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' },
            { kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' },
            { kind: 'IN', time_raw: '13:00', time_hhmm: '13:00' } // 3 batidas (ímpar)
          ]
        }
      ]
    }
  ];

  const alerts = calculateCartaoPontoAlerts(pages);
  const alert = alerts.get('1-0');
  assert.ok(alert);
  assert.equal(alert.level, 'yellow');
  assert.match(alert.reasons[0]!, /ímpar/i);
});

test('Alertas Cartão de Ponto: Slots vazios de múltiplos turnos não geram falso alerta ímpar', () => {
  const pages: CartaoPontoPage[] = [
    {
      page: 1,
      days: [
        {
          date_raw: '01/05/2026',
          punches: [
            { kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' },
            { kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' },
            { kind: 'IN', time_raw: '', time_hhmm: '' },
            { kind: 'OUT', time_raw: '', time_hhmm: '' }
          ]
        }
      ]
    }
  ];

  const alerts = calculateCartaoPontoAlerts(pages);
  const alert = alerts.get('1-0');
  assert.ok(alert);
  assert.equal(alert.level, null);
});

test('Alertas Cartão de Ponto: Data Não Sequencial gera alerta vermelho', () => {
  const pages: CartaoPontoPage[] = [
    {
      page: 1,
      days: [
        { date_raw: '01/05/2026', punches: [{ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }, { kind: 'OUT', time_raw: '17:00', time_hhmm: '17:00' }] },
        { date_raw: '05/05/2026', punches: [{ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }, { kind: 'OUT', time_raw: '17:00', time_hhmm: '17:00' }] } // Pulou de 01 para 05
      ]
    }
  ];

  const alerts = calculateCartaoPontoAlerts(pages);
  const alertDia2 = alerts.get('1-1');
  assert.ok(alertDia2);
  assert.equal(alertDia2.level, 'red');
  assert.match(alertDia2.reasons[0]!, /não sequencial/i);
});

test('Alertas Cartão de Ponto: Vermelho tem precedência sobre Amarelo', () => {
  const pages: CartaoPontoPage[] = [
    {
      page: 1,
      days: [
        { date_raw: '01/05/2026', punches: [{ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }, { kind: 'OUT', time_raw: '17:00', time_hhmm: '17:00' }] },
        {
          date_raw: '05/05/2026', // Data não sequencial (Vermelho)
          punches: [
            { kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' } // Batida ímpar (Amarelo)
          ]
        }
      ]
    }
  ];

  const alerts = calculateCartaoPontoAlerts(pages);
  const alert = alerts.get('1-1');
  assert.ok(alert);
  assert.equal(alert.level, 'red'); // Vermelho ganha
  assert.equal(alert.reasons.length, 2);
});

test('Alertas Holerite: Mês Não Sequencial gera alerta vermelho', () => {
  const pages: HoleritePage[] = [
    { page: 1, month: '01', year: '2026', fields: [{ code: '1', label: 'Salário', reference: '', value: '2.000,00' }], bases: [] },
    { page: 2, month: '03', year: '2026', fields: [{ code: '1', label: 'Salário', reference: '', value: '2.000,00' }], bases: [] } // Pulou 02
  ];

  const alerts = calculateHoleriteAlerts(pages);
  const alertPag2 = alerts.get(2);
  assert.ok(alertPag2);
  assert.equal(alertPag2.level, 'red');
});

test('Alertas Holerite: Página Vazia gera alerta amarelo', () => {
  const pages: HoleritePage[] = [
    { page: 1, month: '', year: '', fields: [], bases: [] }
  ];

  const alerts = calculateHoleriteAlerts(pages);
  const alertPag1 = alerts.get(1);
  assert.ok(alertPag1);
  assert.equal(alertPag1.level, 'yellow');
  assert.match(alertPag1.reasons[0]!, /sem dados/i);
});
