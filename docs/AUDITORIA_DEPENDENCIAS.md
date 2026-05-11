# AUDITORIA TÉCNICA DE DEPENDÊNCIAS - Fluxo de Caixa

## Resumo Executivo
Varredura completa realizada em `package.json` e todos os arquivos de código fonte para detecção de pacotes obsoletos e otimização do bundle.

## Dependências Analisadas

| Dependência | Versão | Status | Uso Detectado | Recomendação |
| :--- | :--- | :--- | :--- | :--- |
| `pdf-to-img` | ^6.0.0 | **MORTO** | Nenhuma referência no código. | **Remover** |
| `puppeteer` | ^24.42.0 | **UTILITÁRIO** | Usado apenas em `importa_boleto.cjs` (script local). | **Mover para devDependencies** |
| `tesseract.js` | ^7.0.0 | **UTILITÁRIO** | Usado apenas em `importa_boleto.cjs` (script local). | **Mover para devDependencies** |
| `pdf-parse` | ^1.1.4 | **UTILITÁRIO** | Usado em scripts de teste e importação local. | **Mover para devDependencies** |
| `express` | ^4.21.2 | **HÍBRIDO** | Usado no `server.js` (dev local), mas não em produção (Vercel). | **Manter (Opcional)** |
| `cors` | ^2.8.6 | **HÍBRIDO** | Usado no `server.js`. | **Manter (Opcional)** |
| `pdfjs-dist` | ^3.11.174 | **CRÍTICO** | Processamento de PDF no Frontend (`App.tsx`). | **Manter** |
| `motion` | ^12.23.24 | **CRÍTICO** | Animações de UI. | **Manter** |
| `recharts` | ^3.8.0 | **CRÍTICO** | Dashboards e Gráficos. | **Manter** |

## Riscos e Impactos
- **Remoção de `pdf-to-img`:** Risco Zero. Melhora tempo de instalação.
- **Mudança para devDependencies:** Garante que scripts de "ajuda" não sejam enviados para o bundle de produção da Vercel, diminuindo o tamanho final da aplicação.

## Auditoria de Imports Mortos
- Nenhum arquivo `.ts/tsx` órfão detectado na pasta `src/`.
- `App.tsx` concentra a maior parte da lógica; recomendada futura quebra em componentes menores para facilitar manutenção.

---
**Data da Auditoria:** 11/05/2026
**Responsável:** Antigravity AI Security Auditor
