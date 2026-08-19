import { CartaoPontoPage, CartaoPontoTranscription, DayRecord, Punch, PunchKind } from '../types/index.js';
import { ExtractedDocument } from '../services/ocr.js';

/**
 * Normaliza uma string de horário para o padrão HH:MM em 24h.
 * Trata formatos: 08:25, 8:25, 08h25, 08.25, 07:00d, +03:00d, 06:56c, 0?:25.
 * Preserva o caractere '?' em posições ilegíveis.
 */
export function normalizeTime(raw: string): string {
  if (!raw) return '';
  let trimmed = raw.trim();

  // Remove prefixo '+' se houver (ex: +03:00d -> 03:00d)
  if (trimmed.startsWith('+')) {
    trimmed = trimmed.substring(1).trim();
  }

  // Remove sufixo de tipo de registro (ex: d de digitado, c de coletado, e)
  trimmed = trimmed.replace(/[a-zA-Z]+$/, '').trim();

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
 * Cria lista de batidas (Punch[]) a partir de uma lista de strings de horários brutos.
 */
function createPunchesFromRawList(rawTimes: string[]): Punch[] {
  const punches: Punch[] = [];
  let punchIndex = 0;

  for (const raw of rawTimes) {
    if (!raw) continue;
    const kind: PunchKind = punchIndex % 2 === 0 ? 'IN' : 'OUT';
    const time_hhmm = normalizeTime(raw);

    punches.push({
      kind,
      time_raw: raw.trim(),
      time_hhmm,
    });
    punchIndex++;
  }

  return punches;
}

/**
 * Repara tokens de horário com ruídos ópticos comuns de OCR (ex: carimbos mecânicos com letras/símbolos de relógio).
 */
export function repairOcrTimeToken(token: string): string | null {
  if (!token) return null;
  let s = token.trim();

  // Remove caracteres/símbolos iniciais que são ícones de relógio (ex: R, B, M, $, aB, etc.)
  s = s.replace(/^[^0-9IiloOSsBGZz]+/, '');

  const charMap: Record<string, string> = {
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

  // Se o token contém separador de hora/minuto (: . h)
  if (s.includes(':') || s.includes('.') || s.includes('h') || s.includes('H')) {
    const parts = s.split(/[:\.hH]/);
    if (parts.length >= 2) {
      let hStr = parts[0]!.split('').map(c => charMap[c] || c).join('').replace(/\D/g, '');
      let mStr = parts[1]!.split('').map(c => charMap[c] || c).join('').replace(/\D/g, '');

      if (hStr.length > 2) hStr = hStr.slice(-2);
      if (mStr.length > 2) mStr = mStr.slice(0, 2);

      if (hStr.length >= 1 && mStr.length === 2) {
        const hh = parseInt(hStr, 10);
        const mm = parseInt(mStr, 10);
        if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
          return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        }
      }
    }
  }

  // Se o token for uma sequência de 4 caracteres numéricos (ex: 0950 -> 09:50)
  const clean = s.split('').map(c => charMap[c] || c).join('').replace(/\D/g, '');
  if (clean.length === 4) {
    const hh = parseInt(clean.substring(0, 2), 10);
    const mm = parseInt(clean.substring(2, 4), 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Extrai horários brutos de uma linha de texto padrão.
 */
function extractRawTimesFromText(text: string): string[] {
  // Regex que reconhece horários com prefixo +, sufixos (c, d, e), separadores : . h ou ?
  const timeRegex = /(?:\+)?\b(?:[0-2]?[0-9]|\?{1,2})[:hH\.]?(?:[0-5][0-9]|\?{1,2})[a-zA-Z]?\b/g;
  const matches = text.match(timeRegex) || [];

  const validTimes: string[] = matches.filter(raw => {
    const clean = raw.replace(/[+a-zA-Z]/g, '');
    if (clean.length < 3 && !clean.includes(':') && !clean.includes('h') && !clean.includes('.')) {
      return false;
    }
    return true;
  });

  // Se não encontrou horários com o regex padrão, tenta recuperar via tokens de OCR
  if (validTimes.length === 0) {
    const tokens = text.split(/[\s,;|]+/);
    for (const tok of tokens) {
      const repaired = repairOcrTimeToken(tok);
      if (repaired && !validTimes.includes(repaired)) {
        validTimes.push(repaired);
      }
    }
  }

  return validTimes;
}

/**
 * Extrator específico para o layout Banco do Brasil (Ponto Eletrônico - Relatório Mensal).
 * Colunas: Dia [Nome] | Entrada Saida | Intervalo 1 | Intervalo 2...
 * Ex: 18 TER 09:00 - 18:00 12:00 - 13:00 2,0 610 378 S
 * Ordem cronológica real: [Entrada, Início Intervalo 1, Fim Intervalo 1, Saída]
 */
function parseBancoDoBrasilPage(text: string, pageNumber: number): CartaoPontoPage | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const days: DayRecord[] = [];

  const dayHeaderRegex = /^\s*(\d{1,2})\s+(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER)\b(.*)$/i;

  for (const line of lines) {
    const match = line.match(dayHeaderRegex);
    if (!match) continue;

    const dayNum = match[1]!.padStart(2, '0');
    const dow = match[2]!.toUpperCase();
    const rest = match[3] || '';
    const date_raw = `${dayNum} ${dow}`;

    // Procura por pares de intervalos HH:MM - HH:MM
    const intervalRegex = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
    const intervals: [string, string][] = [];
    let intMatch;
    while ((intMatch = intervalRegex.exec(rest)) !== null) {
      intervals.push([intMatch[1]!, intMatch[2]!]);
    }

    let punches: Punch[] = [];

    if (intervals.length === 1) {
      // Apenas Entrada e Saída (sem intervalo de almoço)
      const [entry, exit] = intervals[0]!;
      punches = createPunchesFromRawList([entry, exit]);
    } else if (intervals.length >= 2) {
      // Intervalo 0 é Entrada Saída geral [E, S]
      // Intervalo 1..N são os descansos [I1_inicio, I1_fim]
      const [mainEntry, mainExit] = intervals[0]!;
      const chronTimes: string[] = [mainEntry];

      for (let i = 1; i < intervals.length; i++) {
        const [intStart, intEnd] = intervals[i]!;
        chronTimes.push(intStart, intEnd);
      }
      chronTimes.push(mainExit);

      punches = createPunchesFromRawList(chronTimes);
    } else {
      // Dia sem batidas (Feriado, Descanso Semanal, Sem Registro de Ponto, etc.)
      punches = [];
    }

    days.push({
      date_raw,
      punches
    });
  }

  if (days.length === 0) return null;
  return { page: pageNumber, days };
}

/**
 * Extrator específico para o layout SIPON / POEL,C (Folha de Frequência Eletrônica).
 * Estrutura: Dia Semana Jornada Entrada Saida Ocorrencia Qtde
 * Ex: 2 - SEG 08:00 09:03 14:05 HE-BCO DE HORAS 00:13
 *                   15:12 18:36 HE-REMUNERADA 00:13
 */
function parseSiponPage(text: string, pageNumber: number): CartaoPontoPage | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const days: DayRecord[] = [];
  let currentDay: DayRecord | null = null;

  const dayStartRegex = /^(\d{1,2})\s*-\s*(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER)\b(.*)$/i;

  for (const line of lines) {
    // Ignora linhas de cabeçalho e metadados
    if (/(FOLHA DE FREQUENCIA|SISTEMA DE PONTO|SIPON|POEL|Matricula|Horario de Trabalho|Mes\/Ano|Dia\s+Semana|Número do processo|Assinado eletronicamente|Fls\.:)/i.test(line)) {
      continue;
    }

    const dayMatch = line.match(dayStartRegex);

    if (dayMatch) {
      const dayNum = dayMatch[1]!.padStart(2, '0');
      const dow = dayMatch[2]!.toUpperCase();
      const date_raw = `${dayNum} - ${dow}`;
      let rest = (dayMatch[3] || '').trim();

      // Remove textos de ocorrência e totais do final (ex: HE-BCO DE HORAS 00:13, REG. SUSPENSO 04:41)
      rest = rest.replace(/(?:HE-BCO DE HORAS|HE-REMUNERADA|HE COMPENSADA|ABN\/DEC\.CHEFIA|REG\.\s*SUSPENSO|DESTACAMENTO)(?:\s+\d{1,2}:\d{2})?/gi, '').trim();

      // Extrai horários
      let times = extractRawTimesFromText(rest);

      // Em SIPON, a coluna Jornada é '08:00'. Se houver batidas reais após ela, descarta o '08:00'
      if (times.length > 0 && times[0] === '08:00' && times.length > 1) {
        times = times.slice(1);
      } else if (times.length === 1 && times[0] === '08:00') {
        // Apenas a jornada padrão sem batidas (dia de folga / sem registro)
        times = [];
      }

      // Se o mesmo dia se repete na linha seguinte (ex: 17 - TER ... 17 - TER ...), adiciona às batidas do dia
      if (currentDay && currentDay.date_raw === date_raw) {
        const extraPunches = createPunchesFromRawList(times);
        // Ajusta kinds
        for (const p of extraPunches) {
          p.kind = currentDay.punches.length % 2 === 0 ? 'IN' : 'OUT';
          currentDay.punches.push(p);
        }
      } else {
        if (currentDay) {
          days.push(currentDay);
        }
        currentDay = {
          date_raw,
          punches: createPunchesFromRawList(times)
        };
      }
    } else if (currentDay) {
      // Linha de continuação do dia atual (ex: '15:12 18:36 HE-REMUNERADA 00:13')
      let rest = line.replace(/(?:HE-BCO DE HORAS|HE-REMUNERADA|HE COMPENSADA|ABN\/DEC\.CHEFIA|REG\.\s*SUSPENSO|DESTACAMENTO)(?:\s+\d{1,2}:\d{2})?/gi, '').trim();
      const times = extractRawTimesFromText(rest);

      if (times.length > 0) {
        const extraPunches = createPunchesFromRawList(times);
        for (const p of extraPunches) {
          p.kind = currentDay.punches.length % 2 === 0 ? 'IN' : 'OUT';
          currentDay.punches.push(p);
        }
      }
    }
  }

  if (currentDay) {
    days.push(currentDay);
  }

  if (days.length === 0) return null;
  return { page: pageNumber, days };
}

/**
 * Extrator para layout Quinzenal / Manual / Carimbado (Ex: 1.QUINZENA / 2.QUINZENA).
 * Colunas: DIAS | MANHÃ Entrada Saída | TARDE Entrada Saída | EXTRA Entrada Saída
 */
function parseQuinzenaPage(text: string, pageNumber: number): CartaoPontoPage | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const isSecondQuinzena = /2\.?\s*QUINZENA/i.test(text) || (pageNumber % 2 === 0);
  const startDay = isSecondQuinzena ? 16 : 1;
  const endDay = isSecondQuinzena ? 31 : 15;

  const daysMap = new Map<number, Punch[]>();
  for (let d = startDay; d <= endDay; d++) {
    daysMap.set(d, []);
  }

  let foundAny = false;

  for (const line of lines) {
    if (/(QUINZENA|MANHÃ|TARDE|EXTRA|DIAS|Entrada|Saída|Horas Extras)/i.test(line)) {
      continue;
    }

    // Identifica linhas que iniciam com o número do dia (1 a 31)
    const dayMatch = line.match(/^([1-3]?\d)\b(.*)$/);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1]!, 10);
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

  if (!foundAny) return null;

  const days: DayRecord[] = [];
  for (let d = startDay; d <= endDay; d++) {
    days.push({
      date_raw: String(d).padStart(2, '0'),
      punches: daysMap.get(d) || []
    });
  }

  return { page: pageNumber, days };
}

/**
 * Extrator padrão para Cartões de Ponto Colunares (com datas DD/MM/YYYY e possíveis sufixos/totais).
 */
function parseStandardColumnarPage(text: string, pageNumber: number): CartaoPontoPage {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const days: DayRecord[] = [];
  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)\b/;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);

    if (dateMatch && dateMatch[1]) {
      const date_raw = dateMatch[1];
      const dateIdx = line.indexOf(date_raw);
      let lineAfterDate = line.substring(dateIdx + date_raw.length).trim();

      // Se houver caractere '|' (separador de colunas de resumo como H.Ext, Atraso, Falta), descarta o que vem depois
      if (lineAfterDate.includes('|')) {
        lineAfterDate = lineAfterDate.split('|')[0] || '';
      }

      // Se contiver motivos de ausência sem batidas (ABONO, NATAL, ATESTADO, FERIADO, DSR, FOLGA)
      const isDayOff = /(ABONO|NATAL|ATESTADO|FERIADO|FOLGA|DSR|LICENCA|DESCANSO|CONFRATERNIZAÇÃO)/i.test(lineAfterDate);
      const times = extractRawTimesFromText(lineAfterDate);

      // Se for dia de abono/folga com apenas 1 número que representa total de abono (ex: '08:00'), descarta
      let punches: Punch[] = [];
      if (isDayOff && times.length <= 1) {
        punches = [];
      } else {
        punches = createPunchesFromRawList(times);
      }

      days.push({
        date_raw,
        punches,
      });
    }
  }

  return { page: pageNumber, days };
}

/**
 * Parser principal de Cartão de Ponto com seleção automática de estratégia por página.
 */
export function parseCartaoPonto(document: ExtractedDocument): CartaoPontoTranscription {
  const resultPages: CartaoPontoPage[] = [];

  for (const page of document.pages) {
    const text = page.text || '';

    // 1. Tenta estratégia Banco do Brasil
    if (/BANCO DO BRASIL/i.test(text) || (/Intervalo\s*1/i.test(text) && /Entrada\s*Saida/i.test(text))) {
      const bbPage = parseBancoDoBrasilPage(text, page.pageNumber);
      if (bbPage && bbPage.days.length > 0) {
        resultPages.push(bbPage);
        continue;
      }
    }

    // 2. Tenta estratégia SIPON / POEL,C
    if (/SIPON|POEL|CONSULTA PONTO ELETRONICO/i.test(text) || (/Jornada/i.test(text) && /Ocorrencia/i.test(text))) {
      const siponPage = parseSiponPage(text, page.pageNumber);
      if (siponPage && siponPage.days.length > 0) {
        resultPages.push(siponPage);
        continue;
      }
    }

    // 3. Tenta estratégia Quinzenal / Manual
    if (/QUINZENA/i.test(text) || (/MANHÃ/i.test(text) && /TARDE/i.test(text) && /EXTRA/i.test(text)) || page.isOcr) {
      const quinzenaPage = parseQuinzenaPage(text, page.pageNumber);
      if (quinzenaPage && quinzenaPage.days.length > 0) {
        resultPages.push(quinzenaPage);
        continue;
      }
    }

    // 4. Estratégia Padrão Colunar / Datas DD/MM/YYYY
    const standardPage = parseStandardColumnarPage(text, page.pageNumber);
    resultPages.push(standardPage);
  }

  return { pages: resultPages };
}
