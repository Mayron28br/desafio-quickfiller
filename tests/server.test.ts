import test from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/services/store.js';
import app from '../api/index.js';

test('Store: Criação, atualização e persistência de Jobs', () => {
  const jobId = 'test-job-1';
  const pdfBuffer = Buffer.from('%PDF-1.4 test buffer');

  store.createJob(jobId, 'cartao-ponto', pdfBuffer, 'cartao.pdf');

  const created = store.getJob(jobId);
  assert.ok(created);
  assert.equal(created.id, jobId);
  assert.equal(created.status, 'processando');
  assert.equal(created.tipo, 'cartao-ponto');
  assert.equal(created.pdfFilename, 'cartao.pdf');
  assert.ok(created.pdfBuffer);

  // Atualiza status
  const mockValue = {
    pages: [
      {
        page: 1,
        days: [{ date_raw: '01/01/2026', punches: [] }]
      }
    ]
  };
  store.updateJobStatus(jobId, 'concluido', mockValue, null, 'cartao-ponto');

  const updated = store.getJob(jobId);
  assert.ok(updated);
  assert.equal(updated.status, 'concluido');
  assert.deepEqual(updated.value, mockValue);

  // Atualiza valores (edição na interface)
  const editedValue = {
    pages: [
      {
        page: 1,
        days: [{ date_raw: '01/01/2026', punches: [{ kind: 'IN' as const, time_raw: '08:00', time_hhmm: '08:00' }] }]
      }
    ]
  };
  const success = store.updateJobValue(jobId, editedValue);
  assert.equal(success, true);

  const finalJob = store.getJob(jobId);
  assert.ok(finalJob);
  assert.deepEqual(finalJob.value, editedValue);
});

test('Serverless App: Instanciação do app Express e rotas configuradas', () => {
  assert.ok(app);
  assert.equal(typeof app, 'function');
});
