import React, { useState } from 'react';
import type { HoleriteField, HoleriteTranscription } from '../types/index';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface HoleriteTableProps {
  data: HoleriteTranscription;
  onChange: (newData: HoleriteTranscription) => void;
}

export const HoleriteTable: React.FC<HoleriteTableProps> = ({ data, onChange }) => {
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);

  const currentPage = data.pages[selectedPageIdx] || data.pages[0];

  const handlePageChange = (pageIdx: number, fieldName: 'month' | 'year', val: string) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    page[fieldName] = val;
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleFieldChange = (pageIdx: number, fieldIdx: number, key: keyof HoleriteField, val: string) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    const fields = [...page.fields];
    fields[fieldIdx] = { ...fields[fieldIdx]!, [key]: val };
    page.fields = fields;
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleAddField = (pageIdx: number) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    page.fields = [...page.fields, { code: '', label: 'Nova Verba', reference: '', value: '0,00' }];
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleRemoveField = (pageIdx: number, fieldIdx: number) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    page.fields = page.fields.filter((_, idx) => idx !== fieldIdx);
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleBaseChange = (pageIdx: number, baseIdx: number, key: 'label' | 'value', val: string) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    const bases = [...page.bases];
    bases[baseIdx] = { ...bases[baseIdx]!, [key]: val };
    page.bases = bases;
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleAddBase = (pageIdx: number) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    page.bases = [...page.bases, { label: 'Nova Base / Total', value: '0,00' }];
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const handleRemoveBase = (pageIdx: number, baseIdx: number) => {
    const updatedPages = [...data.pages];
    const page = { ...updatedPages[pageIdx]! };
    page.bases = page.bases.filter((_, idx) => idx !== baseIdx);
    updatedPages[pageIdx] = page;
    onChange({ pages: updatedPages });
  };

  const getPageAlert = (pageIdx: number) => {
    const page = data.pages[pageIdx]!;
    let isYellow = false;
    let isRed = false;
    const reasons: string[] = [];

    if (page.fields.length === 0 && page.bases.length === 0) {
      isYellow = true;
      reasons.push('Página sem dados extraídos');
    }

    const hasUncertainty = page.month.includes('?') || page.year.includes('?') ||
      page.fields.some(f => f.label.includes('?') || f.value.includes('?')) ||
      page.bases.some(b => b.label.includes('?') || b.value.includes('?'));
    if (hasUncertainty) {
      isYellow = true;
      reasons.push('Caractere incerto (?) na página');
    }

    if (pageIdx > 0) {
      const prevPage = data.pages[pageIdx - 1]!;
      const prevM = parseInt(prevPage.month, 10);
      const prevY = parseInt(prevPage.year, 10);
      const currM = parseInt(page.month, 10);
      const currY = parseInt(page.year, 10);

      if (!isNaN(prevM) && !isNaN(prevY) && !isNaN(currM) && !isNaN(currY)) {
        const expectedM = prevM === 12 ? 1 : prevM + 1;
        const expectedY = prevM === 12 ? prevY + 1 : prevY;
        if (currM !== expectedM || currY !== expectedY) {
          isRed = true;
          reasons.push(`Competência não sequencial (${page.month}/${page.year} esperava ${String(expectedM).padStart(2, '0')}/${expectedY})`);
        }
      }
    }

    if (isRed) return { level: 'red' as const, reasons };
    if (isYellow) return { level: 'yellow' as const, reasons };
    return { level: null, reasons: [] };
  };

  if (!currentPage) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Nenhuma página de holerite encontrada.</div>;
  }

  const alert = getPageAlert(selectedPageIdx);

  return (
    <div className="table-scroll-area">
      {/* Navegação entre páginas do Holerite */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>Páginas:</span>
        {data.pages.map((p, idx) => {
          const pageAlert = getPageAlert(idx);
          return (
            <button
              key={p.page}
              className={`btn ${selectedPageIdx === idx ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem', position: 'relative' }}
              onClick={() => setSelectedPageIdx(idx)}
            >
              <span>Página {p.page} ({p.month || '?'}/{p.year || '?'})</span>
              {pageAlert.level && (
                <span style={{ marginLeft: '4px', display: 'inline-flex' }}>
                  <AlertTriangle size={12} color={pageAlert.level === 'red' ? '#DC3545' : '#D97706'} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Cabeçalho da Competência */}
      <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#64748B', display: 'block', marginBottom: '0.2rem' }}>Mês:</label>
          <input
            type="text"
            className="cell-input"
            style={{ width: '80px', background: 'white', border: '1px solid #CBD5E1' }}
            value={currentPage.month}
            onChange={(e) => handlePageChange(selectedPageIdx, 'month', e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#64748B', display: 'block', marginBottom: '0.2rem' }}>Ano:</label>
          <input
            type="text"
            className="cell-input"
            style={{ width: '100px', background: 'white', border: '1px solid #CBD5E1' }}
            value={currentPage.year}
            onChange={(e) => handlePageChange(selectedPageIdx, 'year', e.target.value)}
          />
        </div>

        {alert.level && (
          <div className={`badge badge-${alert.level}`} style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem' }}>
            <AlertTriangle size={14} />
            <span>{alert.reasons.join(' | ')}</span>
          </div>
        )}
      </div>

      {/* Tabela de Verbas (fields) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#173772' }}>
            Tabela de Verbas (Vencimentos e Descontos)
          </h3>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => handleAddField(selectedPageIdx)}>
            <Plus size={13} />
            <span>Adicionar Verba</span>
          </button>
        </div>

        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Código</th>
              <th>Descrição da Verba</th>
              <th style={{ width: '100px' }}>Referência</th>
              <th style={{ width: '120px' }}>Valor (R$)</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {currentPage.fields.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', color: '#94A3B8' }}>Nenhuma verba cadastrada nesta página.</td>
              </tr>
            ) : (
              currentPage.fields.map((field, fIdx) => (
                <tr key={fIdx}>
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      value={field.code}
                      placeholder="0000"
                      onChange={(e) => handleFieldChange(selectedPageIdx, fIdx, 'code', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      style={{ textAlign: 'left' }}
                      value={field.label}
                      onChange={(e) => handleFieldChange(selectedPageIdx, fIdx, 'label', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      value={field.reference}
                      placeholder="--"
                      onChange={(e) => handleFieldChange(selectedPageIdx, fIdx, 'reference', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      style={{ fontWeight: 600 }}
                      value={field.value}
                      onChange={(e) => handleFieldChange(selectedPageIdx, fIdx, 'value', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.2rem 0.35rem', color: '#DC3545' }}
                      onClick={() => handleRemoveField(selectedPageIdx, fIdx)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Seção de Bases e Totais (bases) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#173772' }}>
            Bases de Cálculo e Totais (Rodapé)
          </h3>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => handleAddBase(selectedPageIdx)}>
            <Plus size={13} />
            <span>Adicionar Base/Total</span>
          </button>
        </div>

        <table className="custom-table">
          <thead>
            <tr>
              <th>Rótulo da Base / Total</th>
              <th style={{ width: '150px' }}>Valor (R$)</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {currentPage.bases.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '1rem', color: '#94A3B8' }}>Nenhuma base ou total extraído.</td>
              </tr>
            ) : (
              currentPage.bases.map((base, bIdx) => (
                <tr key={bIdx}>
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      style={{ textAlign: 'left' }}
                      value={base.label}
                      onChange={(e) => handleBaseChange(selectedPageIdx, bIdx, 'label', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="cell-input"
                      style={{ fontWeight: 600 }}
                      value={base.value}
                      onChange={(e) => handleBaseChange(selectedPageIdx, bIdx, 'value', e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.2rem 0.35rem', color: '#DC3545' }}
                      onClick={() => handleRemoveBase(selectedPageIdx, bIdx)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
