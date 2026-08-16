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
const BASE_KEYWORDS = [
    'base inss', 'base i.n.s.s', 'base calc. inss', 'base calculo inss', 'base cálculo inss',
    'base irrf', 'base i.r.r.f', 'base calc. irrf', 'base ir', 'base cálculo irrf',
    'base fgts', 'base f.g.t.s', 'fgts do mês', 'fgts do mes', 'fgts a recolher', 'valor fgts',
    'total vencimentos', 'total proventos', 'total de vencimentos', 'total de proventos',
    'total descontos', 'total de descontos',
    'valor líquido', 'valor liquido', 'líquido a receber', 'liquido a receber', 'líquido', 'liquido'
];
/**
 * Verifica se uma linha representa a seção de bases/totais do rodapé.
 */
function isBaseLine(line, code) {
    // Se tem código de verba explícito no início (ex: 0010, 0998), é uma verba da tabela
    if (code && code.length >= 3) {
        return false;
    }
    const lower = line.toLowerCase();
    return BASE_KEYWORDS.some(b => lower.includes(b));
}
/**
 * Extrai a competência (mês e ano) a partir do texto do holerite.
 */
function extractCompetence(text) {
    const matchNum = text.match(/\b(0[1-9]|1[0-2])[\/\-](20\d{2}|19\d{2})\b/);
    if (matchNum && matchNum[1] && matchNum[2]) {
        return { month: matchNum[1], year: matchNum[2] };
    }
    const matchInvert = text.match(/\b(20\d{2}|19\d{2})[\/\-](0[1-9]|1[0-2])\b/);
    if (matchInvert && matchInvert[1] && matchInvert[2]) {
        return { month: matchInvert[2], year: matchInvert[1] };
    }
    const matchName = text.match(/\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\-\s]+(20\d{2}|19\d{2})\b/i);
    if (matchName && matchName[1] && matchName[2]) {
        const m = MONTH_NAMES_MAP[matchName[1].toLowerCase()] || '01';
        return { month: m, year: matchName[2] };
    }
    return { month: '', year: '' };
}
/**
 * Parser de Holerite com separação estrita entre `fields` e `bases`.
 */
export function parseHolerite(document) {
    const pages = [];
    const moneyRegex = /\b[\d\?]{1,3}(?:\.[\d\?]{3})*,[\d\?]{2}\b/g;
    for (const page of document.pages) {
        const lines = page.text.split('\n').map(l => l.trim()).filter(Boolean);
        const { month, year } = extractCompetence(page.text);
        const fields = [];
        const bases = [];
        for (const line of lines) {
            if (/(código|descricao|descrição|referencia|referência|vencimentos|descontos)/i.test(line) && line.length < 50) {
                continue;
            }
            const moneyMatches = line.match(moneyRegex);
            if (!moneyMatches || moneyMatches.length === 0)
                continue;
            const codeMatch = line.match(/^(\d{3,5})\b/);
            const code = codeMatch && codeMatch[1] ? codeMatch[1] : '';
            if (isBaseLine(line, code)) {
                for (const baseKey of BASE_KEYWORDS) {
                    const idx = line.toLowerCase().indexOf(baseKey);
                    if (idx !== -1) {
                        const val = moneyMatches[0] || '0,00';
                        const labelFormatted = baseKey
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        if (!bases.some(b => b.label.toLowerCase() === labelFormatted.toLowerCase())) {
                            bases.push({
                                label: labelFormatted,
                                value: val,
                            });
                        }
                    }
                }
            }
            else {
                let remaining = code ? line.replace(new RegExp(`^${code}\\b`), '').trim() : line;
                const val = moneyMatches[moneyMatches.length - 1] || '';
                remaining = remaining.replace(val, '').trim();
                let reference = '';
                if (moneyMatches.length > 1) {
                    reference = moneyMatches[0] || '';
                    remaining = remaining.replace(reference, '').trim();
                }
                else {
                    const refMatch = remaining.match(/\b\d{1,3}(?:,\d{1,2})?\s*[%hH]?$/);
                    if (refMatch && refMatch[0]) {
                        reference = refMatch[0].trim();
                        remaining = remaining.replace(refMatch[0], '').trim();
                    }
                }
                const label = remaining.replace(/[\-\|]/g, '').trim();
                if (label.length >= 2 && val) {
                    fields.push({
                        code,
                        label,
                        reference,
                        value: val,
                    });
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
