import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../services/store.js';
import { extractDocumentText } from '../services/ocr.js';
import { parseCartaoPonto } from '../extractors/cartaoPonto.js';
import { parseHolerite } from '../extractors/holerite.js';
import { generateSpreadsheet } from '../services/spreadsheet.js';
import { isValidPdf, logError, logInfo, MAX_FILE_SIZE_BYTES } from '../utils/security.js';
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES }
});
export const router = Router();
function getParamId(req) {
    const raw = req.params['id'];
    if (Array.isArray(raw))
        return raw[0] || '';
    return raw || '';
}
/**
 * Identifica automaticamente se o documento é Cartão de Ponto ou Holerite a partir do texto extraído.
 */
export function detectDocumentType(extractedDoc) {
    let holeriteScore = 0;
    let cartaoScore = 0;
    const fullText = extractedDoc.pages.map(p => p.text).join('\n').toLowerCase();
    const holeriteKeywords = [
        'holerite', 'recibo de pagamento', 'demonstrativo de pagamento', 'folha de pagamento',
        'declaração remuneração', 'declaracao remuneracao', 'rendimentos', 'vencimento padrao',
        'salário base', 'salario base', 'proventos', 'descontos', 'valor líquido', 'valor liquido',
        'líquido a receber', 'liquido a receber', 'base inss', 'base fgts', 'base irrf',
        'sal. contrib. inss', 'proventos bruto', 'proventos líquidos', 'provisão fgts', 'verba nome'
    ];
    const cartaoKeywords = [
        'cartão de ponto', 'cartao de ponto', 'folha de ponto', 'espelho de ponto',
        'ponto eletrônico', 'ponto eletronico', 'relatório mensal', 'relatorio mensal',
        'folha de frequencia', 'folha de frequência', 'sipon', 'poel', 'quinzena',
        'entrada', 'saida', 'saída', 'intervalo', 'batida', 'horas extras',
        'banco de horas', 'jornada', 'operador de escavadeira', 'sem registro de ponto',
        'descanso semanal'
    ];
    for (const kw of holeriteKeywords) {
        if (fullText.includes(kw)) {
            holeriteScore += 3;
        }
    }
    for (const kw of cartaoKeywords) {
        if (fullText.includes(kw)) {
            cartaoScore += 3;
        }
    }
    const timeMatches = fullText.match(/\b[0-2]?\d:[0-5]\d\b/g) || [];
    const moneyMatches = fullText.match(/-?\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g) || [];
    if (timeMatches.length > moneyMatches.length * 2) {
        cartaoScore += 5;
    }
    if (moneyMatches.length > timeMatches.length * 2) {
        holeriteScore += 5;
    }
    return holeriteScore > cartaoScore ? 'holerite' : 'cartao-ponto';
}
/**
 * Worker assíncrono para processar o PDF em background.
 */
async function processTranscriptionBackground(id, requestedTipo, pdfBuffer) {
    try {
        logInfo('Worker:Start', { id, requestedTipo });
        const extractedDoc = await extractDocumentText(pdfBuffer);
        const tipo = (requestedTipo === 'cartao-ponto' || requestedTipo === 'holerite')
            ? requestedTipo
            : detectDocumentType(extractedDoc);
        logInfo('Worker:DetectedType', { id, tipo });
        let parsedValue;
        if (tipo === 'cartao-ponto') {
            parsedValue = parseCartaoPonto(extractedDoc);
        }
        else {
            parsedValue = parseHolerite(extractedDoc);
        }
        store.updateJobStatus(id, 'concluido', parsedValue, null, tipo);
        logInfo('Worker:Complete', { id, tipo, pagesCount: parsedValue.pages.length });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro interno durante a extração do documento.';
        logError(`Worker:Error_${id}`, err);
        store.updateJobStatus(id, 'erro', null, errorMsg);
    }
}
/**
 * POST /api/transcricoes
 * Envio de PDF para transcrição assíncrona (com auto-detecção de tipo de documento).
 */
router.post('/transcricoes', upload.single('arquivo'), (req, res) => {
    try {
        const tipo = req.body.tipo;
        if (tipo && tipo !== 'cartao-ponto' && tipo !== 'holerite' && tipo !== 'auto') {
            res.status(400).json({ erro: 'Campo "tipo" deve ser "cartao-ponto", "holerite" ou "auto".' });
            return;
        }
        if (!req.file || !req.file.buffer) {
            res.status(400).json({ erro: 'Arquivo PDF não fornecido no campo "arquivo".' });
            return;
        }
        if (!isValidPdf(req.file.buffer)) {
            res.status(400).json({ erro: 'O arquivo enviado não é um PDF válido.' });
            return;
        }
        const id = uuidv4().substring(0, 8);
        const initialTipo = (tipo === 'cartao-ponto' || tipo === 'holerite') ? tipo : 'cartao-ponto';
        store.createJob(id, initialTipo, req.file.buffer, req.file.originalname);
        // Dispara processamento em background (não bloqueia a resposta HTTP)
        setImmediate(() => {
            processTranscriptionBackground(id, tipo, req.file.buffer);
        });
        res.status(202).json({ id });
    }
    catch (err) {
        logError('POST /api/transcricoes', err);
        res.status(500).json({ erro: 'Erro interno ao iniciar processamento.' });
    }
});
/**
 * GET /api/transcricoes/:id
 * Consulta status e resultado da transcrição.
 */
router.get('/transcricoes/:id', (req, res) => {
    const id = getParamId(req);
    const job = store.getJob(id);
    if (!job) {
        res.status(404).json({ erro: 'Transcrição não encontrada.' });
        return;
    }
    res.status(200).json({
        id: job.id,
        tipo: job.tipo,
        status: job.status,
        erro: job.erro,
        value: job.value
    });
});
/**
 * PUT /api/transcricoes/:id
 * Atualiza os dados com as correções feitas na interface de revisão.
 */
router.put('/transcricoes/:id', (req, res) => {
    const id = getParamId(req);
    const { value } = req.body;
    if (!value || typeof value !== 'object') {
        res.status(400).json({ erro: 'Corpo da requisição deve conter o campo "value".' });
        return;
    }
    const updated = store.updateJobValue(id, value);
    if (!updated) {
        res.status(404).json({ erro: 'Transcrição não encontrada.' });
        return;
    }
    const job = store.getJob(id);
    res.status(200).json({
        id: job.id,
        tipo: job.tipo,
        status: job.status,
        erro: job.erro,
        value: job.value
    });
});
/**
 * GET /api/transcricoes/:id/planilha
 * Download da planilha corrigida nos formatos xlsx, csv ou json.
 */
router.get('/transcricoes/:id/planilha', async (req, res) => {
    try {
        const id = getParamId(req);
        const formatoQuery = (req.query.formato || 'xlsx').toLowerCase();
        const formato = (formatoQuery === 'csv' || formatoQuery === 'json') ? formatoQuery : 'xlsx';
        const job = store.getJob(id);
        if (!job) {
            res.status(404).json({ erro: 'Transcrição não encontrada.' });
            return;
        }
        if (job.status !== 'concluido' || !job.value) {
            res.status(400).json({ erro: 'A transcrição ainda não foi concluída com sucesso.' });
            return;
        }
        const { buffer, contentType, filename } = await generateSpreadsheet(job.tipo, job.value, formato);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (err) {
        logError('GET /api/transcricoes/:id/planilha', err);
        res.status(500).json({ erro: 'Erro ao gerar planilha.' });
    }
});
/**
 * GET /api/transcricoes/:id/pdf
 * Visualização do PDF original enviado para preview lado a lado.
 */
router.get('/transcricoes/:id/pdf', (req, res) => {
    const id = getParamId(req);
    const job = store.getJob(id);
    if (!job || !job.pdfBuffer) {
        res.status(404).json({ erro: 'PDF não encontrado.' });
        return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${job.pdfFilename || 'documento.pdf'}"`);
    res.send(job.pdfBuffer);
});
