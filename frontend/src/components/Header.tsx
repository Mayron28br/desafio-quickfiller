import React, { useState } from 'react';
import type { DocumentType } from '../types/index';
import { Download, Save, FileSpreadsheet, RefreshCw, FileText, History } from 'lucide-react';

interface HeaderProps {
  tipo: DocumentType | null;
  transcriptionId: string | null;
  isSaving: boolean;
  historyCount?: number;
  onOpenHistory?: () => void;
  onSave: () => void;
  onReset: () => void;
  onDownload: (formato: 'xlsx' | 'csv' | 'json') => void;
}

export const Header: React.FC<HeaderProps> = ({
  tipo,
  transcriptionId,
  isSaving,
  historyCount = 0,
  onOpenHistory,
  onSave,
  onReset,
  onDownload,
}) => {
  const [downloadOpen, setDownloadOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="brand-container">
        <div className="brand-logo">QF</div>
        <span className="brand-title">QuickFiller</span>
        {tipo && (
          <span className="badge" style={{ backgroundColor: '#EBF2FF', color: '#173772', border: '1px solid #C7D9FB' }}>
            {tipo === 'cartao-ponto' ? 'Cartão de Ponto' : 'Holerite'}
          </span>
        )}
      </div>

      <div className="header-actions">
        {onOpenHistory && (
          <button
            className="btn btn-outline"
            onClick={onOpenHistory}
            title="Ver histórico de transcrições da sessão"
            style={{ position: 'relative' }}
          >
            <History size={15} />
            <span>Histórico</span>
            {historyCount > 0 && (
              <span style={{
                background: '#173772',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.1rem 0.4rem',
                borderRadius: '9999px',
                marginLeft: '2px',
              }}>
                {historyCount}
              </span>
            )}
          </button>
        )}

        {transcriptionId && (
          <>
            <button className="btn btn-outline" onClick={onReset} title="Novo Envio">
              <RefreshCw size={15} />
              <span>Novo Envio</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={onSave}
              disabled={isSaving}
              title="Salvar alterações (Atalho: Ctrl + S)"
            >
              <Save size={15} />
              <span>{isSaving ? 'Salvando...' : 'Salvar (Ctrl+S)'}</span>
            </button>

          <div className="dropdown-container">
            <button
              className="btn btn-success"
              onClick={() => setDownloadOpen(!downloadOpen)}
            >
              <Download size={15} />
              <span>Baixar Planilha</span>
            </button>

            {downloadOpen && (
              <div className="dropdown-menu">
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onDownload('xlsx');
                    setDownloadOpen(false);
                  }}
                >
                  <FileSpreadsheet size={16} color="#107C41" />
                  <span>Excel (.xlsx) — Formatado</span>
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onDownload('csv');
                    setDownloadOpen(false);
                  }}
                >
                  <FileText size={16} color="#0078D4" />
                  <span>CSV (.csv)</span>
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onDownload('json');
                    setDownloadOpen(false);
                  }}
                >
                  <FileText size={16} color="#D83B01" />
                  <span>JSON (.json)</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </header>
  );
};
