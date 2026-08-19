import React from 'react';
import { Loader2, FileSearch, Sparkles } from 'lucide-react';

interface ProcessingProgressProps {
  tipo: string;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({ tipo }) => {
  return (
    <div className="upload-wrapper">
      <div className="progress-card">
        <div className="spinner" />
        <h2 style={{ color: '#173772', fontSize: '1.35rem', marginBottom: '0.5rem', fontWeight: 700 }}>
          {tipo === 'cartao-ponto' ? 'Processando Cartão de Ponto...' : tipo === 'holerite' ? 'Processando Holerite...' : 'Identificando e Processando Documento...'}
        </h2>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          Identificando layout, executando OCR em páginas escaneadas e estruturando dados.
        </p>

        <div style={{ textAlign: 'left', background: '#F8FAFC', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: '#1E293B' }}>
            <Loader2 size={16} className="animate-spin" color="#173772" />
            <span>Extraindo texto e segmentando páginas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: '#64748B' }}>
            <FileSearch size={16} />
            <span>Mapeando batidas e campos de verbas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: '#64748B' }}>
            <Sparkles size={16} />
            <span>Calculando validações e alertas dinâmicos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
