import { useState, useEffect, useRef } from 'react';
import type { DocumentType, CartaoPontoTranscription, HoleriteTranscription, TranscriptionJobResponse, TranscriptionValue } from './types/index';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { ProcessingProgress } from './components/ProcessingProgress';
import { PdfViewer } from './components/PdfViewer';
import { CartaoPontoTable } from './components/CartaoPontoTable';
import { HoleriteTable } from './components/HoleriteTable';
import { HistoryModal, type HistoryItem } from './components/HistoryModal';
import { CheckCircle2 } from 'lucide-react';

const HISTORY_STORAGE_KEY = 'quickfiller_recent_history';

export function App() {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('documento.pdf');
  const [tipo, setTipo] = useState<DocumentType | null>(null);
  const [data, setData] = useState<TranscriptionValue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Histórico de transcrições da sessão
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Salva histórico no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Erro ao salvar histórico local:', e);
    }
  }, [history]);

  // Listener de atalhos globais de teclado (Ctrl + S para salvar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (step === 'review' && !isSaving && transcriptionId && data) {
          handleSave();
        }
      }
      if (e.key === 'Escape' && isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isSaving, transcriptionId, data, isHistoryOpen]);

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setTipo(null);
    setCurrentFilename(file.name);

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('tipo', 'auto');

      const res = await fetch('/api/transcricoes', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ erro: 'Falha no envio do arquivo.' }));
        throw new Error(errJson.erro || 'Erro ao enviar documento.');
      }

      const { id } = await res.json();
      setTranscriptionId(id);
      setStep('processing');
      startPolling(id, file.name);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão com o servidor.');
      setIsLoading(false);
    }
  };

  const startPolling = (id: string, filename: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcricoes/${id}`);
        if (!res.ok) return;

        const job: TranscriptionJobResponse = await res.json();

        if (job.status === 'concluido' && job.value) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setTipo(job.tipo);
          setData(job.value);
          setStep('review');
          setIsLoading(false);

          // Adiciona ao histórico recente
          setHistory(prev => {
            const filtered = prev.filter(item => item.id !== id);
            const newItem: HistoryItem = {
              id,
              filename: filename || 'documento.pdf',
              tipo: job.tipo,
              timestamp: new Date().toISOString(),
              pagesCount: job.value ? (job.value as any).pages?.length : 1,
            };
            return [newItem, ...filtered].slice(0, 15);
          });
        } else if (job.status === 'erro') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setError(job.erro || 'Ocorreu um erro durante o processamento do documento.');
          setStep('upload');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Erro no polling:', err);
      }
    }, 1200);
  };

  const handleSelectHistoryItem = async (item: HistoryItem) => {
    setIsHistoryOpen(false);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transcricoes/${item.id}`);
      if (!res.ok) throw new Error('Não foi possível carregar a transcrição do histórico.');

      const job: TranscriptionJobResponse = await res.json();
      if (job.status === 'concluido' && job.value) {
        setTranscriptionId(item.id);
        setCurrentFilename(item.filename);
        setTipo(job.tipo);
        setData(job.value);
        setStep('review');
      } else {
        throw new Error('Esta transcrição expirou ou não está mais disponível.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar item do histórico.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  };

  const handleSave = async () => {
    if (!transcriptionId || !data) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/transcricoes/${transcriptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: data }),
      });

      if (!res.ok) {
        throw new Error('Falha ao salvar as alterações.');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (formato: 'xlsx' | 'csv' | 'json') => {
    if (!transcriptionId) return;
    window.open(`/api/transcricoes/${transcriptionId}/planilha?formato=${formato}`, '_blank');
  };

  const handleReset = () => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    setStep('upload');
    setTranscriptionId(null);
    setTipo(null);
    setData(null);
    setError(null);
  };

  return (
    <div className="app-container">
      <Header
        tipo={tipo}
        transcriptionId={transcriptionId}
        isSaving={isSaving}
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onSave={handleSave}
        onReset={handleReset}
        onDownload={handleDownload}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleSelectHistoryItem}
        onClear={handleClearHistory}
      />

      <main className="main-content">
        {step === 'upload' && (
          <UploadSection
            onUpload={handleUpload}
            isLoading={isLoading}
            error={error}
          />
        )}

        {step === 'processing' && (
          <ProcessingProgress tipo={tipo || 'auto'} />
        )}

        {step === 'review' && transcriptionId && data && tipo && (
          <div className="split-container">
            <PdfViewer transcriptionId={transcriptionId} />

            <div className="pane-table">
              <div className="table-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#173772' }}>
                    Revisão: <span style={{ fontWeight: 500, color: '#64748B', fontSize: '0.9rem' }}>{currentFilename}</span>
                  </h2>
                  {saveSuccess && (
                    <span className="badge" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                      <CheckCircle2 size={13} />
                      <span>Salvo! (Ctrl+S)</span>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: '#64748B' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#FFF3CD', border: '1px solid #FFEBAA', borderRadius: '2px' }}></span>
                    Aviso / Batida Ímpar / ?
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#F8D7DA', borderLeft: '2px solid #DC3545', borderRadius: '2px' }}></span>
                    Não Sequencial
                  </span>
                </div>
              </div>

              {tipo === 'cartao-ponto' ? (
                <CartaoPontoTable
                  data={data as CartaoPontoTranscription}
                  onChange={(newData) => setData(newData)}
                />
              ) : (
                <HoleriteTable
                  data={data as HoleriteTranscription}
                  onChange={(newData) => setData(newData)}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
