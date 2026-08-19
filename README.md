# ⚡ QuickFiller — Transcrição Inteligente de Cartões de Ponto e Holerites

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)

Aplicação web completa e de alta performance para transcrição automática, revisão assistida e exportação de documentos trabalhistas (**Cartões de Ponto** e **Holerites**) em formatos tabulares estruturados (`.xlsx`, `.csv`, `.json`).

---

## 🌟 Principais Recursos

- **Pipeline Unificado com Auto-Detecção**: Envio por painel único com Drag & Drop. O sistema detecta automaticamente se o documento é Cartão de Ponto ou Holerite.
- **Extração Híbrida (Vetorial + OCR)**:
  - Leitura vetorial de PDFs nativos com ordenação espacial via Bounding Boxes.
  - Fallback automático para OCR com binarização adaptativa de Otsu para digitalizações e imagens.
  - Tratamento inteligente de cabeçalhos e rodapés de assinatura eletrônica do PJe.
- **Multi-Layout & Parsers Especializados**:
  - *Cartão de Ponto*: Banco do Brasil, SIPON / POEL,C, Ponto Colunar (com sufixos e abonos), Grade Quinzenal.
  - *Holerite*: Banco do Brasil (Declaração de Remuneração com verbas negativas e competências), Tabelas de Proventos/Descontos em 2 colunas, Deduplicação de 2 vias.
- **Sistema de Alertas Visuais**:
  - 🟡 **Alerta Amarelo**: Batidas ímpares, páginas vazias, incertezas (`?`).
  - 🔴 **Alerta Vermelho**: Quebras de sequência temporal (dias ou meses não consecutivos).
- **Interface de Revisão Lado a Lado**: Visualizador do PDF integrado junto à tabela dinâmica editável com atalhos de teclado (`Ctrl + S`), histórico de transcrições e feedback em tempo real.
- **Exportação Rica**: Planilhas Excel (`.xlsx`) com estilização institucional (`#173772`), preservação de cores de alerta e downloads em `.csv` e `.json`.

---

## 🚀 Como Colocar no Ar no Vercel

O projeto está 100% configurado para deploy no Vercel como uma aplicação Full-Stack (Serverless Functions + Frontend SPA).

### Opção 1: Via GitHub (Recomendado)

1. Faça o push do repositório para o seu GitHub:
   ```bash
   git add .
   git commit -m "feat: finaliza configuracao para deploy no vercel"
   git push origin main
   ```
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New..." > "Project"**.
3. Importe o repositório `Desafio-QuickFiller`.
4. As configurações padrão já serão reconhecidas automaticamente pelo `vercel.json`:
   - **Framework Preset**: `Vite` ou `Other`
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`
5. Clique em **Deploy**! 🚀

---

### Opção 2: Via Vercel CLI

Caso prefira publicar diretamente pelo terminal:

```bash
# 1. Instale o CLI do Vercel (se ainda não possuir)
npm i -g vercel

# 2. Execute o deploy em produção
vercel --prod
```

---

## 💻 Execução Local

### Pré-requisitos
- Node.js 20+ ou 22+
- npm 10+

### Instalação e Desenvolvimento
```bash
# Instala as dependências da raiz e do frontend
npm install

# Inicia o servidor backend e o frontend concorrentemente
npm run dev
```

- **Frontend (Vite)**: `http://localhost:5173`
- **Backend (Express)**: `http://localhost:3000`

---

## 🐳 Execução via Docker

```bash
docker compose up --build
```
Acesse a aplicação em `http://localhost:3000`.

---

## 🧪 Testes Automatizados

Para rodar a suíte completa de testes unitários:

```bash
npm test
```

---

## 📡 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/healthz` | Healthcheck da aplicação |
| `POST` | `/api/transcricoes` | Envio de PDF multipart (`arquivo`, `tipo: 'auto' \| 'cartao-ponto' \| 'holerite'`) |
| `GET` | `/api/transcricoes/:id` | Consulta o status e dados extraídos da transcrição |
| `PUT` | `/api/transcricoes/:id` | Salva alterações e correções feitas pelo usuário |
| `GET` | `/api/transcricoes/:id/pdf` | Stream do PDF original para visualização |
| `GET` | `/api/transcricoes/:id/planilha?formato=xlsx` | Download da planilha (`xlsx`, `csv`, `json`) |
