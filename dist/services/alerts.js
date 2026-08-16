/**
 * Converte data DD/MM ou DD/MM/YYYY em objeto numérico { day, month, year } para checagem sequencial.
 */
function parseDateForSequence(dateStr) {
    if (!dateStr || dateStr.includes('?'))
        return null;
    const parts = dateStr.split(/[\/\-\.]/).map(p => parseInt(p, 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const day = parts[0];
        const month = parts[1];
        const year = parts.length >= 3 && !isNaN(parts[2]) ? parts[2] : 2026;
        return { day, month, year };
    }
    return null;
}
/**
 * Calcula os alertas derivados para cada linha de um Cartão de Ponto.
 */
export function calculateCartaoPontoAlerts(pages) {
    const alerts = new Map();
    let prevDate = null;
    for (const page of pages) {
        for (let dayIdx = 0; dayIdx < page.days.length; dayIdx++) {
            const dayRecord = page.days[dayIdx];
            const key = `${page.page}-${dayIdx}`;
            const reasons = [];
            let isYellow = false;
            let isRed = false;
            // 1. Batidas Ímpares
            if (dayRecord.punches.length % 2 !== 0) {
                isYellow = true;
                reasons.push('Número ímpar de batidas (falta entrada ou saída)');
            }
            // 2. Incerteza ('?' em data ou horários)
            const hasUncertainty = dayRecord.date_raw.includes('?') ||
                dayRecord.punches.some(p => p.time_raw.includes('?') || p.time_hhmm.includes('?'));
            if (hasUncertainty) {
                isYellow = true;
                reasons.push('Caractere incerto (?) na leitura da linha');
            }
            // 3. Data Não Sequencial
            const currDate = parseDateForSequence(dayRecord.date_raw);
            if (currDate && prevDate) {
                // Verifica se a data atual não é consecutiva ou igual/anterior à anterior quando deveria avançar
                const prevTime = new Date(prevDate.year, prevDate.month - 1, prevDate.day).getTime();
                const currTime = new Date(currDate.year, currDate.month - 1, currDate.day).getTime();
                const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
                if (diffDays !== 1 && diffDays !== 0) {
                    // Quebra de sequência esperada
                    isRed = true;
                    reasons.push(`Data não sequencial (${dayRecord.date_raw} após anterior)`);
                }
            }
            if (currDate) {
                prevDate = currDate;
            }
            // Hierarquia: Vermelho ganha
            const level = isRed ? 'red' : isYellow ? 'yellow' : null;
            alerts.set(key, { level, reasons });
        }
    }
    return alerts;
}
/**
 * Calcula os alertas derivados para cada página de um Holerite.
 */
export function calculateHoleriteAlerts(pages) {
    const alerts = new Map();
    let prevComp = null;
    for (const page of pages) {
        const reasons = [];
        let isYellow = false;
        let isRed = false;
        // 1. Página Vazia
        if (page.fields.length === 0 && page.bases.length === 0) {
            isYellow = true;
            reasons.push('Página sem dados extraídos');
        }
        // 2. Incerteza ('?' em qualquer campo)
        const hasUncertainty = page.month.includes('?') ||
            page.year.includes('?') ||
            page.fields.some(f => f.code.includes('?') || f.label.includes('?') || f.value.includes('?')) ||
            page.bases.some(b => b.label.includes('?') || b.value.includes('?'));
        if (hasUncertainty) {
            isYellow = true;
            reasons.push('Caractere incerto (?) na leitura da página');
        }
        // 3. Mês Não Sequencial
        const m = parseInt(page.month, 10);
        const y = parseInt(page.year, 10);
        const isReadableComp = !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12;
        if (isReadableComp && prevComp) {
            // O próximo mês esperado: se prev.month == 12, esperado é 1 do ano seguinte
            const expectedMonth = prevComp.month === 12 ? 1 : prevComp.month + 1;
            const expectedYear = prevComp.month === 12 ? prevComp.year + 1 : prevComp.year;
            if (m !== expectedMonth || y !== expectedYear) {
                isRed = true;
                reasons.push(`Competência não sequencial (${page.month}/${page.year} esperava ${String(expectedMonth).padStart(2, '0')}/${expectedYear})`);
            }
        }
        if (isReadableComp) {
            prevComp = { month: m, year: y };
        }
        // Hierarquia: Vermelho ganha
        const level = isRed ? 'red' : isYellow ? 'yellow' : null;
        alerts.set(page.page, { level, reasons });
    }
    return alerts;
}
