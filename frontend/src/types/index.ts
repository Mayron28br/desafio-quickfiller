export type DocumentType = 'cartao-ponto' | 'holerite';
export type JobStatus = 'processando' | 'concluido' | 'erro';
export type PunchKind = 'IN' | 'OUT';

export interface Punch {
  kind: PunchKind;
  time_raw: string;
  time_hhmm: string;
}

export interface RegistroCartaoPonto {
  dia: number | string;
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entradaExtra?: string;
  saidaExtra?: string;
  batidas?: Punch[];
}

export interface DayRecord {
  date_raw: string;
  punches: Punch[];
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entradaExtra?: string;
  saidaExtra?: string;
}

export interface CartaoPontoPage {
  page: number;
  days: DayRecord[];
}

export interface CartaoPontoTranscription {
  pages: CartaoPontoPage[];
}

export interface HoleriteField {
  code: string;
  label: string;
  reference: string;
  value: string;
}

export interface HoleriteBase {
  label: string;
  value: string;
}

export interface HoleritePage {
  page: number;
  year: string;
  month: string;
  fields: HoleriteField[];
  bases: HoleriteBase[];
}

export interface HoleriteTranscription {
  pages: HoleritePage[];
}

export type TranscriptionValue = CartaoPontoTranscription | HoleriteTranscription;

export interface TranscriptionJobResponse {
  id: string;
  tipo: DocumentType;
  status: JobStatus;
  erro: string | null;
  value: TranscriptionValue | null;
}

export type AlertLevel = 'yellow' | 'red' | null;

export interface RowAlert {
  level: AlertLevel;
  reasons: string[];
}
