import ExcelJS from 'exceljs';
import { CartaoPontoTranscription, DocumentType, HoleriteTranscription, TranscriptionValue } from '../types/index.js';
import { calculateCartaoPontoAlerts, calculateHoleriteAlerts } from './alerts.js';

const HEADER_BG_COLOR = 'FF173772';
const HEADER_FONT_COLOR = 'FFFFFFFF';
const YELLOW_FILL_COLOR = 'FFFFF3CD';
const RED_FILL_COLOR = 'FFF8D7DA';
const RED_BORDER_COLOR = 'FFDC3545';

/**
 * Aplica estilos padrão ao cabeçalho da planilha.
 */
function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG_COLOR }
    };
    cell.font = {
      bold: true,
      color: { argb: HEADER_FONT_COLOR },
      size: 11
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 24;
}

/**
 * Gera o workbook do Excel para Cartão de Ponto.
 */
function buildCartaoPontoWorkbook(transcription: CartaoPontoTranscription): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cartão de Ponto');

  // Determina o número máximo de batidas em qualquer dia
  let maxPunches = 0;
  for (const p of transcription.pages) {
    for (const d of p.days) {
      if (d.punches.length > maxPunches) {
        maxPunches = d.punches.length;
      }
    }
  }

  // Garante ao menos 3 pares (6 colunas: Manhã, Tarde, Extra) e arredonda para pares
  const numPairs = Math.max(3, Math.ceil(maxPunches / 2));

  // Define as colunas
  const columns: { header: string; key: string; width: number }[] = [
    { header: 'Data', key: 'data', width: 14 }
  ];

  for (let i = 1; i <= numPairs; i++) {
    const inHeader = i === 3 ? 'Entrada Extra' : `Entrada ${i}`;
    const outHeader = i === 3 ? 'Saída Extra' : `Saída ${i}`;
    columns.push({ header: inHeader, key: `in_${i}`, width: 13 });
    columns.push({ header: outHeader, key: `out_${i}`, width: 13 });
  }

  worksheet.columns = columns;
  styleHeaderRow(worksheet.getRow(1));

  const alerts = calculateCartaoPontoAlerts(transcription.pages);

  // Adiciona as linhas
  for (const page of transcription.pages) {
    for (let dayIdx = 0; dayIdx < page.days.length; dayIdx++) {
      const day = page.days[dayIdx]!;
      const rowData: Record<string, string> = {
        data: day.date_raw
      };

      for (let i = 0; i < day.punches.length; i++) {
        const punch = day.punches[i]!;
        const pairIndex = Math.floor(i / 2) + 1;
        const key = punch.kind === 'IN' ? `in_${pairIndex}` : `out_${pairIndex}`;
        rowData[key] = punch.time_hhmm || punch.time_raw;
      }

      const row = worksheet.addRow(rowData);
      row.height = 20;

      // Aplica destaques de linha
      const alertKey = `${page.page}-${dayIdx}`;
      const alert = alerts.get(alertKey);

      if (alert && alert.level) {
        const fillColor = alert.level === 'red' ? RED_FILL_COLOR : YELLOW_FILL_COLOR;
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillColor }
          };

          if (alert.level === 'red' && colNumber === 1) {
            cell.border = {
              left: { style: 'medium', color: { argb: RED_BORDER_COLOR } }
            };
          }
        });
      }
    }
  }

  return workbook;
}

/**
 * Gera o workbook do Excel para Holerite.
 */
function buildHoleriteWorkbook(transcription: HoleriteTranscription): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Holerites');

  // Coleta a união de todas as verbas (labels) na ordem de primeira aparição
  const distinctLabels: string[] = [];
  for (const page of transcription.pages) {
    for (const field of page.fields) {
      if (field.label && !distinctLabels.includes(field.label)) {
        distinctLabels.push(field.label);
      }
    }
  }

  // Define colunas fixas + colunas de verbas
  const columns: { header: string; key: string; width: number }[] = [
    { header: 'Pág.', key: 'page', width: 8 },
    { header: 'Mês', key: 'month', width: 8 },
    { header: 'Ano', key: 'year', width: 10 }
  ];

  distinctLabels.forEach((label, idx) => {
    columns.push({
      header: label,
      key: `field_${idx}`,
      width: Math.max(14, label.length + 3)
    });
  });

  worksheet.columns = columns;
  styleHeaderRow(worksheet.getRow(1));

  const alerts = calculateHoleriteAlerts(transcription.pages);

  // Adiciona uma linha por página
  for (const page of transcription.pages) {
    const rowData: Record<string, string | number> = {
      page: page.page,
      month: page.month,
      year: page.year
    };

    distinctLabels.forEach((label, idx) => {
      const found = page.fields.find(f => f.label.toLowerCase() === label.toLowerCase());
      rowData[`field_${idx}`] = found ? found.value : '';
    });

    const row = worksheet.addRow(rowData);
    row.height = 20;

    const alert = alerts.get(page.page);
    if (alert && alert.level) {
      const fillColor = alert.level === 'red' ? RED_FILL_COLOR : YELLOW_FILL_COLOR;
      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        };

        if (alert.level === 'red' && colNumber === 1) {
          cell.border = {
            left: { style: 'medium', color: { argb: RED_BORDER_COLOR } }
          };
        }
      });
    }
  }

  return workbook;
}

/**
 * Converte a transcrição em string CSV.
 */
function buildCsv(tipo: DocumentType, value: TranscriptionValue): string {
  if (tipo === 'cartao-ponto') {
    const cp = value as CartaoPontoTranscription;
    let maxPunches = 0;
    for (const p of cp.pages) {
      for (const d of p.days) {
        if (d.punches.length > maxPunches) maxPunches = d.punches.length;
      }
    }
    const numPairs = Math.max(3, Math.ceil(maxPunches / 2));
    const headers = ['Data'];
    for (let i = 1; i <= numPairs; i++) {
      const inHeader = i === 3 ? 'Entrada Extra' : `Entrada ${i}`;
      const outHeader = i === 3 ? 'Saída Extra' : `Saída ${i}`;
      headers.push(inHeader, outHeader);
    }

    const lines = [headers.join(';')];
    for (const page of cp.pages) {
      for (const day of page.days) {
        const row = [day.date_raw];
        for (let i = 0; i < numPairs * 2; i++) {
          const punch = day.punches[i];
          row.push(punch ? (punch.time_hhmm || punch.time_raw) : '');
        }
        lines.push(row.join(';'));
      }
    }
    return lines.join('\n');
  } else {
    const hol = value as HoleriteTranscription;
    const distinctLabels: string[] = [];
    for (const page of hol.pages) {
      for (const field of page.fields) {
        if (field.label && !distinctLabels.includes(field.label)) {
          distinctLabels.push(field.label);
        }
      }
    }

    const headers = ['Pág.', 'Mês', 'Ano', ...distinctLabels];
    const lines = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';')];

    for (const page of hol.pages) {
      const row = [String(page.page), page.month, page.year];
      for (const label of distinctLabels) {
        const found = page.fields.find(f => f.label.toLowerCase() === label.toLowerCase());
        row.push(found ? `"${found.value}"` : '""');
      }
      lines.push(row.join(';'));
    }
    return lines.join('\n');
  }
}

/**
 * Gera e retorna a planilha no formato solicitado (.xlsx, .csv, .json).
 */
export async function generateSpreadsheet(
  tipo: DocumentType,
  value: TranscriptionValue,
  formato: 'xlsx' | 'csv' | 'json'
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  if (formato === 'json') {
    return {
      buffer: Buffer.from(JSON.stringify(value, null, 2), 'utf-8'),
      contentType: 'application/json',
      filename: `${tipo}.json`
    };
  }

  if (formato === 'csv') {
    const csvContent = buildCsv(tipo, value);
    return {
      buffer: Buffer.from('\uFEFF' + csvContent, 'utf-8'), // BOM para compatibilidade com Excel
      contentType: 'text/csv; charset=utf-8',
      filename: `${tipo}.csv`
    };
  }

  // Padrão: xlsx
  const workbook = tipo === 'cartao-ponto'
    ? buildCartaoPontoWorkbook(value as CartaoPontoTranscription)
    : buildHoleriteWorkbook(value as HoleriteTranscription);

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${tipo}.xlsx`
  };
}
