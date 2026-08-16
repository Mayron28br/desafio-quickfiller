import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';

interface PdfViewerProps {
  transcriptionId: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ transcriptionId }) => {
  const pdfUrl = `/api/transcricoes/${transcriptionId}/pdf`;

  return (
    <div className="pane-pdf">
      <div style={{ padding: '0.6rem 1rem', background: '#334155', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <FileText size={16} />
          <span>Documento Original (PDF)</span>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontSize: '0.8rem' }}
        >
          <span>Abrir em nova aba</span>
          <ExternalLink size={13} />
        </a>
      </div>

      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <iframe
          src={pdfUrl}
          title="PDF Original"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  );
};
