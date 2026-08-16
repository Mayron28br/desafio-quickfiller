import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { router as apiRouter } from './routes/transcricoes.js';
import { logInfo, logError } from './utils/security.js';
const app = express();
const PORT = process.env.PORT || 3000;
// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
// Healthcheck
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Rotas da API
app.use('/api', apiRouter);
// Servir frontend compilado
const frontendDistPath = path.resolve(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    logInfo('Server:StaticFrontend', { path: frontendDistPath });
}
// Fallback para SPA no Express 5 (qualquer rota GET que não seja /api ou /healthz)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && req.path !== '/healthz') {
        const indexPath = path.join(frontendDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
            return;
        }
    }
    next();
});
// Tratamento de 404 para rotas de API
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ erro: 'Endpoint não encontrado.' });
        return;
    }
    res.status(404).send('Página não encontrada');
});
// Middleware global de erro
app.use((err, _req, res, _next) => {
    logError('Server:GlobalError', err);
    res.status(500).json({ erro: 'Ocorreu um erro interno no servidor.' });
});
app.listen(PORT, () => {
    logInfo('Server:Started', { port: PORT, env: process.env.NODE_ENV || 'development' });
    console.log(`🚀 Servidor QuickFiller rodando em http://localhost:${PORT}`);
});
export default app;
