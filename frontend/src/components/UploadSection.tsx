import React, { useState, useRef } from 'react';
import type { DocumentType } from '../types/index';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface UploadSectionProps {
  onUpload: (file: File, tipo: DocumentType) => void;
  isLoading: boolean;
  error: string | null;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ onUpload, isLoading, error }) => {
  const [tipo, setTipo] = useState<DocumentType>('cartao-ponto');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
      } else {
        alert('Por favor, selecione apenas arquivos no formato PDF.');
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
      } else {
        alert('Por favor, selecione apenas arquivos no formato PDF.');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    onUpload(selectedFile, tipo);
  };

  return (
    <div className="upload-wrapper">
      <div className="upload-card">
        <h1 className="upload-title">Transcrição de Documentos Trabalhistas</h1>
        <p className="upload-subtitle">
          Envie cartões de ponto ou holerites em PDF para extrair, revisar e exportar planilhas estruturadas.
        </p>

        {error && (
          <div className="badge badge-red" style={{ padding: '0.75rem 1rem', width: '100%', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="type-selector">
            <div
              className={`type-option ${tipo === 'cartao-ponto' ? 'selected' : ''}`}
              onClick={() => setTipo('cartao-ponto')}
            >
              <span className="type-option-title">Cartão de Ponto</span>
              <span className="type-option-desc">Jornada diária, batidas em pares Entrada/Saída</span>
            </div>

            <div
              className={`type-option ${tipo === 'holerite' ? 'selected' : ''}`}
              onClick={() => setTipo('holerite')}
            >
              <span className="type-option-title">Holerite</span>
              <span className="type-option-desc">Demonstrativo de pagamento, verbas e bases</span>
            </div>
          </div>

          <div
            className={`dropzone ${isDragActive ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
            />
            <UploadCloud size={40} className="dropzone-icon" />
            <p style={{ fontWeight: 600, color: '#173772', marginBottom: '0.25rem' }}>
              Clique para selecionar ou arraste o PDF aqui
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
              Suporta PDFs digitais e escaneados (OCR automático) até 20MB
            </p>
          </div>

          {selectedFile && (
            <div className="file-info-badge">
              <FileText size={16} />
              <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              <CheckCircle2 size={16} color="#10B981" />
            </div>
          )}

          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || isLoading}
              style={{ width: '100%', padding: '0.8rem' }}
            >
              {isLoading ? 'Enviando documento...' : 'Processar Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
