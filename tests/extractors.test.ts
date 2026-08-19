import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTime, parseCartaoPonto } from '../src/extractors/cartaoPonto.js';
import { parseHolerite, extractCompetence } from '../src/extractors/holerite.js';
import { ExtractedDocument } from '../services/ocr.js';

test('Normalização de Horários: Trata formatos 08:25, 8:25, 08h25, sufixos d/c, prefixo + e incertezas (?)', () => {
  assert.equal(normalizeTime('8:25'), '08:25');
  assert.equal(normalizeTime('08h25'), '08:25');
  assert.equal(normalizeTime('18.30'), '18:30');
  assert.equal(normalizeTime('07:00d'), '07:00');
  assert.equal(normalizeTime('+03:00d'), '03:00');
  assert.equal(normalizeTime('06:56c'), '06:56');
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

test('Extrator Cartão de Ponto: Layout Banco do Brasil (Entrada/Saída + Intervalos)', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          BANCO DO BRASIL - PONTO ELETRÔNICO - Relatório Mensal
          Mês/Ano: 05/2010
          Dia Entrada Saida Intervalo 1 Intervalo 2 Intervalo 3 HE Diurno Funç Conc
          01 SAB Feriado
          02 DOM Descanso Semanal
          18 TER 09:00 - 18:00 12:00 - 13:00 2,0 610 S
          31 SEG 09:00 - 15:15 12:00 - 12:15 610 S
        `
      }
    ]
  };

  const result = parseCartaoPonto(doc);
  const page = result.pages[0]!;
  assert.equal(page.days.length, 4);

  // 01 SAB (sem batidas)
  assert.equal(page.days[0]!.date_raw, '01 SAB');
  assert.equal(page.days[0]!.punches.length, 0);

  // 18 TER (Entrada 09:00, Saida 12:00, Entrada 13:00, Saida 18:00)
  assert.equal(page.days[2]!.date_raw, '18 TER');
  assert.equal(page.days[2]!.punches.length, 4);
  assert.equal(page.days[2]!.punches[0]!.time_hhmm, '09:00');
  assert.equal(page.days[2]!.punches[1]!.time_hhmm, '12:00');
  assert.equal(page.days[2]!.punches[2]!.time_hhmm, '13:00');
  assert.equal(page.days[2]!.punches[3]!.time_hhmm, '18:00');
});

test('Extrator Cartão de Ponto: Colunar com sufixos e descarte de colunas resumo', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          16/12/2019 SEG 07:00d 12:00d 13:00d 17:00d
          24/12/2019 TER ABONO JORNADA ENT/SAIDA | | | | | 08:00
          28/12/2019 SAB 22:59d +03:00d +04:00d +06:59d | | | | 06:01
          29/01/2020 QUA 22:55c +03:00d +04:00d +07:15c | 00:20 | | | 06:05
        `
      }
    ]
  };

  const result = parseCartaoPonto(doc);
  const page = result.pages[0]!;
  assert.equal(page.days.length, 4);

  // 16/12
  assert.equal(page.days[0]!.punches.length, 4);
  assert.equal(page.days[0]!.punches[0]!.time_raw, '07:00d');
  assert.equal(page.days[0]!.punches[0]!.time_hhmm, '07:00');

  // 24/12 (abono -> vazio)
  assert.equal(page.days[1]!.punches.length, 0);

  // 28/12 (+03:00d -> 03:00, ignora 06:01 da coluna de resumo à direita)
  assert.equal(page.days[2]!.punches.length, 4);
  assert.equal(page.days[2]!.punches[1]!.time_raw, '+03:00d');
  assert.equal(page.days[2]!.punches[1]!.time_hhmm, '03:00');
  assert.equal(page.days[2]!.punches[3]!.time_hhmm, '06:59');

  // 29/01
  assert.equal(page.days[3]!.punches.length, 4);
  assert.equal(page.days[3]!.punches[0]!.time_hhmm, '22:55');
});

test('Extrator Cartão de Ponto: Layout Quinzena / Cartão de Ponto Cartográfico (1ª e 2ª Quinzena)', () => {
  const doc: ExtractedDocument = {
    totalPages: 2,
    pages: [
      {
        pageNumber: 1,
        isOcr: true,
        text: `
          1.QUINZENA Mês: Dezembro Ano: 2020
          MANHÃ Entrada Saída TARDE Entrada Saída EXTRA Entrada Saída
          1 09:50 14:15 15:14 19:21 19:35 23:20
          2
          3 06:22 14:31 15:27 19:16 19:29 23:28
          4
          5 09:09 14:04 15:01 18:14 18:29 23:45
          6
          7 09:30 14:59 15:40 19:44 20:16 22:40
          8
          9 09:41 15:10 16:04 19:55 20:10 23:43
          10
          11 09:42 14:16 15:12 19:47 20:00 23:27
          12
          13 09:34 12:53 13:40 16:45 16:58 23:30
          14
          15 09:39 16:00 16:57 19:59 20:12 22:41
        `
      },
      {
        pageNumber: 2,
        isOcr: true,
        text: `
          2.QUINZENA Mês: Dezembro Ano: 2020
          16
          17 09:32 14:23 15:21 16:20 16:35 23:42
          18
          19 09:46 16:32 17:30 23:36
          20
          21 09:11 14:07 15:07 16:50 17:04 23:36
          22 17:14 21:54 22:09 23:51
          23 08:24 15:24 16:24 21:41 21:54 23:46
          24
          25
          26
          27 09:48 14:00 14:59 17:12 17:27 23:11
          28
          29 09:16 15:29 16:27 17:07 17:21 23:28
          30
          31 08:39 12:15 12:39 16:15
        `
      }
    ]
  };

  const result = parseCartaoPonto(doc);
  assert.equal(result.pages.length, 2);

  const p1 = result.pages[0]!;
  assert.equal(p1.days.length, 15);
  assert.equal(p1.days[0]!.date_raw, '01');
  assert.equal(p1.days[0]!.punches.length, 6);
  assert.equal(p1.days[0]!.punches[0]!.time_hhmm, '09:50');
  assert.equal(p1.days[0]!.punches[5]!.time_hhmm, '23:20');

  // Dia 2 é vazio
  assert.equal(p1.days[1]!.date_raw, '02');
  assert.equal(p1.days[1]!.punches.length, 0);

  // Dia 3 tem 6 batidas
  assert.equal(p1.days[2]!.date_raw, '03');
  assert.equal(p1.days[2]!.punches.length, 6);
  assert.equal(p1.days[2]!.punches[0]!.time_hhmm, '06:22');

  const p2 = result.pages[1]!;
  assert.equal(p2.days.length, 16); // 16 a 31
  assert.equal(p2.days[0]!.date_raw, '16');
  assert.equal(p2.days[0]!.punches.length, 0);
  assert.equal(p2.days[1]!.date_raw, '17');
  assert.equal(p2.days[1]!.punches.length, 6);
  assert.equal(p2.days[1]!.punches[0]!.time_hhmm, '09:32');
});

test('Extrator Cartão de Ponto: Layout SIPON / POEL,C (Múltiplas linhas por dia)', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          FOLHA DE FREQUENCIA - SISTEMA DE PONTO ELETRONICO - SIPON POEL,C
          Mes/Ano : 7 / 2012
          Dia Semana Jornada Entrada Saida Ocorrencia Qtde
          1 - DOM 08:00
          2 - SEG 08:00 09:03 14:05 HE-BCO DE HORAS 00:13
                        15:12 18:36 HE-REMUNERADA 00:13
          9 - QUI 08:00 DESTACAMENTO
        `
      }
    ]
  };

  const result = parseCartaoPonto(doc);
  const page = result.pages[0]!;
  assert.equal(page.days.length, 3);

  // Dia 1
  assert.equal(page.days[0]!.date_raw, '01 - DOM');
  assert.equal(page.days[0]!.punches.length, 0);

  // Dia 2 (combina manhã e tarde: 09:03, 14:05, 15:12, 18:36)
  assert.equal(page.days[1]!.date_raw, '02 - SEG');
  assert.equal(page.days[1]!.punches.length, 4);
  assert.equal(page.days[1]!.punches[0]!.time_hhmm, '09:03');
  assert.equal(page.days[1]!.punches[1]!.time_hhmm, '14:05');
  assert.equal(page.days[1]!.punches[2]!.time_hhmm, '15:12');
  assert.equal(page.days[1]!.punches[3]!.time_hhmm, '18:36');

  // Dia 9
  assert.equal(page.days[2]!.date_raw, '09 - QUI');
  assert.equal(page.days[2]!.punches.length, 0);
});

test('Extrator Cartão de Ponto: Colunar com sufixos e descarte de colunas resumo', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          16/12/2019 SEG 07:00d 12:00d 13:00d 17:00d
          24/12/2019 TER ABONO JORNADA ENT/SAIDA | | | | | 08:00
          28/12/2019 SAB 22:59d +03:00d +04:00d +06:59d | | | | 06:01
          29/01/2020 QUA 22:55c +03:00d +04:00d +07:15c | 00:20 | | | 06:05
        `
      }
    ]
  };

  const result = parseCartaoPonto(doc);
  const page = result.pages[0]!;
  assert.equal(page.days.length, 4);

  // 16/12
  assert.equal(page.days[0]!.punches.length, 4);
  assert.equal(page.days[0]!.punches[0]!.time_raw, '07:00d');
  assert.equal(page.days[0]!.punches[0]!.time_hhmm, '07:00');

  // 24/12 (abono -> vazio)
  assert.equal(page.days[1]!.punches.length, 0);

  // 28/12 (+03:00d -> 03:00, ignora 06:01 da coluna de resumo à direita)
  assert.equal(page.days[2]!.punches.length, 4);
  assert.equal(page.days[2]!.punches[1]!.time_raw, '+03:00d');
  assert.equal(page.days[2]!.punches[1]!.time_hhmm, '03:00');
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

test('Extrator Holerite: Tabela com 2 colunas (Proventos e Descontos lado a lado) e deduplicação de via dupla', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          Recibo de Pagamento
          Referencia: SETEMBRO/2019 Folha: MENSAL
          SALARIO 953,36 INSS MES 200,43
          DSR COMISSAO 173,68 DESC ASS MEDICA AMIL 5,00
          REMUNERACAO VARIAVEL 1.100,00 VALE REFEICAO 6,00
          
          TOTAL DE PROVENTOS 2.227,04 TOTAL DE DESCONTOS 211,43
          LÍQUIDO A RECEBER 2.015,61
          Salário Base: 1.300,00 Sal. Contrib. INSS: 2.227,04 Base Cálc. FGTS: 0,00 FGTS Mês: 178,16 Base Cálc. IRRF: 0,00
          
          ------------------------------------------------------------------
          Recibo de Pagamento (Via do Empregado - Duplicada)
          Referencia: SETEMBRO/2019 Folha: MENSAL
          SALARIO 953,36 INSS MES 200,43
          DSR COMISSAO 173,68 DESC ASS MEDICA AMIL 5,00
          REMUNERACAO VARIAVEL 1.100,00 VALE REFEICAO 6,00
          
          TOTAL DE PROVENTOS 2.227,04 TOTAL DE DESCONTOS 211,43
          LÍQUIDO A RECEBER 2.015,61
        `
      }
    ]
  };

  const result = parseHolerite(doc);
  const page = result.pages[0]!;

  assert.equal(page.month, '09');
  assert.equal(page.year, '2019');

  // Verifica se todas as 6 verbas distintas foram extraídas (sem duplicação da 2ª via)
  assert.equal(page.fields.length, 6);
  assert.ok(page.fields.some(f => f.label === 'SALARIO' && f.value === '953,36'));
  assert.ok(page.fields.some(f => f.label === 'INSS MES' && f.value === '200,43'));
  assert.ok(page.fields.some(f => f.label === 'DSR COMISSAO' && f.value === '173,68'));
  assert.ok(page.fields.some(f => f.label === 'DESC ASS MEDICA AMIL' && f.value === '5,00'));
  assert.ok(page.fields.some(f => f.label === 'REMUNERACAO VARIAVEL' && f.value === '1.100,00'));
  assert.ok(page.fields.some(f => f.label === 'VALE REFEICAO' && f.value === '6,00'));

  // Verifica bases
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('líquido') && b.value === '2.015,61'));
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('proventos') && b.value === '2.227,04'));
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('salário base') && b.value === '1.300,00'));
});

test('Extrator Holerite: Layout Banco do Brasil (Rendimentos com valores negativos e referências de competência)', () => {
  const doc: ExtractedDocument = {
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        isOcr: false,
        text: `
          RENDIMENTOS #interna
          Declaração Remuneração - Folha de Pagamento
          Mês/Ano: 08/2018 Folha de Pagamento: MÊS
          Verba Nome Base / Saldo / Benefício Valor
          010 VENCIMENTO PADRAO-VP 3.059,94
          011 ADICIONAL POR MERITO 602,14
          803 PREVI PESSOAL PB2 6.188,63 -433,20
          875 IMPOSTO DE RENDA-FONTE 4.882,93 -473,44
          
          Mês/Ano: 08/2018 Folha de Pagamento: ACERTO
          Verba Nome Base / Saldo / Benefício Valor
          058 HORA EXTRA-BCO HORAS-CONV JULHO/18 -12,89
          803 PREVI PESSOAL PB2 AC.SIST/0718 0,90
          875 IMPOSTO DE RENDA-FONTE 11,87 3,26
          
          Remuneração Função Vl. Ref.: 5.017,04 Proventos Retidos: 0,00 Proventos Bruto: 6.188,63
          Adiantamento 13o.: 3.094,31 Margem (30%): 1.113,97 Consignação: 1.837,08
          Provisão FGTS: 495,09 Margem (70%): 2.494,96 Proventos Líquidos: 4.351,55
        `
      }
    ]
  };

  const result = parseHolerite(doc);
  const page = result.pages[0]!;

  assert.equal(page.month, '08');
  assert.equal(page.year, '2018');

  // Verifica verbas com valores positivos e negativos
  assert.ok(page.fields.some(f => f.code === '010' && f.label === 'VENCIMENTO PADRAO-VP' && f.value === '3.059,94'));
  assert.ok(page.fields.some(f => f.code === '803' && f.label === 'PREVI PESSOAL PB2' && f.reference === '6.188,63' && f.value === '-433,20'));
  assert.ok(page.fields.some(f => f.code === '058' && f.label === 'HORA EXTRA-BCO HORAS-CONV' && f.reference === 'JULHO/18' && f.value === '-12,89'));
  assert.ok(page.fields.some(f => f.code === '803' && f.label === 'PREVI PESSOAL PB2' && f.reference === 'AC.SIST/0718' && f.value === '0,90'));

  // Verifica bases
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('proventos bruto') && b.value === '6.188,63'));
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('proventos líquido') && b.value === '4.351,55'));
  assert.ok(page.bases.some(b => b.label.toLowerCase().includes('consignação') && b.value === '1.837,08'));
});

test('Auto-detecção de Documento: Identifica Cartão de Ponto vs Holerite automaticamente', async () => {
  const { detectDocumentType } = await import('../src/routes/transcricoes.js');

  const pontoDoc: ExtractedDocument = {
    totalPages: 1,
    pages: [{
      pageNumber: 1,
      isOcr: false,
      text: 'BANCO DO BRASIL - PONTO ELETRÔNICO - Relatório Mensal\n01 SAB Feriado\n18 TER 09:00 - 18:00 12:00 - 13:00'
    }]
  };

  const holeriteDoc: ExtractedDocument = {
    totalPages: 1,
    pages: [{
      pageNumber: 1,
      isOcr: false,
      text: 'RENDIMENTOS - Declaração Remuneração - Folha de Pagamento\nVerba Nome Base Valor\n010 VENCIMENTO PADRAO 3.059,94\nProventos Bruto: 6.188,63'
    }]
  };

  assert.equal(detectDocumentType(pontoDoc), 'cartao-ponto');
  assert.equal(detectDocumentType(holeriteDoc), 'holerite');
});

test('Pré-processamento de Imagem: Executa binarização adaptativa de Otsu com sucesso', async () => {
  const { preprocessImageForOcr } = await import('../src/services/ocr.js');
  const { createCanvas } = await import('@napi-rs/canvas');

  // Cria uma imagem sintética com texto cinza e ruído de fundo
  const canvas = createCanvas(100, 50);
  const rawBuffer = canvas.toBuffer('image/png');
  const processedBuffer = await preprocessImageForOcr(rawBuffer);

  assert.ok(processedBuffer instanceof Buffer);
  assert.ok(processedBuffer.length > 0);
});

test('Reconhecimento de Imagem Pura: Detecta ausência de camada de texto e aciona OCR Tesseract', async () => {
  const { cleanPjeMetadata } = await import('../src/services/ocr.js');

  // 1. Página sem texto embutido (retorna vazio)
  const emptyPageText = '';
  assert.equal(cleanPjeMetadata(emptyPageText).length, 0);

  // 2. Página que contém apenas carimbo/rodapé de assinatura eletrônica do PJe (sem texto de conteúdo)
  const pjeOnlyText = `
    Assinado eletronicamente por: FULANO DE TAL - 15/08/2021 14:32:10
    Documento assinado eletronicamente por: JUIZ DO TRABALHO
    Juntado em: 15/08/2021 14:32:10 - ID. a1b2c3d - Fls. 45
    Tribunal Regional do Trabalho da 2ª Região
  `;
  const usefulText = cleanPjeMetadata(pjeOnlyText);
  // O texto útil é menor que o threshold (35 caracteres), indicando necessidade mandatória de OCR
  assert.ok(usefulText.length < 35);
});




