import { createCanvas } from '@napi-rs/canvas';
import { getDocumentProxy } from 'unpdf';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import PDFDocument from 'pdfkit';

// 1. Criar um PDF escaneado (desenhar no canvas -> exportar como imagem PNG -> embutir no PDF)
async function createScannedPdf(outputPath: string): Promise<Buffer> {
  const width = 800;
  const height = 1100;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fundo branco com leve textura de papel escaneado
  ctx.fillStyle = '#FAFAFA';
  ctx.fillRect(0, 0, width, height);

  // Texto impresso
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('ESPELHO DE PONTO - ESCANEADO', 50, 60);

  ctx.font = '16px Arial';
  ctx.fillText('EMPRESA: COMERCIO E SERVICOS S/A', 50, 100);
  ctx.fillText('COMPETENCIA: 05/2026', 50, 130);
  ctx.fillText('------------------------------------------------------------', 50, 160);

  ctx.font = '15px Courier';
  ctx.fillText('01/05/2026  08:00  12:00  13:00  17:00', 50, 200);
  ctx.fillText('02/05/2026  08:05  12:00  13:00  17:02', 50, 230);
  ctx.fillText('03/05/2026  07:58  12:00  13:00  17:00', 50, 260);
  ctx.fillText('04/05/2026  08:00  12:00  13:00  17:00', 50, 290);
  ctx.fillText('05/05/2026  08:00  12:00  13:00  17:00', 50, 320);

  const pngBuffer = canvas.toBuffer('image/png');

  // Embute o PNG dentro de um PDF sem camada de texto
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: [width, height] });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuf = Buffer.concat(chunks);
      fs.writeFileSync(outputPath, pdfBuf);
      resolve(pdfBuf);
    });
    doc.on('error', reject);

    doc.image(pngBuffer, 0, 0, { width, height });
    doc.end();
  });
}

// 2. Testar renderização do PDF para canvas e OCR
async function testOcr(pdfBuffer: Buffer) {
  console.log('PDF gerado. Tamanho:', pdfBuffer.length, 'bytes');

  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  console.log('Total páginas do PDF:', pdf.numPages);

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  await page.render({
    canvasContext: ctx as any,
    viewport: viewport
  }).promise;

  const imageBuffer = canvas.toBuffer('image/png');
  console.log('Página rasterizada para imagem PNG:', imageBuffer.length, 'bytes');

  console.log('Iniciando Tesseract OCR...');
  const worker = await createWorker('por');
  const ret = await worker.recognize(imageBuffer);
  console.log('Texto reconhecido pelo OCR:\n', ret.data.text);
  await worker.terminate();
}

async function main() {
  const pdfBuf = await createScannedPdf('exemplos/cartao-ponto-escaneado.pdf');
  await testOcr(pdfBuf);
}

main().catch(console.error);
