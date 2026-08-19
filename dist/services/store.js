import { logInfo } from '../utils/security.js';
class TranscriptionStore {
    jobs = new Map();
    TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
    constructor() {
        // Executa limpeza periódica a cada hora (unref para não segurar o event loop)
        const timer = setInterval(() => this.cleanupExpired(), 60 * 60 * 1000);
        if (timer.unref)
            timer.unref();
    }
    createJob(id, tipo, pdfBuffer, pdfFilename) {
        const job = {
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
        logInfo('Store:CreateJob', { id, tipo });
        return job;
    }
    getJob(id) {
        return this.jobs.get(id);
    }
    updateJobStatus(id, status, value, erro = null, tipo) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        if (tipo) {
            job.tipo = tipo;
        }
        job.status = status;
        job.value = value;
        job.erro = erro;
        job.updatedAt = new Date();
        logInfo('Store:UpdateJobStatus', { id, status, tipo: job.tipo, hasError: !!erro });
    }
    updateJobValue(id, value) {
        const job = this.jobs.get(id);
        if (!job)
            return false;
        job.value = value;
        job.updatedAt = new Date();
        logInfo('Store:UpdateJobValue', { id });
        return true;
    }
    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [id, job] of this.jobs.entries()) {
            if (now - job.createdAt.getTime() > this.TTL_MS) {
                this.jobs.delete(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logInfo('Store:Cleanup', { removedCount: cleaned });
        }
    }
}
export const store = new TranscriptionStore();
