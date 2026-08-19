import { getDocumentProxy, renderPageAsImage } from 'unpdf';
import { createWorker } from 'tesseract.js';
import { logInfo, logError } from '../utils/security.js';

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  isOcr: boolean;
  words?: OcrWord[];
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
 * Extrai preferencialmente a camada de texto selecionável do próprio PDF com posicionamento vetorial.
 * Caso a página não possua texto útil (< 15 caracteres úteis), aplica rasterização e OCR (Tesseract).
 */
export async function extractDocumentText(pdfBuffer: Buffer): Promise<ExtractedDocument> {
  const pages: ExtractedPage[] = [];

  try {
    const doc = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const total = doc.numPages || 1;

    for (let i = 1; i <= total; i++) {
      const pageNumber = i;
      let vectorText = '';
      const vectorWords: OcrWord[] = [];

      try {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        if (textContent.items && textContent.items.length > 0) {
          const items = (textContent.items as any[]).map(item => {
            const tx = item.transform[4] || 0;
            const ty = viewport.height - (item.transform[5] || 0);
            const w = item.width || 0;
            const h = item.height || Math.abs(item.transform[0]) || 10;
            return {
              text: item.str || '',
              x: tx,
              y: ty,
              w,
              h,
              bbox: { x0: tx, y0: ty - h, x1: tx + w, y1: ty }
            };
          }).filter(it => it.text.trim().length > 0);

          if (items.length > 0) {
            const lineTolerance = 4;
            const lines: typeof items[] = [];
            items.sort((a, b) => a.y - b.y || a.x - b.x);

            for (const it of items) {
              let placed = false;
              for (const line of lines) {
                const avgY = line.reduce((s, x) => s + x.y, 0) / line.length;
                if (Math.abs(it.y - avgY) <= lineTolerance) {
                  line.push(it);
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                lines.push([it]);
              }
            }

            const textLines: string[] = [];
            for (const line of lines) {
              line.sort((a, b) => a.x - b.x);
              textLines.push(line.map(x => x.text).join(' '));
              for (const it of line) {
                vectorWords.push({
                  text: it.text,
                  bbox: it.bbox,
                  confidence: 100
                });
              }
            }

            vectorText = textLines.join('\n').trim();
          }
        }
      } catch (vecErr) {
        logError(`VectorExtract:FailedPage_${pageNumber}`, vecErr);
      }

      const usefulText = cleanPjeMetadata(vectorText);

      // Se a página tem texto vetorial selecionável real
      if (usefulText.length >= 15) {
        logInfo('VectorText:Found', { pageNumber, length: vectorText.length, wordsCount: vectorWords.length });
        pages.push({
          pageNumber,
          text: vectorText,
          isOcr: false,
          words: vectorWords
        });
      } else {
        // Página escaneada / imagem pura sem texto selecionável: OCR
        logInfo('OCR:FallbackNeeded', { pageNumber, usefulLength: usefulText.length });
        let ocrText = '';
        let ocrWords: OcrWord[] = [];

        try {
          const imageArrayBuffer = await renderPageAsImage(new Uint8Array(pdfBuffer), pageNumber, {
            canvasImport: () => import('@napi-rs/canvas'),
            scale: 2.5
          });

          const rawBuffer = Buffer.from(imageArrayBuffer);
          const enhancedBuffer = await preprocessImageForOcr(rawBuffer);

          const worker = await createWorker('por');
          const ret = await worker.recognize(enhancedBuffer);
          ocrText = ret.data.text || '';
          ocrWords = (ret.data.words || []).map(w => ({
            text: w.text,
            bbox: {
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1
            },
            confidence: w.confidence
          }));
          await worker.terminate();
          logInfo('OCR:Success', { pageNumber, textLength: ocrText.length, wordsCount: ocrWords.length });
        } catch (ocrErr) {
          logError(`OCR:FailedForPage_${pageNumber}`, ocrErr);
        }

        pages.push({
          pageNumber,
          text: ocrText || vectorText,
          isOcr: true,
          words: ocrWords.length > 0 ? ocrWords : undefined
        });
      }
    }

    return { totalPages: total, pages };
  } catch (err) {
    logError('ExtractDocumentText:Error', err);
    throw new Error('Falha ao processar o arquivo PDF. Verifique se o arquivo está corrompido.');
  }
}
