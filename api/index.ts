import express, { Request, Response } from 'express';
import cors from 'cors';
import { router as apiRouter } from '../src/routes/transcricoes.js';
import { logError } from '../src/utils/security.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Healthchecks
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), env: 'vercel-serverless' });
});

app.get('/api/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), env: 'vercel-serverless' });
});

// Rotas da API (atende tanto /api/* quanto /* caso o rewrite remova o prefixo)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Tratamento de 404 para rotas de API
app.use((req: Request, res: Response) => {
  res.status(404).json({ erro: `Endpoint não encontrado: ${req.method} ${req.url}` });
});

// Middleware global de erro
app.use((err: any, _req: Request, res: Response, _next: any) => {
  logError('Serverless:GlobalError', err);
  res.status(500).json({ erro: 'Ocorreu um erro interno no servidor.' });
});

export default app;
