import React from 'react';
import { Clock, FileText, X, ArrowRight, Trash2 } from 'lucide-react';
import type { DocumentType } from '../types/index';

export interface HistoryItem {
  id: string;
  filename: string;
  tipo: DocumentType;
  timestamp: string;
  pagesCount?: number;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '560px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Clock size={20} color="#173772" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#173772', margin: 0 }}>
              Histórico de Transcrições
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              padding: '0.25rem',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {history.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94A3B8' }}>
              <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>Nenhum documento recente nesta sessão.</p>
              <p style={{ fontSize: '0.8rem', color: '#CBD5E1', marginTop: '0.25rem' }}>
                Os documentos processados aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: '#F8FAFC',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                    e.currentTarget.style.borderColor = '#BFDBFE';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.9rem' }}>
                        {item.filename}
                      </span>
                      <span className="badge" style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.45rem',
                        backgroundColor: item.tipo === 'cartao-ponto' ? '#E0F2FE' : '#FEF3C7',
                        color: item.tipo === 'cartao-ponto' ? '#0369A1' : '#92400E',
                      }}>
                        {item.tipo === 'cartao-ponto' ? 'Cartão de Ponto' : 'Holerite'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                      ID: {item.id} • {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', color: '#173772' }}>
                    <ArrowRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
          }}>
            <button
              className="btn btn-outline"
              onClick={onClear}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#DC3545', borderColor: '#FCA5A5' }}
            >
              <Trash2 size={13} />
              <span>Limpar Histórico</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={onClose}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
