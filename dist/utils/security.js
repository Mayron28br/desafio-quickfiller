/**
 * Utilitários de segurança, validação de arquivos e anonimização de logs.
 */
const PDF_MAGIC_BYTES = Buffer.from('%PDF-');
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
/**
 * Valida se um buffer possui os magic bytes característicos de um arquivo PDF válido.
 */
export function isValidPdf(buffer) {
    if (!buffer || buffer.length < 5)
        return false;
    // O cabeçalho %PDF- deve estar nos primeiros 1024 bytes
    const header = buffer.subarray(0, Math.min(buffer.length, 1024));
    return header.includes(PDF_MAGIC_BYTES);
}
/**
 * Sanitiza mensagens de log para garantir que informações pessoalmente identificáveis (PII)
 * como CPFs, nomes, salários ou matrículas não sejam gravadas em arquivos de log ou console.
 */
export function sanitizeLog(message) {
    if (!message)
        return '';
    // Mascara padrões de CPF (ex: 000.000.000-00 ou 11 dígitos)
    let sanitized = message.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***.***.***-**');
    // Mascara valores monetários detalhados em logs
    sanitized = sanitized.replace(/R\$\s?[\d.,]+/gi, 'R$ ***');
    return sanitized;
}
export function logInfo(context, data) {
    const safeData = JSON.stringify(data, (key, value) => {
        if (typeof value === 'string')
            return sanitizeLog(value);
        return value;
    });
    console.log(`[INFO] [${new Date().toISOString()}] [${context}] ${safeData}`);
}
export function logError(context, error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] [${new Date().toISOString()}] [${context}] ${sanitizeLog(message)}`);
}
