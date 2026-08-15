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
 * Extrai o texto de um documento PDF página por página.
 * Caso uma página não possua camada de texto vetorial (< 20 caracteres legíveis),
 * rasteriza a página para imagem e aplica OCR (Tesseract) como fallback.
 */
export async function extractDocumentText(pdfBuffer: Buffer): Promise<ExtractedDocument> {
  const pages: ExtractedPage[] = [];

  try {
    const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer), { mergePages: false });
    const pageTexts = Array.isArray(text) ? text : [text];
    const total = totalPages || pageTexts.length || 1;

    for (let i = 0; i < total; i++) {
      const pageText = (pageTexts[i] || '').trim();
      const pageNumber = i + 1;

      // Se a página tem texto embutido suficiente (PDF Digital)
      if (pageText.length >= 20) {
        pages.push({
          pageNumber,
          text: pageText,
          isOcr: false
        });
      } else {
        // Página sem camada de texto (PDF Escaneado): rasterizar para imagem e rodar OCR
        logInfo('OCR:FallbackNeeded', { pageNumber });
        let ocrText = '';

        try {
          const imageArrayBuffer = await renderPageAsImage(new Uint8Array(pdfBuffer), pageNumber, {
            canvasImport: () => import('@napi-rs/canvas'),
            scale: 2.0
          });

          const worker = await createWorker('por');
          const ret = await worker.recognize(Buffer.from(imageArrayBuffer));
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
