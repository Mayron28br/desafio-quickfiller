import { extractText, renderPageAsImage } from 'unpdf';
import { createWorker } from 'tesseract.js';
import { logInfo, logError } from '../utils/security.js';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  isOcr: boolean;
}

export interface ExtractedDocument {
  totalPages: number;
  pages: ExtractedPage[];
}

/**
 * Remove cabeçalhos e rodapés de assinatura eletrônica do PJe para avaliar se há conteúdo real na página.
 */
export function cleanPjeMetadata(text: string): string {
  return text
    .replace(/Assinado eletronicamente por:.*$/gmi, '')
    .replace(/Documento assinado eletronicamente por:?.*$/gmi, '')
    .replace(/Juntado em:.*$/gmi, '')
    .replace(/ID\.\s+[a-f0-9]+.*$/gmi, '')
    .replace(/Fls\.?:?\s*\d+/gmi, '')
    .replace(/Número do processo:.*$/gmi, '')
    .replace(/Número do documento:.*$/gmi, '')
    .replace(/Tribunal Regional do Trabalho.*$/gmi, '')
    .trim();
}

/**
 * Calcula o limiar de Otsu para binarização adaptativa de imagem de documento.
 */
function calculateOtsuThreshold(grayData: Uint8Array): number {
  const histogram = new Array(256).fill(0);
  const total = grayData.length;

  for (let i = 0; i < total; i++) {
    histogram[grayData[i]!]!++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) {
    sum += t * histogram[t]!;
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 140; // Fallback padrão

  for (let t = 0; t < 256; t++) {
    wB += histogram[t]!;
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  return Math.max(100, Math.min(threshold, 200));
}

/**
 * Aplica pré-processamento adaptativo de imagem (luminância Rec. 601 e binarização de Otsu)
 * para eliminar ruídos de digitalização, sombras de fotocópias e maximizar a acurácia do OCR.
 */
export async function preprocessImageForOcr(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imgData.data;
    const totalPixels = image.width * image.height;
    const grayData = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const gray = Math.round(0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!);
      grayData[i] = gray;
    }

    const threshold = calculateOtsuThreshold(grayData);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const val = grayData[i]! < threshold ? 0 : 255;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer('image/png');
  } catch (err) {
    logError('PreprocessImage:Failed', err);
    return imageBuffer;
  }
}

/**
 * Extrai o texto de um documento PDF página por página.
 * Caso uma página não possua camada de texto vetorial útil (< 35 caracteres após remoção de metadados do PJe),
 * rasteriza a página para imagem, aplica pré-processamento de binarização adaptativa e OCR (Tesseract).
 */
export async function extractDocumentText(pdfBuffer: Buffer): Promise<ExtractedDocument> {
  const pages: ExtractedPage[] = [];

  try {
    const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer), { mergePages: false });
    const pageTexts = Array.isArray(text) ? text : [text];
    const total = totalPages || pageTexts.length || 1;

    for (let i = 0; i < total; i++) {
      const pageText = (pageTexts[i] || '').trim();
      const usefulText = cleanPjeMetadata(pageText);
      const pageNumber = i + 1;

      // Se a página tem texto embutido útil suficiente (PDF Digital com tabela real)
      if (usefulText.length >= 35) {
        pages.push({
          pageNumber,
          text: pageText,
          isOcr: false
        });
      } else {
        // Página sem camada de texto útil (PDF Escaneado ou imagem com apenas carimbo PJe): rodar OCR
        logInfo('OCR:FallbackNeeded', { pageNumber, usefulLength: usefulText.length });
        let ocrText = '';

        try {
          const imageArrayBuffer = await renderPageAsImage(new Uint8Array(pdfBuffer), pageNumber, {
            canvasImport: () => import('@napi-rs/canvas'),
            scale: 2.5
          });

          // Pré-processamento adaptativo de imagem antes do reconhecimento óptico
          const rawBuffer = Buffer.from(imageArrayBuffer);
          const enhancedBuffer = await preprocessImageForOcr(rawBuffer);

          const worker = await createWorker('por');
          const ret = await worker.recognize(enhancedBuffer);
          ocrText = ret.data.text || '';
          await worker.terminate();
          logInfo('OCR:Success', { pageNumber, textLength: ocrText.length });
        } catch (ocrErr) {
          logError(`OCR:FailedForPage_${pageNumber}`, ocrErr);
        }

        pages.push({
          pageNumber,
          text: ocrText || pageText,
          isOcr: true
        });
      }
    }

    return { totalPages: total, pages };
  } catch (err) {
    logError('ExtractDocumentText:Error', err);
    throw new Error('Falha ao processar o arquivo PDF. Verifique se o arquivo está corrompido.');
  }
}
