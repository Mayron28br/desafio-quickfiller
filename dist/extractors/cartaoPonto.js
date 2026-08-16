/**
 * Normaliza uma string de horário para o padrão HH:MM em 24h.
 * Preserva o caractere '?' em posições ilegíveis.
 */
export function normalizeTime(raw) {
    if (!raw)
        return '';
    const trimmed = raw.trim();
    // Caso contenha '?'
    if (trimmed.includes('?')) {
        return trimmed.replace(/[hH\.]/g, ':');
    }
    // Padrões comuns: 08:25, 8:25, 08h25, 08.25, 0825
    const match = trimmed.match(/^([0-2]?\d)[:hH\.]?(\d{2})$/);
    if (match && match[1] && match[2]) {
        const hh = match[1].padStart(2, '0');
        const mm = match[2];
        const hourNum = parseInt(hh, 10);
        const minNum = parseInt(mm, 10);
        if (hourNum >= 0 && hourNum <= 23 && minNum >= 0 && minNum <= 59) {
            return `${hh}:${mm}`;
        }
    }
    return trimmed;
}
/**
 * Extrai batidas de horário de uma linha de texto.
 */
function extractPunchesFromLine(line, dateStr) {
    // Remove a data da linha para evitar falso positivo de horário
    const lineWithoutDate = line.replace(dateStr, '');
    // Expressão regular para horários: HH:MM, HHhMM, HH.MM ou caracteres com ?
    const timeRegex = /\b(?:[0-2]?[0-9]|\?{1,2})[:hH\.]?(?:[0-5][0-9]|\?{1,2})\b/g;
    const matches = lineWithoutDate.match(timeRegex) || [];
    const punches = [];
    let punchIndex = 0;
    for (const raw of matches) {
        // Filtra falsos positivos de números pequenos que não são horários (ex: '50%', '01')
        if (raw.length < 3 && !raw.includes(':') && !raw.includes('h'))
            continue;
        const kind = punchIndex % 2 === 0 ? 'IN' : 'OUT';
        const time_hhmm = normalizeTime(raw);
        punches.push({
            kind,
            time_raw: raw,
            time_hhmm,
        });
        punchIndex++;
    }
    return punches;
}
/**
 * Parser principal de Cartão de Ponto.
 * Processa página a página mantendo a ordem exata do documento.
 */
export function parseCartaoPonto(document) {
    const resultPages = [];
    // Padrão para localizar data no início ou meio da linha (DD/MM/YYYY, DD/MM/YY, DD/MM ou DD com dia da semana)
    const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)\b/;
    for (const page of document.pages) {
        const lines = page.text.split('\n').map(l => l.trim()).filter(Boolean);
        const days = [];
        for (const line of lines) {
            const dateMatch = line.match(dateRegex);
            if (dateMatch && dateMatch[1]) {
                const date_raw = dateMatch[1];
                const punches = extractPunchesFromLine(line, date_raw);
                days.push({
                    date_raw,
                    punches,
                });
            }
        }
        resultPages.push({
            page: page.pageNumber,
            days,
        });
    }
    return { pages: resultPages };
}
