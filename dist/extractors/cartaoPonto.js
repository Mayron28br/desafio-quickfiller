const OCR_CHAR_MAP = {
    'O': '0', 'o': '0', 'D': '0',
    'I': '1', 'i': '1', 'l': '1', '|': '1', '[': '1', ']': '1', '!': '1',
    'Z': '2', 'z': '2',
    'E': '3',
    'A': '4',
    'S': '5', 's': '5',
    'G': '6', 'b': '6',
    'T': '7',
    'B': '8',
    'g': '9', 'q': '9'
};
const MONTH_NAMES_MAP = {
    'JANEIRO': '01', 'JAN': '01',
    'FEVEREIRO': '02', 'FEV': '02',
    'MARÇO': '03', 'MARCO': '03', 'MAR': '03',
    'ABRIL': '04', 'ABR': '04',
    'MAIO': '05', 'MAI': '05',
    'JUNHO': '06', 'JUN': '06',
    'JULHO': '07', 'JUL': '07',
    'AGOSTO': '08', 'AGO': '08',
    'SETEMBRO': '09', 'SET': '09',
    'OUTUBRO': '10', 'OUT': '10',
    'NOVEMBRO': '11', 'NOV': '11',
    'DEZEMBRO': '12', 'DEZ': '12'
};
/**
  * Extrai metadados do cabeçalho do documento (Mês, Ano, Período).
  */
export function extractHeaderContext(text) {
    const ctx = {};
    if (!text)
        return ctx;
    // 1. Período: 16/12/2019 a 15/01/2020 ou 16/12/2019 - 15/01/2020
    const periodMatch = text.match(/(?:PERÍODO|PERIODO)[\s:]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\s*(?:a|-)\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i);
    if (periodMatch) {
        let y1 = parseInt(periodMatch[3], 10);
        if (y1 < 100)
            y1 += 2000;
        let y2 = parseInt(periodMatch[6], 10);
        if (y2 < 100)
            y2 += 2000;
        ctx.periodStart = { day: parseInt(periodMatch[1], 10), month: parseInt(periodMatch[2], 10), year: y1 };
        ctx.periodEnd = { day: parseInt(periodMatch[4], 10), month: parseInt(periodMatch[5], 10), year: y2 };
        ctx.month = String(ctx.periodStart.month).padStart(2, '0');
        ctx.year = String(ctx.periodStart.year);
        return ctx;
    }
    // 2. Mês/Ano: 05/2010 ou Competência: 06/2026 ou Emissão: Junho/2025 ou Mes/Ano : 7 / 2012
    const monthYearMatch = text.match(/(?:MÊS\/ANO|MES\/ANO|COMPETÊNCIA|COMPETENCIA|EMISSÃO|EMISSAO)[\s:]*([A-ZÇ]+|\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/i);
    if (monthYearMatch) {
        const rawM = monthYearMatch[1].toUpperCase();
        const m = MONTH_NAMES_MAP[rawM] || rawM.padStart(2, '0');
        let y = parseInt(monthYearMatch[2], 10);
        if (y < 100)
            y += 2000;
        ctx.month = m;
        ctx.year = String(y);
        return ctx;
    }
    // 3. Mês: Dezembro Ano: 2020 ou Mês: 12 Ano: 2020
    const mesAnoSeparateMatch = text.match(/(?:MÊS|MES)[\s:]*([A-ZÇ]+|\d{1,2}).*?(?:ANO)[\s:]*(\d{2,4})/i);
    if (mesAnoSeparateMatch) {
        const rawM = mesAnoSeparateMatch[1].toUpperCase();
        const m = MONTH_NAMES_MAP[rawM] || rawM.padStart(2, '0');
        let y = parseInt(mesAnoSeparateMatch[2], 10);
        if (y < 100)
            y += 2000;
        ctx.month = m;
        ctx.year = String(y);
        return ctx;
    }
    // 4. "ESPELHO DE PONTO - MAIO 2026" ou "DEZEMBRO/2020"
    const nameYearMatch = text.match(/\b(JANEIRO|FEVEREIRO|MARÇO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)[\s\/]+(\d{4})\b/i);
    if (nameYearMatch) {
        const rawM = nameYearMatch[1].toUpperCase();
        const m = MONTH_NAMES_MAP[rawM] || '01';
        ctx.month = m;
        ctx.year = nameYearMatch[2];
        return ctx;
    }
    return ctx;
}
/**
 * Formata qualquer token de data ou número de dia para uma data completa no padrão DD/MM/YYYY.
 */
export function formatToFullDate(raw, context) {
    if (raw === undefined || raw === null)
        return '';
    let str = String(raw).trim();
    // Remove ruído de dia da semana ("16/12/2019 SEG" -> "16/12/2019", "01 SAB" -> "01", "2 - SEG" -> "2")
    str = str.replace(/\s*[\-\s]\s*(?:SEG|TER|QUA|QUI|SEX|SAB|DOM|FER|DSR|FOLGA)\b.*/i, '').trim();
    str = str.replace(/\s+(?:SEG|TER|QUA|QUI|SEX|SAB|DOM|FER|DSR|FOLGA)\b.*/i, '').trim();
    str = str.replace(/^[\-\s]+|[\-\s]+$/g, '').trim();
    // Normaliza separadores (. e -) para '/'
    str = str.replace(/[\.\-]/g, '/');
    // Caso 1: Já contém DD/MM/YYYY completo
    const fullMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (fullMatch) {
        const d = fullMatch[1].padStart(2, '0');
        const m = fullMatch[2].padStart(2, '0');
        let y = fullMatch[3];
        if (y.length === 2) {
            y = parseInt(y, 10) > 50 ? `19${y}` : `20${y}`;
        }
        return `${d}/${m}/${y}`;
    }
    // Caso 2: DD/MM sem ano
    const dayMonthMatch = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (dayMonthMatch) {
        const d = dayMonthMatch[1].padStart(2, '0');
        const m = dayMonthMatch[2].padStart(2, '0');
        const y = context?.year || '2026';
        return `${d}/${m}/${y}`;
    }
    // Caso 3: Apenas o número do dia (ex: "1", "01", "18")
    const dayOnlyMatch = str.match(/^(\d{1,2})$/);
    if (dayOnlyMatch) {
        const dayNum = parseInt(dayOnlyMatch[1], 10);
        const d = String(dayNum).padStart(2, '0');
        if (context?.periodStart && context?.periodEnd) {
            // Período que cruza mês/ano (ex: 16/12/2019 a 15/01/2020)
            if (dayNum >= context.periodStart.day) {
                const m = String(context.periodStart.month).padStart(2, '0');
                const y = String(context.periodStart.year);
                return `${d}/${m}/${y}`;
            }
            else {
                const m = String(context.periodEnd.month).padStart(2, '0');
                const y = String(context.periodEnd.year);
                return `${d}/${m}/${y}`;
            }
        }
        const m = context?.month ? String(context.month).padStart(2, '0') : '01';
        const y = context?.year || '2026';
        return `${d}/${m}/${y}`;
    }
    return str;
}
/**
 * Sanitiza e extrai todos os horários válidos de um token ruidoso de OCR.
 */
export function sanitizeTimeToken(raw) {
    if (!raw)
        return [];
    let s = raw.trim();
    if (s.startsWith('+')) {
        s = s.substring(1).trim();
    }
    s = s.replace(/[a-zA-Z]+$/, '').trim();
    if (s.includes('?')) {
        const qMatch = s.match(/([0-2\?][0-9\?])[:\.\-hH]([0-5\?][0-9\?])/);
        if (qMatch) {
            return [`${qMatch[1]}:${qMatch[2]}`];
        }
        return [s.replace(/[hH\.\-]/g, ':')];
    }
    const results = [];
    s = s.replace(/^[^\dOoilZzEASsGgTBbq?]+/, '').replace(/[^\dOoilZzEASsGgTBbq?]+$/, '');
    if (/[:\.\-hH]/.test(s)) {
        const mapped = s.split('').map(c => OCR_CHAR_MAP[c] || c).join('');
        const pattern = /(\d{1,4})[:\.\-hH](\d{2})(?:[:\.\-hH](\d{2}))?/g;
        let match;
        while ((match = pattern.exec(mapped)) !== null) {
            let hPart = match[1];
            let mPart = match[2];
            const sPart = match[3];
            if (hPart.length > 2) {
                hPart = hPart.slice(-2);
            }
            let hh = parseInt(hPart, 10);
            let mm = parseInt(mPart, 10);
            if (sPart && (hh < 0 || hh > 23 || (hh <= 5 && parseInt(mPart, 10) >= 6 && parseInt(mPart, 10) <= 23))) {
                const altH = parseInt(mPart, 10);
                const altM = parseInt(sPart, 10);
                if (altH >= 0 && altH <= 23 && altM >= 0 && altM <= 59) {
                    hh = altH;
                    mm = altM;
                }
            }
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                results.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
            }
        }
    }
    if (results.length === 0) {
        const cleanDigits = s.split('').map(c => OCR_CHAR_MAP[c] || c).join('').replace(/\D/g, '');
        if (cleanDigits.length === 4) {
            const hh = parseInt(cleanDigits.substring(0, 2), 10);
            const mm = parseInt(cleanDigits.substring(2, 4), 10);
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                results.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
            }
        }
        else if (cleanDigits.length === 5) {
            const hh = parseInt(cleanDigits.substring(1, 3), 10);
            const mm = parseInt(cleanDigits.substring(3, 5), 10);
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                results.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
            }
        }
    }
    return results;
}
export function normalizeTime(raw) {
    if (!raw)
        return '';
    let trimmed = raw.trim();
    if (trimmed.includes('?')) {
        const qMatches = sanitizeTimeToken(trimmed);
        if (qMatches.length > 0)
            return qMatches[0];
        return trimmed.replace(/[hH\.\-]/g, ':');
    }
    const sanitized = sanitizeTimeToken(trimmed);
    if (sanitized.length > 0) {
        return sanitized[0];
    }
    return trimmed;
}
export function repairOcrTimeToken(token) {
    const times = sanitizeTimeToken(token);
    return times.length > 0 ? times[0] : null;
}
function createPunchesFromRawList(rawTimes) {
    const punches = [];
    let punchIndex = 0;
    for (const raw of rawTimes) {
        if (!raw)
            continue;
        const sanitized = sanitizeTimeToken(raw);
        if (sanitized.length > 1) {
            for (const st of sanitized) {
                const kind = punchIndex % 2 === 0 ? 'IN' : 'OUT';
                punches.push({
                    kind,
                    time_raw: st,
                    time_hhmm: st,
                });
                punchIndex++;
            }
        }
        else {
            const kind = punchIndex % 2 === 0 ? 'IN' : 'OUT';
            const time_hhmm = sanitized.length === 1 ? sanitized[0] : normalizeTime(raw);
            punches.push({
                kind,
                time_raw: raw.trim(),
                time_hhmm,
            });
            punchIndex++;
        }
    }
    return punches;
}
export function buildDayRecord(date_raw, punches) {
    return {
        date_raw,
        punches,
        entrada1: punches[0]?.time_hhmm || '',
        saida1: punches[1]?.time_hhmm || '',
        entrada2: punches[2]?.time_hhmm || '',
        saida2: punches[3]?.time_hhmm || '',
        entradaExtra: punches[4]?.time_hhmm || '',
        saidaExtra: punches[5]?.time_hhmm || '',
    };
}
function extractRawTimesFromText(text) {
    const tokens = text.split(/[\s,;|]+/);
    const rawTimes = [];
    for (const tok of tokens) {
        if (/^(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER|DSR|FOLGA|TOTAL|COMPENSADO|FERIADO)$/i.test(tok)) {
            continue;
        }
        const sanitized = sanitizeTimeToken(tok);
        if (sanitized.length === 1) {
            rawTimes.push(tok);
        }
        else if (sanitized.length > 1) {
            rawTimes.push(...sanitized);
        }
    }
    return rawTimes;
}
/**
 * Extrator específico para o layout Banco do Brasil.
 */
function parseBancoDoBrasilPage(text, pageNumber, context) {
    const pageCtx = { ...context, ...extractHeaderContext(text) };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const days = [];
    const dayHeaderRegex = /^\s*(\d{1,2})\s+(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER)\b(.*)$/i;
    for (const line of lines) {
        const match = line.match(dayHeaderRegex);
        if (!match)
            continue;
        const dayNum = match[1];
        const dow = match[2].toUpperCase();
        const rest = match[3] || '';
        const date_raw = formatToFullDate(`${dayNum} ${dow}`, pageCtx);
        const intervalRegex = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
        const intervals = [];
        let intMatch;
        while ((intMatch = intervalRegex.exec(rest)) !== null) {
            intervals.push([intMatch[1], intMatch[2]]);
        }
        let punches = [];
        if (intervals.length === 1) {
            const [entry, exit] = intervals[0];
            punches = createPunchesFromRawList([entry, exit]);
        }
        else if (intervals.length >= 2) {
            const [mainEntry, mainExit] = intervals[0];
            const chronTimes = [mainEntry];
            for (let i = 1; i < intervals.length; i++) {
                const [intStart, intEnd] = intervals[i];
                chronTimes.push(intStart, intEnd);
            }
            chronTimes.push(mainExit);
            punches = createPunchesFromRawList(chronTimes);
        }
        else {
            punches = [];
        }
        days.push(buildDayRecord(date_raw, punches));
    }
    if (days.length === 0)
        return null;
    return { page: pageNumber, days };
}
/**
 * Extrator específico para o layout SIPON / POEL,C.
 */
function parseSiponPage(text, pageNumber, context) {
    const pageCtx = { ...context, ...extractHeaderContext(text) };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const days = [];
    let currentDay = null;
    const dayStartRegex = /^(\d{1,2})\s*-\s*(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER)\b(.*)$/i;
    for (const line of lines) {
        if (/(FOLHA DE FREQUENCIA|SISTEMA DE PONTO|SIPON|POEL|Matricula|Horario de Trabalho|Mes\/Ano|Dia\s+Semana|Número do processo|Assinado eletronicamente|Fls\.:)/i.test(line)) {
            continue;
        }
        const dayMatch = line.match(dayStartRegex);
        if (dayMatch) {
            const dayNum = dayMatch[1];
            const dow = dayMatch[2].toUpperCase();
            const date_raw = formatToFullDate(`${dayNum} - ${dow}`, pageCtx);
            let rest = (dayMatch[3] || '').trim();
            rest = rest.replace(/(?:HE-BCO DE HORAS|HE-REMUNERADA|HE COMPENSADA|ABN\/DEC\.CHEFIA|REG\.\s*SUSPENSO|DESTACAMENTO)(?:\s+\d{1,2}:\d{2})?/gi, '').trim();
            let times = extractRawTimesFromText(rest);
            if (times.length > 0 && times[0] === '08:00' && times.length > 1) {
                times = times.slice(1);
            }
            else if (times.length === 1 && times[0] === '08:00') {
                times = [];
            }
            if (currentDay && currentDay.date_raw === date_raw) {
                const extraPunches = createPunchesFromRawList(times);
                for (const p of extraPunches) {
                    p.kind = currentDay.punches.length % 2 === 0 ? 'IN' : 'OUT';
                    currentDay.punches.push(p);
                }
                currentDay = buildDayRecord(currentDay.date_raw, currentDay.punches);
            }
            else {
                if (currentDay) {
                    days.push(currentDay);
                }
                currentDay = buildDayRecord(date_raw, createPunchesFromRawList(times));
            }
        }
        else if (currentDay) {
            let rest = line.replace(/(?:HE-BCO DE HORAS|HE-REMUNERADA|HE COMPENSADA|ABN\/DEC\.CHEFIA|REG\.\s*SUSPENSO|DESTACAMENTO)(?:\s+\d{1,2}:\d{2})?/gi, '').trim();
            const times = extractRawTimesFromText(rest);
            if (times.length > 0) {
                const extraPunches = createPunchesFromRawList(times);
                for (const p of extraPunches) {
                    p.kind = currentDay.punches.length % 2 === 0 ? 'IN' : 'OUT';
                    currentDay.punches.push(p);
                }
                currentDay = buildDayRecord(currentDay.date_raw, currentDay.punches);
            }
        }
    }
    if (currentDay) {
        days.push(currentDay);
    }
    if (days.length === 0)
        return null;
    return { page: pageNumber, days };
}
/**
 * Parser espacial para cartões de ponto usando as coordenadas bbox de cada token OCR.
 */
export function parseQuinzenaWithBBox(page, context) {
    if (!page.words || page.words.length === 0)
        return null;
    const pageCtx = { ...context, ...extractHeaderContext(page.text || '') };
    const words = page.words;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const w of words) {
        if (w.bbox.x0 < minX)
            minX = w.bbox.x0;
        if (w.bbox.x1 > maxX)
            maxX = w.bbox.x1;
        if (w.bbox.y0 < minY)
            minY = w.bbox.y0;
        if (w.bbox.y1 > maxY)
            maxY = w.bbox.y1;
    }
    const midX = (minX + maxX) / 2;
    const leftWords = [];
    const rightWords = [];
    let hasSecondQuinzenaOnRight = false;
    for (const w of words) {
        if (w.bbox.x0 < midX) {
            leftWords.push(w);
        }
        else {
            rightWords.push(w);
            if (/2\.?\s*QUINZENA/i.test(w.text) || /\b(1[6-9]|2[0-9]|3[01])\b/.test(w.text)) {
                hasSecondQuinzenaOnRight = true;
            }
        }
    }
    const processQuinzenaWords = (qWords, startDay, endDay, pageNum) => {
        const rowTolerance = 18;
        const sortedWords = [...qWords].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
        const rows = [];
        for (const w of sortedWords) {
            if (/(QUINZENA|MANHÃ|MANHA|TARDE|EXTRA|DIAS|ENTRADA|SAÍDA|SAIDA|HORAS|EXTRAS|EMPRESA|FOLHA|PONTO|TOTAL)/i.test(w.text)) {
                continue;
            }
            let placed = false;
            for (const r of rows) {
                const avgY = r.reduce((sum, item) => sum + item.bbox.y0, 0) / r.length;
                if (Math.abs(w.bbox.y0 - avgY) <= rowTolerance) {
                    r.push(w);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                rows.push([w]);
            }
        }
        const daysMap = new Map();
        for (let d = startDay; d <= endDay; d++) {
            daysMap.set(d, []);
        }
        for (const row of rows) {
            row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            let dayNum = null;
            let dayTokenIdx = -1;
            for (let i = 0; i < row.length; i++) {
                const tokText = row[i].text.replace(/\D/g, '');
                if (tokText) {
                    const num = parseInt(tokText, 10);
                    if (num >= startDay && num <= endDay) {
                        dayNum = num;
                        dayTokenIdx = i;
                        break;
                    }
                }
            }
            if (dayNum !== null) {
                const timeTokens = [];
                for (let i = dayTokenIdx + 1; i < row.length; i++) {
                    const rawText = row[i].text;
                    const sanitized = sanitizeTimeToken(rawText);
                    if (sanitized.length > 0) {
                        timeTokens.push(...sanitized);
                    }
                }
                if (timeTokens.length > 0) {
                    daysMap.set(dayNum, createPunchesFromRawList(timeTokens));
                }
            }
        }
        const days = [];
        for (let d = startDay; d <= endDay; d++) {
            const pList = daysMap.get(d) || [];
            const date_raw = formatToFullDate(d, pageCtx);
            days.push(buildDayRecord(date_raw, pList));
        }
        return { page: pageNum, days };
    };
    if (hasSecondQuinzenaOnRight && leftWords.length > 0 && rightWords.length > 0) {
        const page1 = processQuinzenaWords(leftWords, 1, 15, page.pageNumber);
        const page2 = processQuinzenaWords(rightWords, 16, 31, page.pageNumber);
        return [page1, page2];
    }
    else {
        const isSecond = /2\.?\s*QUINZENA/i.test(page.text) || (page.pageNumber % 2 === 0);
        const startDay = isSecond ? 16 : 1;
        const endDay = isSecond ? 31 : 15;
        const singlePage = processQuinzenaWords(words, startDay, endDay, page.pageNumber);
        return [singlePage];
    }
}
/**
 * Extrator para layout Quinzenal / Manual / Carimbado.
 */
function parseQuinzenaPage(text, pageNumber, context) {
    const pageCtx = { ...context, ...extractHeaderContext(text) };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const isSecondQuinzena = /2\.?\s*QUINZENA/i.test(text) || (pageNumber % 2 === 0);
    const startDay = isSecondQuinzena ? 16 : 1;
    const endDay = isSecondQuinzena ? 31 : 15;
    const daysMap = new Map();
    for (let d = startDay; d <= endDay; d++) {
        daysMap.set(d, []);
    }
    let foundAny = false;
    for (const line of lines) {
        if (/(QUINZENA|MANHÃ|MANHA|TARDE|EXTRA|DIAS|Entrada|Saída|Horas Extras)/i.test(line)) {
            continue;
        }
        const dayMatch = line.match(/^([1-3]?\d)\b(.*)$/);
        if (dayMatch) {
            const dayNum = parseInt(dayMatch[1], 10);
            if (dayNum >= startDay && dayNum <= endDay) {
                const rest = dayMatch[2] || '';
                const times = extractRawTimesFromText(rest);
                if (times.length > 0) {
                    daysMap.set(dayNum, createPunchesFromRawList(times));
                    foundAny = true;
                }
            }
        }
    }
    if (!foundAny)
        return null;
    const days = [];
    for (let d = startDay; d <= endDay; d++) {
        const punches = daysMap.get(d) || [];
        const date_raw = formatToFullDate(d, pageCtx);
        days.push(buildDayRecord(date_raw, punches));
    }
    return { page: pageNumber, days };
}
/**
 * Extrator padrão para Cartões de Ponto Colunares.
 */
function parseStandardColumnarPage(text, pageNumber, context) {
    const pageCtx = { ...context, ...extractHeaderContext(text) };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const days = [];
    const dateRegex = /\b([0-9DOIl|sS]?\d)[\/\-\.]([0-9DOIl|sS]?\d)(?:[\/\-\.]([0-9DOIl|sS]{2,4}))?\b/;
    const altDateRegex = /^\s*([0-3]?\d)\s+(?:SEG|TER|QUA|QUI|SEX|SAB|DOM|FER|DSR)\b/i;
    const hasTotalHeader = /(TOTAL|TOT\b|HORAS\s+TRAB)/i.test(text);
    for (const line of lines) {
        if (/(PERÍODO|PERIODO|EMISSÃO|EMISSAO|CNPJ|MATRÍCULA|MATRICULA|FUNCIONÁRIO|FUNCIONARIO)/i.test(line)) {
            continue;
        }
        let dateMatch = line.match(dateRegex);
        let rawDateToken = '';
        let lineAfterDate = '';
        if (dateMatch && dateMatch[0]) {
            rawDateToken = dateMatch[0];
            const dateIdx = line.indexOf(rawDateToken);
            lineAfterDate = line.substring(dateIdx + rawDateToken.length).trim();
        }
        else {
            const altMatch = line.match(altDateRegex);
            if (altMatch && altMatch[0]) {
                rawDateToken = altMatch[0];
                lineAfterDate = line.substring(rawDateToken.length).trim();
            }
        }
        if (rawDateToken) {
            const cleanDateToken = rawDateToken.replace(/^[DO]/, '0').replace(/^[Il|]/, '1');
            const date_raw = formatToFullDate(cleanDateToken, pageCtx);
            if (lineAfterDate.includes('|')) {
                lineAfterDate = lineAfterDate.split('|')[0] || '';
            }
            const isDayOff = /(ABONO|NATAL|ATESTADO|FERIADO|FOLGA|DSR|LICENCA|DESCANSO|CONFRATERNIZAÇÃO|COMPENSADO)/i.test(lineAfterDate);
            let times = extractRawTimesFromText(lineAfterDate);
            if (times.length === 5 || times.length === 3 || times.length === 7 || (hasTotalHeader && times.length % 2 !== 0)) {
                times = times.slice(0, times.length - 1);
            }
            let punches = [];
            if (isDayOff && times.length <= 1) {
                punches = [];
            }
            else {
                punches = createPunchesFromRawList(times);
            }
            days.push(buildDayRecord(date_raw, punches));
        }
    }
    return { page: pageNumber, days };
}
/**
 * Parser principal de Cartão de Ponto com seleção automática de estratégia por página.
 */
export function parseCartaoPonto(document) {
    const resultPages = [];
    const fullDocText = document.pages.map(p => p.text || '').join('\n');
    const docContext = extractHeaderContext(fullDocText);
    for (const page of document.pages) {
        const text = page.text || '';
        const pageContext = { ...docContext, ...extractHeaderContext(text) };
        // 1. Tenta estratégia Banco do Brasil
        if (/BANCO DO BRASIL/i.test(text) || (/Intervalo\s*1/i.test(text) && /Entrada\s*Saida/i.test(text))) {
            const bbPage = parseBancoDoBrasilPage(text, page.pageNumber, pageContext);
            if (bbPage && bbPage.days.length > 0) {
                resultPages.push(bbPage);
                continue;
            }
        }
        // 2. Tenta estratégia SIPON / POEL,C
        if (/SIPON|POEL|CONSULTA PONTO ELETRONICO/i.test(text) || (/Jornada/i.test(text) && /Ocorrencia/i.test(text))) {
            const siponPage = parseSiponPage(text, page.pageNumber, pageContext);
            if (siponPage && siponPage.days.length > 0) {
                resultPages.push(siponPage);
                continue;
            }
        }
        // 3. Tenta estratégia Quinzenal / Manual com suporte a BBox espacial (apenas para quinzenas autênticas)
        if (page.words && page.words.length > 0 && (/QUINZENA/i.test(text) || (/MANHÃ|MANHA/i.test(text) && /TARDE/i.test(text) && /EXTRA/i.test(text)))) {
            const bboxPages = parseQuinzenaWithBBox(page, pageContext);
            if (bboxPages && bboxPages.length > 0 && bboxPages.some(p => p.days.some(d => d.punches.length > 0))) {
                resultPages.push(...bboxPages);
                continue;
            }
        }
        // 4. Estratégia Quinzenal via texto simples
        if (/QUINZENA/i.test(text) || (/MANHÃ|MANHA/i.test(text) && /TARDE/i.test(text) && /EXTRA/i.test(text))) {
            const quinzenaPage = parseQuinzenaPage(text, page.pageNumber, pageContext);
            if (quinzenaPage && quinzenaPage.days.length > 0) {
                resultPages.push(quinzenaPage);
                continue;
            }
        }
        // 5. Estratégia Padrão Colunar / Datas DD/MM/YYYY
        const standardPage = parseStandardColumnarPage(text, page.pageNumber, pageContext);
        resultPages.push(standardPage);
    }
    return { pages: resultPages };
}
