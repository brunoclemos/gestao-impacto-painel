# Painel de Performance — Gestão de Impacto

Dashboard de tráfego pago + funil de vendas, **por funil** (HOME · GINE · TREINAMENTOS) e **consolidado (Geral)**.
Single-file (`index.html`), tema escuro na identidade da GI. Lê os dados direto de uma **planilha Google** (CSV). Sem build, sem backend.

**Planilha conectada:** `1ZNOVea2o74XIKfJuCN60ycfWkD83mEexXoZUYXdzjL4`
**Ao vivo:** https://brunoclemos.github.io/gestao-impacto-painel/

---

## Como a planilha alimenta o painel

Cada **funil é uma aba** com o export do Meta Ads. O painel lê uma aba por funil e monta tudo (Geral = soma de todos).
Abas que ainda não existirem são **ignoradas** — então dá pra começar só com a HOME e ir adicionando.

| Funil no painel | Aba na planilha | Status |
|---|---|---|
| HOME | `HOME` | ✅ preenchida |
| GINE | `GINE` | adicionar quando tiver |
| TREINAMENTOS | `TREINAMENTOS` | adicionar quando tiver |

### Colunas das abas de funil (export Meta Ads — já é o formato da aba HOME)
`Date`, `Spend (Cost, Amount Spent)`, `Campaign Name`, `Adset Name`, `Ad Name`,
`Instagram Permalink URL`, `Action Link Clicks`, `CTR`, `CPM`, `Impressions`,
`Action Landing Page View`, `Action Leads`.
> O painel acha as colunas pelo nome (tolera variações). CPM/CPC/CTR são recalculados a partir de gasto/impressões/cliques.

### Aba `crm` — MQL, SQL e vendas por funil **e por data**
Preenchida automaticamente pelo Apps Script do Kommo (`integracoes/kommo.gs`), uma linha por (funil × data de
entrada do lead). Assim o painel filtra MQL/SQL/Vendas pelo mesmo período do tráfego. Colunas:
`date`, `funil`, `mql`, `sql`, `vendas`, `faturamento`. Enquanto a aba não existir, o painel usa o `crm.json` do repo.

| date | funil | mql | sql | vendas | faturamento |
|---|---|---|---|---|---|
| 2026-05-21 | HOME | 7 | 5 | 2 | 0 |
| 2026-06-06 | HOME | 1 | 0 | 0 | 0 |

---

## Métricas
Por etapa do funil (Impressões → Cliques → LPV → Leads → **MQL → SQL** → Vendas): **volume, custo e conversão**.
Custos: CPM, CPC, Custo/LPV, CPL, Custo/MQL, Custo/SQL, CPA. Conversões: CTR, Cliques→LPV, LPV→Lead,
**Conv. MQL**, **Conv. SQL**, SQL→Venda. E **ROAS** = faturamento ÷ investimento, por funil e no Geral.

## Configuração (no topo do `<script>` do `index.html`)
```js
const CONFIG = {
  SHEET_ID: '1ZNOVea2o74XIKfJuCN60ycfWkD83mEexXoZUYXdzjL4',
  FUNIS: [
    { key:'HOME',        tab:'HOME',         label:'HOME',         cor:'#38BDF8' },
    { key:'GINE',        tab:'GINE',         label:'GINE',         cor:'#2DD4BF' },
    { key:'TREINAMENTO', tab:'TREINAMENTOS', label:'TREINAMENTOS', cor:'#FBBF24' },
  ],
  TAB_CRM: 'crm',
};
```
Para adicionar um funil: crie a aba na planilha e garanta que ela está na lista `FUNIS`.
A planilha precisa estar como **“qualquer pessoa com o link → Leitor”**.

## Integrações (Kommo / Hotmart → aba `crm`)
Ver [`integracoes/`](./integracoes/). Os segredos ficam nas *Propriedades do script* (privados), nunca aqui.

## Stack
HTML + Tailwind (CDN) + Chart.js + PapaParse. Hospedável em GitHub Pages.
