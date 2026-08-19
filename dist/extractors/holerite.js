const MONTH_NAMES_MAP = {
    'janeiro': '01', 'jan': '01',
    'fevereiro': '02', 'fev': '02',
    'março': '03', 'marco': '03', 'mar': '03',
    'abril': '04', 'abr': '04',
    'maio': '05', 'mai': '05',
    'junho': '06', 'jun': '06',
    'julho': '07', 'jul': '07',
    'agosto': '08', 'ago': '08',
    'setembro': '09', 'set': '09',
    'outubro': '10', 'out': '10',
    'novembro': '11', 'nov': '11',
    'dezembro': '12', 'dez': '12'
};
/**
 * Formata um rótulo de base para Title Case institucional preservando termos como INSS, FGTS, IRRF.
 */
function formatBaseLabel(text) {
    const clean = text.replace(/[\:\-\|]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = clean.split(' ');
    return words.map(w => {
        const upper = w.toUpperCase();
        if (upper === 'INSS' || upper === 'FGTS' || upper === 'IRRF' || upper === 'IR')
            return upper;
        if (upper === 'DE' || upper === 'DO' || upper === 'DA' || upper === 'DOS' || upper === 'DAS' || upper === 'A')
            return w.toLowerCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
}
const BASE_PATTERNS = [
    /total\s*(?:de\s*)?(?:proventos?|vencimentos?)/i,
    /total\s*(?:de\s*)?descontos?/i,
    /proventos?\s*brutos?/i,
    /proventos?\s*l[ií]quidos?/i,
    /(?:valor\s*)?l[ií]quido(?:\s*a\s*receber)?/i,
    /sal(?:[aá]rio)?\.?\s*contrib(?:ui[cç][aã]o)?\.?\s*inss/i,
    /base\s*(?:c[aá]lc(?:ulo)?\.?)?\s*inss/i,
    /base\s*(?:c[aá]lc(?:ulo)?\.?)?\s*irrf?/i,
    /base\s*(?:c[aá]lc(?:ulo)?\.?)?\s*fgts/i,
    /provis[aã]o\s*fgts/i,
    /fgts\s*(?:do\s*)?m[eê]s/i,
    /fgts\s*a\s*recolher/i,
    /adiantamento\s*13/i,
    /remunera[cç][aã]o\s*fun[cç][aã]o/i,
    /consigna[cç][aã]o/i,
    /proventos?\s*retidos?/i,
    /margem\s*\(\d+%\)/i,
    /^sal[aá]rio\s*base(?:\s*:|$)/i
];
/**
 * Verifica se um texto representa uma palavra-chave de base de cálculo / totalizador.
 */
function getBaseMatch(text, hasCode) {
    // Se tem código explícito de verba (ex: 0010, 058), é uma verba da tabela
    if (hasCode) {
        return { isBase: false, label: '' };
    }
    const clean = text.replace(/[\:\-\|]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const regex of BASE_PATTERNS) {
        if (regex.test(clean)) {
            return { isBase: true, label: formatBaseLabel(clean) };
        }
    }
    return { isBase: false, label: '' };
}
/**
 * Extrai a competência (mês e ano) a partir do texto do holerite.
 * Suporta formatos: "SETEMBRO/2019", "01/2026", "Mes/Ano : 7 / 2012", "Mês/Ano: 08/2018", etc.
 */
export function extractCompetence(text) {
    // 1. Padrão com nome do mês por extenso (ex: "Referencia: SETEMBRO/2019", "SETEMBRO / 2019", "Fevereiro 2021")
    const matchName = text.match(/\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\-\s]+(20\d{2}|19\d{2})\b/i);
    if (matchName && matchName[1] && matchName[2]) {
        const m = MONTH_NAMES_MAP[matchName[1].toLowerCase()] || '01';
        return { month: m, year: matchName[2] };
    }
    // 2. Padrão "Mes/Ano : 7 / 2012", "Mês/Ano: 08/2018", "Mês/Ano: 05/2010"
    const matchMesAno = text.match(/(?:m[eê]s\/ano|compet[eê]ncia|refer[eê]ncia)\s*:\s*([0-1]?\d)\s*[\/\-]\s*(20\d{2}|19\d{2})\b/i);
    if (matchMesAno && matchMesAno[1] && matchMesAno[2]) {
        const m = matchMesAno[1].padStart(2, '0');
        return { month: m, year: matchMesAno[2] };
    }
    // 3. Padrão numérico MM/YYYY (01 a 12)
    const matchNum = text.match(/\b(0[1-9]|1[0-2])[\/\-](20\d{2}|19\d{2})\b/);
    if (matchNum && matchNum[1] && matchNum[2]) {
        return { month: matchNum[1], year: matchNum[2] };
    }
    // 4. Padrão invertido YYYY/MM
    const matchInvert = text.match(/\b(20\d{2}|19\d{2})[\/\-](0[1-9]|1[0-2])\b/);
    if (matchInvert && matchInvert[1] && matchInvert[2]) {
        return { month: matchInvert[2], year: matchInvert[1] };
    }
    return { month: '', year: '' };
}
/**
 * Divide uma linha que pode conter múltiplas verbas (ex: Proventos e Descontos lado a lado) em segmentos.
 * Suporta valores positivos e negativos (ex: -433,20, -61,88, 3.059,94).
 */
function parseLineSegments(line) {
    const moneyRegex = /(?:-\s*)?[\d\?]{1,3}(?:\.[\d\?]{3})*,[\d\?]{2}/g;
    const matches = [];
    let m;
    while ((m = moneyRegex.exec(line)) !== null) {
        const valClean = m[0].replace(/\s+/g, '');
        matches.push({ value: valClean, index: m.index });
    }
    if (matches.length === 0)
        return [];
    const segments = [];
    if (matches.length === 1) {
        const m0 = matches[0];
        const label = line.substring(0, m0.index).trim();
        if (label.length >= 2) {
            segments.push({ labelText: label, value: m0.value });
        }
        return segments;
    }
    // Se houver 2 ou mais valores monetários na linha
    let currentStart = 0;
    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        if (nextMatch) {
            const textBetween = line.substring(currentMatch.index + currentMatch.value.length, nextMatch.index).trim();
            const hasLettersBetween = /[a-zA-ZÀ-ÿ]{2,}/.test(textBetween);
            if (hasLettersBetween) {
                // Há texto com palavras entre os dois números -> o primeiro número pertence ao item anterior
                const label = line.substring(currentStart, currentMatch.index).trim();
                if (label.length >= 2) {
                    segments.push({ labelText: label, value: currentMatch.value });
                }
                currentStart = currentMatch.index + currentMatch.value.length;
            }
            else {
                // Não há letras entre os dois números (ex: código Descrição Referência Valor)
                // O próximo número será o valor monetário real deste item
                continue;
            }
        }
        else {
            // Último match da linha
            const label = line.substring(currentStart, currentMatch.index).trim();
            if (label.length >= 2) {
                segments.push({ labelText: label, value: currentMatch.value });
            }
        }
    }
    return segments;
}
/**
 * Parser de Holerite com separação estrita entre `fields` e `bases`,
 * suporte a valores negativos, referências de texto/competência e deduplicação de vias.
 */
export function parseHolerite(document) {
    const pages = [];
    for (const page of document.pages) {
        const lines = page.text.split('\n').map(l => l.trim()).filter(Boolean);
        const { month, year } = extractCompetence(page.text);
        const fields = [];
        const bases = [];
        for (const line of lines) {
            // Ignora cabeçalhos de tabela
            if (/(?:código|codigo|descricao|descrição|referencia|referência|vencimentos|descontos|Verba\s+Nome)\b/i.test(line) && line.length < 70 && !/\d+,\d{2}/.test(line)) {
                continue;
            }
            // Ignora metadados de processo / assinatura eletrônica
            if (/(?:Assinado eletronicamente|Juntado em|ID\.|Fls\.:|Número do processo|Recibo de Pagamento|Folha:\s*MENSAL|Impresso por|Página:\s*\d+)/i.test(line) && !/\d+,\d{2}/.test(line)) {
                continue;
            }
            const segments = parseLineSegments(line);
            for (const seg of segments) {
                const cleanLabel = seg.labelText.replace(/[\|:]/g, ' ').replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, '').replace(/\s+/g, ' ').trim();
                const codeMatch = cleanLabel.match(/^(\d{3,5})\b/);
                const hasCode = !!(codeMatch && codeMatch[1]);
                const baseMatch = getBaseMatch(cleanLabel, hasCode);
                // 1. Se for uma Base ou Totalizador
                if (baseMatch.isBase) {
                    if (!bases.some(b => b.label.toLowerCase() === baseMatch.label.toLowerCase())) {
                        bases.push({
                            label: baseMatch.label,
                            value: seg.value,
                        });
                    }
                    continue;
                }
                // 2. Se for uma Verba (field)
                let code = '';
                let labelWithoutCode = cleanLabel;
                if (hasCode) {
                    code = codeMatch[1];
                    labelWithoutCode = cleanLabel.replace(new RegExp(`^${code}\\b`), '').trim();
                }
                // Extrai referência (pode ser numérica ex: "220,00", "6.188,63" ou de período ex: "JULHO/18", "S/13 SAL", "AC.SIST/0718")
                let reference = '';
                const refMatch = labelWithoutCode.match(/\b(?:(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{2,4}|ac\.sist\/\d{4}|s\/13\s*sal|s\/ferias|\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?%?)\s*$/i);
                if (refMatch && refMatch[0] && !refMatch[0].includes('%')) {
                    reference = refMatch[0].trim();
                    labelWithoutCode = labelWithoutCode.substring(0, labelWithoutCode.length - refMatch[0].length).trim();
                }
                const finalLabel = labelWithoutCode.replace(/[\|]/g, '').trim();
                if (finalLabel.length >= 2 && (hasCode || !getBaseMatch(finalLabel, false).isBase)) {
                    const alreadyExists = fields.some(f => (f.label.toLowerCase() === finalLabel.toLowerCase() || (code && f.code === code)) &&
                        f.value === seg.value &&
                        f.reference === reference);
                    if (!alreadyExists) {
                        fields.push({
                            code,
                            label: finalLabel,
                            reference,
                            value: seg.value,
                        });
                    }
                }
            }
        }
        pages.push({
            page: page.pageNumber,
            year,
            month,
            fields,
            bases,
        });
    }
    return { pages };
}
