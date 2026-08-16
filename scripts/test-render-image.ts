import { renderPageAsImage } from 'unpdf';
import { createWorker } from 'tesseract.js';
import fs from 'fs';

async function test() {
  const pdfBuffer = fs.readFileSync('exemplos/cartao-ponto-escaneado.pdf');
  console.log('Testando renderPageAsImage com canvasImport...');

  const imageBuffer = await renderPageAsImage(new Uint8Array(pdfBuffer), 1, {
    canvasImport: () => import('@napi-rs/canvas'),
    scale: 2.0
  });

  console.log('Imagem PNG renderizada:', imageBuffer.byteLength, 'bytes');

  console.log('Executando OCR com Tesseract...');
  const worker = await createWorker('por');
  const ret = await worker.recognize(Buffer.from(imageBuffer));
  console.log('\n--- TEXTO EXTRAÍDO VIA OCR ---\n');
  console.log(ret.data.text);
  await worker.terminate();
}

test().catch(console.error);
