# SOLUCAO.md — Documentação Técnica da Solução

Este documento detalha as decisões de arquitetura, tecnologias empregadas, instruções de execução e considerações de segurança e dados do projeto **QuickFiller**.

---

## 1. Visão Geral da Arquitetura

A aplicação foi construída seguindo o princípio de **um único pipeline integrado** que atende a dois tipos de documentos trabalhistas: **Cartão de Ponto** e **Holerite**.

O fluxo completo é composto por:
1. **Envio e Validação (`POST /api/transcricoes`)**: Recepção do PDF via `multipart/form-data` com validação de magic bytes (`%PDF-`) e limite de payload (20MB). Retorno imediato de `202 Accepted` com identificador `{ "id": "abc123" }`.
2. **Processamento Assíncrono (Background Worker)**: Orquestração não-bloqueante em segundo plano que executa a extração e atualiza o estado em memória (`processando` -> `concluido` ou `erro`).
3. **Extração de Texto & OCR**: Leitura vetorial via `unpdf` (Mozilla PDF.js otimizado para Node.js) com detecção de páginas escaneadas (sem camada de texto) e acionamento automático de OCR via `tesseract.js`.
4. **Parsers Especializados**:
   - **Cartão de Ponto**: Identificação de linhas de dias, extração de batidas em pares `IN`/`OUT`, preservação de `date_raw` / `time_raw` e normalização em `time_hhmm`. Dias sem batida são mantidos como `punches: []`.
   - **Holerite**: Separação estrita entre `fields` (tabela de verbas) e `bases` (bases de cálculo e totais como Base INSS, Total Vencimentos, Valor Líquido). Valores monetários mantidos como string brasileira (`"2.389,77"`).
5. **Cálculo Dinâmico de Alertas**:
   - **Amarelo (`#FFF3CD`)**: Batidas ímpares, páginas vazias, ou caractere `?` na linha.
   - **Vermelho (`#F8D7DA` com borda esquerda `#DC3545`)**: Quebras de sequência temporal (datas de ponto ou meses de competência não consecutivos).
   - **Precedência**: Se ambos os alertas ocorrerem na mesma linha, o vermelho sobrepõe o amarelo.
6. **Interface de Revisão (React + TypeScript)**: Visualização do PDF original lado a lado com a tabela editável e destaques visuais em tempo real. Permite corrigir dados e salvar via `PUT /api/transcricoes/:id`.
7. **Exportação Multi-formato (`GET /api/transcricoes/:id/planilha`)**: Geração de `.xlsx` (com cabeçalho institucional `#173772`, fonte branca em negrito e cores de alerta nas linhas), `.csv` e `.json`.

---

## 2. Tecnologias Utilizadas

- **Back-end**: Node.js com TypeScript e Express.
- **Front-end**: React com TypeScript, construído com Vite e estilização Vanilla CSS com Design System responsivo.
- **Leitura de PDF & OCR**: `unpdf` e `tesseract.js` (suporte a idioma português).
- **Geração de Planilhas**: `exceljs` (com suporte a estilos ricos de cores e bordas) e gerador nativo de CSV/JSON.
- **Containerização**: Docker e Docker Compose (Multi-stage build).

---

## 3. Como Rodar a Aplicação

### Via Docker Compose (Recomendado)

```bash
docker compose up --build
```

A aplicação estará acessível em: `http://localhost:3000`.

### Localmente (Desenvolvimento)

1. **Executar Back-end e Front-end juntos**:
   ```bash
   npm run dev
   ```
   Acesse: `http://localhost:5173` ou `http://localhost:3000`.

2. **Execução dos Testes Automatizados**:
   ```bash
   npm test
   ```

---

## 4. Segurança, Privacidade e Retenção de Dados

- **Validação de Uploads**: Verificação estrita dos magic bytes do PDF (`%PDF-`), rejeitando arquivos corrompidos ou renomeados.
- **Limite de Payload**: Limite de 20MB por arquivo.
- **Sem PII em Logs**: Utilitário dedicado (`src/utils/security.ts`) mascara automaticamente padrões de CPF (`***.***.***-**`) e valores monetários, registrando apenas métricas técnicas (IDs, contagem de páginas e tempos de execução).
- **Política de Retenção**: Transcrições e buffers temporários em memória são expurgados automaticamente após 24 horas via rotina periódica de cleanup.

---

## 5. Estratégia e Justificativa dos Testes

- **`tests/alerts.test.ts`**: Valida a derivação correta de batidas ímpares, quebras de sequência de data/mês e a precedência estrita do alerta vermelho sobre o amarelo.
- **`tests/extractors.test.ts`**: Valida a normalização de horários, a preservação de dias vazios (`punches: []`) e a separação estrita entre `fields` e `bases` no holerite (garantindo que `Valor Líquido` ou `Base INSS` nunca entrem em `fields`).
- **`tests/spreadsheet.test.ts`**: Valida a geração de `.xlsx`, `.csv` e `.json` com cabeçalhos corretos e matriz transposta de verbas.

---

## 6. Registro de Atividades e Evolução

| Data / Etapa | Atividade Realizada |
|---|---|
| Etapa 1 | Criação da arquitetura, contratos de API e plano de execução do projeto. |
| Etapa 2 | Configuração de `.gitignore` e limpeza do cache de dependências do Git. |
| Etapa 3 | Implementação do back-end em TypeScript/Express com rotas assíncronas e healthcheck. |
| Etapa 4 | Implementação dos extratores de Cartão de Ponto e Holerite com suporte a OCR. |
| Etapa 5 | Migração do motor de extração de PDF para `unpdf` para eliminar problemas de XRef e suporte a PDFs modernos. |
| Etapa 6 | Implementação do motor de alertas dinâmicos e serviço de exportação de planilhas Excel/CSV/JSON. |
| Etapa 7 | Construção do front-end React com visualizador de PDF lado a lado e tabela editável. |
| Etapa 8 | Criação da suíte de testes unitários com 100% de aprovação. |
| Etapa 9 | Geração de PDFs de exemplo com cenários de teste reais em `exemplos/`. |
| Etapa 10 | Configuração de `Dockerfile` multi-stage e `docker-compose.yml`. |
