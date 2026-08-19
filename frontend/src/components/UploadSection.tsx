import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface UploadSectionProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ onUpload, isLoading, error }) => {
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
    onUpload(selectedFile);
  };

  return (
    <div className="upload-wrapper">
      <div className="upload-card">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
          <Sparkles size={14} />
          <span>Identificação Automática de Documento</span>
        </div>

        <h1 className="upload-title">Transcrição de Documentos Trabalhistas</h1>
        <p className="upload-subtitle">
          Envie seu PDF (Cartão de Ponto ou Holerite). O sistema identifica o tipo automaticamente, executa OCR quando necessário e gera a planilha com os alertas da legislação.
        </p>

        {error && (
          <div className="badge badge-red" style={{ padding: '0.75rem 1rem', width: '100%', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            className={`dropzone ${isDragActive ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
            />
            <UploadCloud size={44} className="dropzone-icon" />
            <p style={{ fontWeight: 600, color: '#173772', fontSize: '1.05rem', marginBottom: '0.35rem' }}>
              Clique para selecionar ou arraste o PDF aqui
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '420px', margin: '0 auto' }}>
              Suporta Cartões de Ponto (Banco do Brasil, SIPON, Colunar, Mecânico) e Holerites/Recibos de Pagamento digitais ou escaneados.
            </p>
          </div>

          {selectedFile && (
            <div className="file-info-badge">
              <FileText size={16} />
              <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              <CheckCircle2 size={16} color="#10B981" />
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || isLoading}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 600 }}
            >
              {isLoading ? 'Enviando documento...' : 'Processar Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
