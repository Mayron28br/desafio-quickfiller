import PDFDocument from 'pdfkit';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return;
  fs.mkdirSync(dirname, { recursive: true });
}

// 1. Digital: cartao-ponto-1.pdf
function generateCartaoPonto1(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDirectoryExistence(outputPath);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(16).font('Helvetica-Bold').text('ESPELHO DE PONTO ELETRÔNICO', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('EMPRESA: TECNOLOGIA E SERVICOS LTDA — CNPJ: 00.000.000/0001-00', { align: 'center' });
    doc.text('FUNCIONÁRIO: COLABORADOR EXEMPLO — MATRÍCULA: 10452', { align: 'center' });
    doc.text('PERÍODO: 01/05/2026 A 31/05/2026', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('DATA         DIA   ENTRADA 1  SAÍDA 1   ENTRADA 2  SAÍDA 2   TOTAL');
    doc.font('Helvetica').fontSize(9);
    doc.text('--------------------------------------------------------------------------------');

    const lines = [
      '01/05/2026   SEX   FERIADO NACIONAL',
      '02/05/2026   SAB   FOLGA / DSR',
      '03/05/2026   DOM   FOLGA / DSR',
      '04/05/2026   SEG   08:00      12:00     13:00      17:00     08:00',
      '05/05/2026   TER   08:05      12:02     13:00      17:15     08:12',
      '06/05/2026   QUA   07:58      12:00     13:05      17:00     08:03',
      '07/05/2026   QUI   08:00      12:00     13:00      17:00     08:00',
      '08/05/2026   SEX   08:10      12:00     13:00      16:50     07:40',
      '09/05/2026   SAB   FOLGA / DSR',
      '10/05/2026   DOM   FOLGA / DSR',
      '11/05/2026   SEG   08:00      12:00     13:00      17:00     08:00',
      '12/05/2026   TER   08:00      12:00     13:00                04:00 (ESQUECIMENTO DE SAIDA)',
      '13/05/2026   QUA   08:00      12:00     13:00      17:00     08:00',
      '14/05/2026   QUI   08:15      12:00     13:00      17:30     08:15',
      '15/05/2026   SEX   08:00      12:00     13:00      17:00     08:00',
      '16/05/2026   SAB   FOLGA / DSR',
      '17/05/2026   DOM   FOLGA / DSR',
      '18/05/2026   SEG   08:00      12:00     13:00      17:00     08:00',
      '22/05/2026   SEX   08:00      12:00     13:00      17:00     08:00',
      '23/05/2026   SAB   FOLGA / DSR',
      '24/05/2026   DOM   FOLGA / DSR',
      '25/05/2026   SEG   08:00      12:00     13:00      17:00     08:00',
      '26/05/2026   TER   08:00      12:00     13:00      17:00     08:00',
      '27/05/2026   QUA   08:00      12:00     13:00      17:00     08:00',
      '28/05/2026   QUI   08:00      12:00     13:00      17:00     08:00',
      '29/05/2026   SEX   08:00      12:00     13:00      17:00     08:00',
      '30/05/2026   SAB   FOLGA / DSR',
      '31/05/2026   DOM   FOLGA / DSR'
    ];

    for (const line of lines) {
      doc.text(line);
    }

    doc.moveDown(1.5);
    doc.fontSize(8).text('Assinatura do Empregado: _____________________________________   Data: 31/05/2026');

    doc.end();
    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
}

// 2. Digital: holerite-1.pdf
function generateHolerite1(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDirectoryExistence(outputPath);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(14).font('Helvetica-Bold').text('DEMONSTRATIVO DE PAGAMENTO DE SALÁRIO', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('EMPRESA COMÉRCIO VAREJISTA LTDA — CNPJ: 12.345.678/0001-90', { align: 'center' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('CÓDIGO: 0045   NOME: MARIA SILVA   CARGO: ANALISTA DE SISTEMAS   COMPETÊNCIA: 01/2026');
    doc.moveDown(1);

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('CÓD  DESCRIÇÃO                        REFERÊNCIA    VENCIMENTOS      DESCONTOS');
    doc.font('Helvetica');
    doc.text('-------------------------------------------------------------------------------------------------------------');

    doc.text('0010 Salário Base                         220,00       3.500,00');
    doc.text('5560 Horas Extras - 50%                     12,50         397,73');
    doc.text('5580 Adicional Noturno                      20,00         159,09');
    doc.text('0998 INSS                                   14,00                           435,28');
    doc.text('0999 Imposto de Renda Retido                7,50                           112,45');
    doc.text('0450 Vale Transporte                        6,00                           210,00');

    doc.moveDown(2);
    doc.font('Helvetica-Bold').text('BASES DE CÁLCULO E TOTAIS');
    doc.text('-------------------------------------------------------------------------------------------------------------');
    doc.font('Helvetica');
    doc.text('Salário Base: 3.500,00      Base INSS: 4.056,82      Base IRRF: 3.621,54      Base FGTS: 4.056,82');
    doc.text('FGTS do Mês: 324,55         Total Vencimentos: 4.056,82      Total Descontos: 757,73');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).text('VALOR LÍQUIDO: 3.299,09', { align: 'right' });

    doc.end();
    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
}

// 3. Escaneado: cartao-ponto-escaneado.pdf (Imagem Pura sem texto)
function generateCartaoPontoEscaneado(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDirectoryExistence(outputPath);
    const width = 800;
    const height = 1100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fundo papel
    ctx.fillStyle = '#FDFDFD';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('FOLHA DE PONTO INDIVIDUAL (DOCUMENTO ESCANEADO)', 50, 60);

    ctx.font = '14px Arial';
    ctx.fillText('EMPRESA: DISTRIBUIDORA NACIONAL LTDA', 50, 95);
    ctx.fillText('COMPETÊNCIA: 05/2026', 50, 120);
    ctx.fillText('------------------------------------------------------------------', 50, 145);

    ctx.font = '14px Courier';
    const lines = [
      '01/05/2026  08:00  12:00  13:00  17:00',
      '02/05/2026  08:05  12:00  13:00  17:15',
      '03/05/2026  08:00  12:00  13:00  17:00',
      '04/05/2026  07:55  12:00  13:00  17:00',
      '05/05/2026  08:00  12:00  13:00  17:00',
      '06/05/2026  08:00  12:00  13:00  17:00',
      '07/05/2026  08:10  12:00  13:00  17:00'
    ];

    lines.forEach((l, idx) => {
      ctx.fillText(l, 50, 180 + idx * 30);
    });

    const pngBuffer = canvas.toBuffer('image/png');

    const doc = new PDFDocument({ margin: 0, size: [width, height] });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);
    doc.image(pngBuffer, 0, 0, { width, height });
    doc.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
}

// 4. Escaneado: holerite-escaneado.pdf (Imagem Pura sem texto)
function generateHoleriteEscaneado(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureDirectoryExistence(outputPath);
    const width = 800;
    const height = 1100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FCFCFC';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('RECIBO DE PAGAMENTO (ESCANEADO)', 50, 60);

    ctx.font = '14px Arial';
    ctx.fillText('COMPETENCIA: 03/2026', 50, 95);
    ctx.fillText('------------------------------------------------------------------', 50, 120);

    ctx.font = '14px Courier';
    ctx.fillText('0010 Salário Base 220,00 3.200,00', 50, 160);
    ctx.fillText('0998 INSS 352,00', 50, 195);
    ctx.fillText('0450 Vale Transporte 192,00', 50, 230);

    ctx.fillText('------------------------------------------------------------------', 50, 280);
    ctx.fillText('Base INSS: 3.200,00', 50, 320);
    ctx.fillText('Total Vencimentos: 3.200,00', 50, 355);
    ctx.fillText('Valor Líquido: 2.656,00', 50, 390);

    const pngBuffer = canvas.toBuffer('image/png');

    const doc = new PDFDocument({ margin: 0, size: [width, height] });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);
    doc.image(pngBuffer, 0, 0, { width, height });
    doc.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);
  });
}

async function main() {
  const dir = path.resolve(process.cwd(), 'exemplos');
  await generateCartaoPonto1(path.join(dir, 'cartao-ponto-1.pdf'));
  await generateHolerite1(path.join(dir, 'holerite-1.pdf'));
  await generateCartaoPontoEscaneado(path.join(dir, 'cartao-ponto-escaneado.pdf'));
  await generateHoleriteEscaneado(path.join(dir, 'holerite-escaneado.pdf'));
  console.log('✅ Exemplos digitais e escaneados gerados com sucesso!');
}

main();
