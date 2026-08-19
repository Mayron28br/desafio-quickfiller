# PROCESSO.md — Registro do Processo de Desenvolvimento e Uso de IA

Este documento registra a condução do projeto, as ferramentas utilizadas, a interação com o assistente de IA, as decisões de engenharia com múltiplos caminhos possíveis e uma autoavaliação honesta sobre pontos de fragilidade da solução.

---

## 1. Ferramentas Utilizadas e Finalidade

- **Google Antigravity / Gemini 3.7**: Utilizado para desenho arquitetural, estruturação dos contratos JSON, depuração e diagnóstico de falhas em runtime, criação de cenários de teste unitário e codificação full-stack (Back-end TypeScript + Front-end React).
- **Node.js, TypeScript e React**: Base de tecnologia adotada para garantir tipagem estrita de ponta a ponta e interface web reativa.
- **unpdf (Mozilla PDF.js Engine)**: Motor moderno de leitura vetorial de PDFs com suporte integral a streams assíncronos e execução multiplataforma em Node.js ESM.
- **@napi-rs/canvas & Tesseract.js**: Pipeline de rasterização de páginas em alta resolução (scale 2.0) e reconhecimento óptico de caracteres (OCR) para PDFs escaneados (sem camada de texto).
- **ExcelJS**: Geração e estilização da planilha `.xlsx` com cabeçalho institucional `#173772`, fonte branca e destaques de cores de alerta.
- **Vite & Lucide React**: Ferramental de build e componentes de ícones modernos para a interface de revisão.
- **Docker & Docker Compose**: Padronização do ambiente de execução e garantia de reprodutibilidade em qualquer máquina.
- **Git / GitHub**: Controle de versão e rastreabilidade de código.

---

## 2. Pontos em que a IA Errou ou Tomou Caminhos Incorretos

### 1. Diagnóstico e Substituição da Biblioteca Legada `pdf-parse` por `unpdf` + Rasterização Canvas
- **O que ocorreu**: O assistente inicialmente propôs a biblioteca clássica `pdf-parse` (v1.1.1, datada de 2018) para a extração de texto. Durante os testes com documentos gerados e com múltiplos streams assíncronos, o `pdf-parse` quebrou repetidamente emitindo erros internos de `bad XRef entry` e `Command token too long: 128` devido a limitações do worker antigo embutido no pacote. Além disso, a tentativa de passar o buffer do PDF diretamente para o Tesseract.js em ambiente Node.js falhou, pois o Tesseract em Node exige buffers de imagem rasterizados (PNG/JPEG), e não o arquivo binário do PDF cru.
- **Como percebi e conduzi a solução**:
  1. Isolei o problema criando scripts de teste unitário para avaliar o comportamento do parser sob diferentes estruturas de PDF.
  2. Decidi remover completamente a dependência legada `pdf-parse` e migrar para o **`unpdf`** (versão moderna e modular do PDF.js da Mozilla, compatível com ESM e Node.js).
  3. Para resolver o tratamento de PDFs escaneados (imagens puras sem texto), construí uma etapa intermediária de rasterização: a função `renderPageAsImage` do `unpdf` acoplada ao `@napi-rs/canvas` gera um buffer PNG nítido em escala 2.0, que é então processado com precisão pelo worker do `tesseract.js` em português (`por`).
  4. O resultado foi uma extração instantânea para documentos digitais (< 15ms) e um fallback de OCR 100% funcional para documentos escaneados.

### 2. Confusão Heurística entre "Salário Base" como Verba vs. Base de Cálculo no Holerite
- **O que ocorreu**: Na primeira versão do extrator de holerite, o assistente incluiu a palavra-chave `"salário base"` na lista genérica de bases e totais do rodapé (`bases[]`). Isso fez com que a linha principal de vencimento `0010 Salário Base 220,00 2.389,77` fosse classificada incorretamente como base em vez de verba (`fields[]`).
- **Como percebi e conduzi**: O teste unitário `tests/extractors.test.ts` acusou a falha imediatamente. Refinei a heurística para checar a presença de código de item (ex: `0010`) e referências de jornada antes de categorizar uma linha como base de cálculo, garantindo a separação estrita exigida pelo desafio.

### 3. Incompatibilidades com Express 5 e `verbatimModuleSyntax` do TypeScript
- **O que ocorreu**: O servidor quebrou na inicialização devido à rota `app.get('*')`, pois o `path-to-regexp` do Express 5 exige parâmetros nomeados para wildcards. Simultaneamente, o compilador do TypeScript no frontend rejeitou imports de tipos sem a diretiva `import type`.
- **Como percebi e conduzi**: Substituí o wildcard por um middleware SPA condicional em `src/server.ts` e adequei todos os imports do React para a sintaxe `import type { ... }`.

### 4. Detecção de Documentos Escaneados com Assinatura Eletrônica do PJe
- **O que ocorreu**: Documentos de processos trabalhistas extraídos do PJe contêm carimbos digitais no rodapé (`Assinado eletronicamente por...`, `Fls.: 316`). O verificador de tamanho de texto anterior identificava mais de 20 caracteres e considerava a página digital, deixando de executar o OCR e retornando a página em branco.
- **Como percebi e conduzi**: Criei uma função de higienização de metadados (`cleanPjeMetadata`) que filtra assinaturas e dados de processo antes de calcular o volume de texto útil. Se o texto útil for insuficiente para o domínio, o pipeline ativa automaticamente a rasterização com OCR em alta escala (2.5).

### 6. Identificação Automática de Tipo de Documento e Painel Único
- **O que ocorreu**: O usuário precisava escolher manualmente se o documento enviado era um Cartão de Ponto ou um Holerite. Além disso, folhas de pagamento com seções de acerto e valores de desconto com sinal negativo (`-433,20`) necessitavam de tratamento para não truncar valores nem perder sinais nos campos.
- **Como percebi e conduzi**: Criei uma função de inferência baseada em termos lexicais e densidade numérica/temporal (`detectDocumentType`) que detecta o tipo automaticamente a partir do conteúdo do PDF. No frontend, unifiquei a interface de upload em um painel único com suporte a drag-and-drop direto, eliminando o seletor manual.

---

## 3. O que foi Feito ou Reescrito e Por Quê

- **Painel Único com Identificação Automática**: Simplifica a experiência do usuário para um fluxo de 1 clique: arrastar o PDF e obter a planilha transcrita diretamente.
- **Pipeline Híbrido de Leitura (Digital + OCR com Rasterização)**: Permite que a aplicação trate tanto PDFs gerados em sistemas de RH quanto documentos digitalizados em scanners com rotação ou ruído, sem depender de ferramentas externas de sistema operacional.
- **Parsers Especializados Multi-Layout**: Suporte nativo aos formatos mais recorrentes no mercado (Banco do Brasil com intervalos, SIPON / POEL,C com batidas matutinas/vespertinas em linhas separadas, cartões colunares de ponto mecânico e holerites com 2 colunas e valores negativos).
- **Interface de Revisão com Rolagem Independente (Side-by-Side)**: O layout com CSS Grid e flexbox garante que o revisor consiga navegar pelo PDF original à esquerda e editar as células na tabela à direita sem perda de contexto.
- **Exportação com Formatação Fiel ao Contrato**: As planilhas geradas em `.xlsx` aplicam estilos institucionais na primeira linha (`#173772` com texto branco em negrito) e aplicam a matriz de alerta (Amarelo `#FFF3CD` para batidas ímpares/`?` e Vermelho `#F8D7DA` com borda lateral `#DC3545` para quebras de sequência temporal).

---

## 4. Respostas às Perguntas Obrigatórias

### 1. Cite 3 decisões em que havia mais de uma resposta razoável. Por que escolheu essa?

- **Decisão 1: Processamento em memória assíncrono vs. Fila externa com Redis/BullMQ**
  - *Alternativas*: Orquestrar tarefas assíncronas com Redis e BullMQ ou utilizar um gerenciador em memória com retenção de 24 horas (`src/services/store.ts`).
  - *Escolha*: Optou-se pelo gerenciador em processo com controle de concorrência e cleanup automático. Isso mantém o setup do `docker compose up` extremamente leve (um único container), eliminando dependências externas e atendendo fielmente ao contrato HTTP assíncrono (`POST` -> `202 Accepted`, `GET` com polling).
- **Decisão 2: Front-end servido pelo Express vs. Proxy Nginx dedicado**
  - *Alternativas*: Criar dois containers separados (um Nginx para o React e outro para a API Node) ou compilar o frontend estático e servi-lo diretamente pelo Express.
  - *Escolha*: Servir o build do Vite diretamente pelo Express em produção (`src/server.ts`). Reduz pela metade o consumo de memória no free tier e simplifica o deploy para um único serviço.
- **Decisão 3: Visualização do PDF via Iframe nativo vs. Renderização Canvas manual com PDF.js**
  - *Alternativas*: Montar um leitor de PDF customizado desenhando canvas página a página ou usar o elemento nativo do navegador via `<iframe src="/api/transcricoes/:id/pdf" />`.
  - *Escolha*: Uso de iframe nativo com link de abertura externa. Proporciona ferramentas nativas de zoom, impressão e busca de texto do próprio navegador sem penalizar a performance do React.

### 2. O que na sua solução quebra primeiro em produção?

- **PDFs escaneados com baixa resolução, inclinação severa (skew) ou fundos escuros/manchados**: Documentos físicos com sombras densas podem degradar o OCR se não houver um pré-processamento avançado de imagem (deskewing, binarização com threshold adaptativo e remoção de ruído).
- **Carga concorrente de PDFs gigantes com dezenas de páginas escaneadas**: Como o OCR via Tesseract é intensivo em CPU, múltiplos uploads simultâneos de documentos digitalizados extensos podem elevar o uso de CPU se não houver um pool de workers com limite estrito de concorrência.

### 3. Onde você não confia no que entregou?

- **Layouts atípicos de holerite com verbas e bases misturadas horizontalmente**: Em modelos de recibo em que a seção de bases de cálculo não fica no rodapé e sim distribuída em colunas paralelas às verbas de proventos, a heurística de separação textual pode demandar ajustes de coordenadas espaciais.
- **Batidas de ponto sem espaçamento ou com marcações manuais/rasuras**: Em cartões de ponto mecânicos com carimbos ou marcações à mão que sobrepõem os horários impressos, a ordenação de pares Entrada/Saída pode requerer intervenção manual na interface de revisão.

---

## 5. Histórico e Registro de Progresso

- [x] Configuração do repositório, `.gitignore` e TypeScript.
- [x] Implementação dos contratos de API (`POST /api/transcricoes`, `GET /api/transcricoes/:id`, `PUT /api/transcricoes/:id`, `GET /api/transcricoes/:id/planilha`, `GET /healthz`).
- [x] Extrator de Cartão de Ponto com suporte a múltiplos layouts (Banco do Brasil, SIPON, Colunar Operador, Quinzenal).
- [x] Extrator de Holerite com suporte a 2 colunas, deduplicação de via dupla e separação estrita entre verbas e bases.
- [x] Pipeline de OCR com rasterização canvas (`@napi-rs/canvas` em scale 2.5) e filtragem de metadados PJe.
- [x] Motor de alertas dinâmicos (Amarelo e Vermelho com precedência e suporte a múltiplos formatos de data).
- [x] Geração de planilhas `.xlsx`, `.csv` e `.json` com estilos institucionais.
- [x] Front-end React com visualizador de PDF lado a lado e tabela editável.
- [x] Suíte completa de testes unitários com 100% de sucesso.
- [x] Geração de PDFs de exemplo (digitais e escaneados) em `exemplos/`.
- [x] Dockerfile multi-stage e Docker Compose.
- [x] Documentação técnica completa em `SOLUCAO.md` e `PROCESSO.md`.
