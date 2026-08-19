import path from 'path';
import fs from 'fs';
import os from 'os';
import { DocumentType, JobStatus, TranscriptionJob, TranscriptionValue } from '../types/index.js';
import { logInfo, logError } from '../utils/security.js';

const TEMP_STORE_DIR = path.join(os.tmpdir(), 'quickfiller_store');

// Garante que o diretório temporário exista
try {
  if (!fs.existsSync(TEMP_STORE_DIR)) {
    fs.mkdirSync(TEMP_STORE_DIR, { recursive: true });
  }
} catch (e) {
  logError('Store:MkdirError', e);
}

class TranscriptionStore {
  private jobs: Map<string, TranscriptionJob> = new Map();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  constructor() {
    // Executa limpeza periódica a cada hora (unref para não segurar o event loop)
    const timer = setInterval(() => this.cleanupExpired(), 60 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  private getJobJsonPath(id: string): string {
    return path.join(TEMP_STORE_DIR, `${id}.json`);
  }

  private getJobPdfPath(id: string): string {
    return path.join(TEMP_STORE_DIR, `${id}.pdf`);
  }

  private persistJobToDisk(job: TranscriptionJob): void {
    try {
      const serializable = {
        id: job.id,
        tipo: job.tipo,
        status: job.status,
        erro: job.erro,
        value: job.value,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        pdfFilename: job.pdfFilename,
      };
      fs.writeFileSync(this.getJobJsonPath(job.id), JSON.stringify(serializable), 'utf-8');

      if (job.pdfBuffer) {
        fs.writeFileSync(this.getJobPdfPath(job.id), job.pdfBuffer);
      }
    } catch (err) {
      logError('Store:PersistDiskError', err);
    }
  }

  private loadJobFromDisk(id: string): TranscriptionJob | undefined {
    try {
      const jsonPath = this.getJobJsonPath(id);
      if (!fs.existsSync(jsonPath)) return undefined;

      const rawJson = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(rawJson);

      let pdfBuffer: Buffer | undefined;
      const pdfPath = this.getJobPdfPath(id);
      if (fs.existsSync(pdfPath)) {
        pdfBuffer = fs.readFileSync(pdfPath);
      }

      const job: TranscriptionJob = {
        id: data.id,
        tipo: data.tipo,
        status: data.status,
        erro: data.erro,
        value: data.value,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        pdfFilename: data.pdfFilename,
        pdfBuffer,
      };

      this.jobs.set(id, job);
      return job;
    } catch (err) {
      logError('Store:LoadDiskError', err);
      return undefined;
    }
  }

  public createJob(id: string, tipo: DocumentType, pdfBuffer?: Buffer, pdfFilename?: string): TranscriptionJob {
    const job: TranscriptionJob = {
      id,
      tipo,
      status: 'processando',
      erro: null,
      value: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      pdfBuffer,
      pdfFilename,
    };
    this.jobs.set(id, job);
    this.persistJobToDisk(job);
    logInfo('Store:CreateJob', { id, tipo });
    return job;
  }

  public getJob(id: string): TranscriptionJob | undefined {
    const inMemory = this.jobs.get(id);
    if (inMemory) return inMemory;

    return this.loadJobFromDisk(id);
  }

  public updateJobStatus(
    id: string,
    status: JobStatus,
    value: TranscriptionValue | null,
    erro: string | null = null,
    tipo?: DocumentType
  ): void {
    let job = this.getJob(id);
    if (!job) return;

    if (tipo) {
      job.tipo = tipo;
    }
    job.status = status;
    job.value = value;
    job.erro = erro;
    job.updatedAt = new Date();

    this.jobs.set(id, job);
    this.persistJobToDisk(job);
    logInfo('Store:UpdateJobStatus', { id, status, tipo: job.tipo, hasError: !!erro });
  }

  public updateJobValue(id: string, value: TranscriptionValue): boolean {
    const job = this.getJob(id);
    if (!job) return false;

    job.value = value;
    job.updatedAt = new Date();
    this.jobs.set(id, job);
    this.persistJobToDisk(job);
    logInfo('Store:UpdateJobValue', { id });
    return true;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt.getTime() > this.TTL_MS) {
        this.jobs.delete(id);
        try {
          const jsonPath = this.getJobJsonPath(id);
          const pdfPath = this.getJobPdfPath(id);
          if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
          if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        } catch {}
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logInfo('Store:Cleanup', { removedCount: cleaned });
    }
  }
}

export const store = new TranscriptionStore();
