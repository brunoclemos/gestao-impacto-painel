# Painel de Performance — Gestão de Impacto

Dashboard de tráfego pago + funil de vendas, separado por funil (**HOME · GINE · TREINAMENTO**).
Single-file (`index.html`), lê os dados de uma **planilha Google** publicada em CSV. Sem build, sem backend.

**Ao vivo:** _(GitHub Pages será ativado após o primeiro push)_

---

## Como conectar a planilha (passo a passo)

1. Crie uma planilha no Google Sheets com **2 abas**, nomeadas exatamente `trafego` e `crm` (colunas abaixo).
2. **Arquivo → Compartilhar → Publicar na web** _ou_ deixe o acesso como **"Qualquer pessoa com o link → Leitor"**.
3. Copie o **ID** da planilha (o trecho entre `/d/` e `/edit` na URL).
4. Abra o `index.html`, e no topo do `<script>` cole o ID em `CONFIG.SHEET_ID`:
   ```js
   const CONFIG = {
     SHEET_ID: 'COLE_O_ID_AQUI',
     TAB_TRAFEGO: 'trafego',
     TAB_CRM: 'crm',
   };
   ```
5. Commit + push. Pronto — o painel passa a ler os dados reais (sai do "modo demonstração").

> Enquanto `SHEET_ID` estiver vazio, o painel mostra **dados de exemplo** só pra você ver o layout.

---

## Modelo da planilha

### Aba `trafego` — Meta Ads (uma linha por campanha por dia)
| coluna | exemplo | de onde vem |
|---|---|---|
| `data` | `2026-06-07` | Meta (data do gasto) — opcional, habilita o gráfico diário |
| `funil` | `HOME` / `GINE` / `TREINAMENTO` | você classifica (ou pelo prefixo do nome da campanha) |
| `campanha` | `HOME · Lead Frio` | Meta (nome da campanha) |
| `investimento` | `230,50` | Meta (valor gasto) |
| `impressoes` | `42000` | Meta |
| `cliques` | `820` | Meta (cliques no link) |
| `leads` | `36` | Meta (resultados/leads) |

### Aba `crm` — Kommo + Hotmart (uma linha por funil; pode repetir por dia)
| coluna | exemplo | de onde vem |
|---|---|---|
| `data` | `2026-06-07` | opcional |
| `funil` | `HOME` / `GINE` / `TREINAMENTO` | o pipeline correspondente no Kommo |
| `mql` | `42` | Kommo (leads que viraram MQL) |
| `sql` | `24` | Kommo (leads que viraram SQL) |
| `vendas` | `9` | Kommo (ganhos) ou Hotmart (vendas aprovadas) |
| `faturamento` | `8730,00` | Hotmart / Kommo (receita) |

**Observações**
- Valores em real podem vir como `1.234,56` ou `1234.56` — o painel entende os dois.
- `funil` aceita variações (`Home`, `GI na Estrada`, `Treinamentos`) — são normalizadas para HOME / GINE / TREINAMENTO.
- O **ROAS** é calculado: `faturamento ÷ investimento` (por funil e no total).

---

## Métricas calculadas
CPL (`investimento ÷ leads`), CPA (`investimento ÷ vendas`), Ticket médio (`faturamento ÷ vendas`),
taxas de conversão Lead→MQL, MQL→SQL, SQL→Venda e Lead→Venda, e **ROAS** por funil e consolidado.

## Stack
HTML + Tailwind (CDN) + Chart.js + PapaParse. Hospedável em GitHub Pages.
