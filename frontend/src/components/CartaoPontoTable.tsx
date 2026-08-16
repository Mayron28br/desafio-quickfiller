import React from 'react';
import type { CartaoPontoTranscription, PunchKind } from '../types/index';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface CartaoPontoTableProps {
  data: CartaoPontoTranscription;
  onChange: (newData: CartaoPontoTranscription) => void;
}

export const CartaoPontoTable: React.FC<CartaoPontoTableProps> = ({ data, onChange }) => {
  let maxPunches = 0;
  data.pages.forEach(p => {
    p.days.forEach(d => {
      if (d.punches.length > maxPunches) maxPunches = d.punches.length;
    });
  });
  const numPairs = Math.max(1, Math.ceil(maxPunches / 2));

  const handleDateChange = (pageIdx: number, dayIdx: number, newDate: string) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    const days = [...page.days];
    days[dayIdx] = { ...days[dayIdx]!, date_raw: newDate };
    page.days = days;
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handlePunchChange = (pageIdx: number, dayIdx: number, punchIdx: number, newTime: string) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    const days = [...page.days];
    const day = { ...days[dayIdx]! };
    const punches = [...day.punches];

    const kind: PunchKind = punchIdx % 2 === 0 ? 'IN' : 'OUT';
    punches[punchIdx] = {
      kind,
      time_raw: newTime,
      time_hhmm: newTime,
    };

    day.punches = punches;
    days[dayIdx] = day;
    page.days = days;
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleAddPunch = (pageIdx: number, dayIdx: number) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    const days = [...page.days];
    const day = { ...days[dayIdx]! };
    const punches = [...day.punches];

    const kind: PunchKind = punches.length % 2 === 0 ? 'IN' : 'OUT';
    punches.push({ kind, time_raw: '00:00', time_hhmm: '00:00' });

    day.punches = punches;
    days[dayIdx] = day;
    page.days = days;
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleRemoveDay = (pageIdx: number, dayIdx: number) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    page.days = page.days.filter((_, idx) => idx !== dayIdx);
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const getRowAlert = (pageIdx: number, dayIdx: number) => {
    const page = data.pages[pageIdx]!;
    const day = page.days[dayIdx]!;
    let isYellow = false;
    let isRed = false;
    const reasons: string[] = [];

    if (day.punches.length % 2 !== 0) {
      isYellow = true;
      reasons.push('Número ímpar de batidas');
    }

    const hasUncertainty = day.date_raw.includes('?') || day.punches.some(p => p.time_raw.includes('?') || p.time_hhmm.includes('?'));
    if (hasUncertainty) {
      isYellow = true;
      reasons.push('Caractere incerto (?) na linha');
    }

    if (dayIdx > 0 || pageIdx > 0) {
      let prevDayDate = '';
      if (dayIdx > 0) {
        prevDayDate = page.days[dayIdx - 1]!.date_raw;
      } else {
        const prevPage = data.pages[pageIdx - 1];
        if (prevPage && prevPage.days.length > 0) {
          prevDayDate = prevPage.days[prevPage.days.length - 1]!.date_raw;
        }
      }

      if (prevDayDate && !prevDayDate.includes('?') && !day.date_raw.includes('?')) {
        const prevParts = prevDayDate.split(/[\/\-\.]/).map(p => parseInt(p, 10));
        const currParts = day.date_raw.split(/[\/\-\.]/).map(p => parseInt(p, 10));

        if (prevParts[0] && currParts[0] && prevParts[1] && currParts[1]) {
          const prevD = new Date(prevParts[2] || 2026, prevParts[1] - 1, prevParts[0]);
          const currD = new Date(currParts[2] || 2026, currParts[1] - 1, currParts[0]);
          const diffDays = Math.round((currD.getTime() - prevD.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays !== 1 && diffDays !== 0) {
            isRed = true;
            reasons.push(`Data não sequencial (${day.date_raw} após ${prevDayDate})`);
          }
        }
      }
    }

    if (isRed) return { level: 'red' as const, reasons };
    if (isYellow) return { level: 'yellow' as const, reasons };
    return { level: null, reasons: [] };
  };

  return (
    <div className="table-scroll-area">
      <table className="custom-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>Pág.</th>
            <th style={{ width: '130px' }}>Data</th>
            {Array.from({ length: numPairs }).map((_, i) => (
              <React.Fragment key={i}>
                <th>Entrada {i + 1}</th>
                <th>Saída {i + 1}</th>
              </React.Fragment>
            ))}
            <th style={{ width: '80px' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.pages.map((page, pageIdx) =>
            page.days.map((day, dayIdx) => {
              const alert = getRowAlert(pageIdx, dayIdx);
              const rowClass = alert.level === 'red' ? 'row-red' : alert.level === 'yellow' ? 'row-yellow' : '';

              return (
                <tr key={`${page.page}-${dayIdx}`} className={rowClass}>
                  <td style={{ fontSize: '0.8rem', color: '#64748B' }}>{page.page}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="text"
                        className="cell-input"
                        value={day.date_raw}
                        onChange={(e) => handleDateChange(pageIdx, dayIdx, e.target.value)}
                      />
                      {alert.level && (
                        <span title={alert.reasons.join(', ')} style={{ cursor: 'help' }}>
                          <AlertTriangle
                            size={14}
                            color={alert.level === 'red' ? '#DC3545' : '#D97706'}
                          />
                        </span>
                      )}
                    </div>
                  </td>

                  {Array.from({ length: numPairs * 2 }).map((_, punchSlotIdx) => {
                    const punch = day.punches[punchSlotIdx];
                    return (
                      <td key={punchSlotIdx}>
                        <input
                          type="text"
                          className="cell-input"
                          placeholder="--:--"
                          value={punch ? (punch.time_hhmm || punch.time_raw) : ''}
                          onChange={(e) => handlePunchChange(pageIdx, dayIdx, punchSlotIdx, e.target.value)}
                        />
                      </td>
                    );
                  })}

                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                        title="Adicionar Batida"
                        onClick={() => handleAddPunch(pageIdx, dayIdx)}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', color: '#DC3545' }}
                        title="Remover Linha"
                        onClick={() => handleRemoveDay(pageIdx, dayIdx)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
