# Integrações → Planilha (Apps Script)

As credenciais (Hotmart, Kommo) **nunca** entram no código da dashboard (que é público).
Elas ficam num **Google Apps Script dentro da sua planilha**, em *Propriedades do script* (privadas da sua conta Google).
O script puxa os dados das APIs e escreve na aba `crm`; a dashboard só **lê** a planilha.

```
Hotmart  ─┐
Kommo    ─┼─►  Apps Script (na planilha)  ─►  aba "crm"  ─►  dashboard (index.html)
Meta Ads ─┘                                   aba "trafego"
```

---

## Hotmart (`hotmart.gs`) — vendas e faturamento por funil

1. Abra sua planilha → **Extensões → Apps Script**.
2. Cole o conteúdo de [`hotmart.gs`](./hotmart.gs) num arquivo novo.
3. **⚙ Configurações do projeto → Propriedades do script → Adicionar propriedade:**
   - `HOTMART_BASIC` = seu token Basic da Hotmart (o valor **sem** a palavra `Basic `).
4. Rode a função **`listarProdutosHotmart`** uma vez (menu Executar) e veja em *Registros* (Ctrl+Enter)
   para qual funil cada produto está caindo. Ajuste o array **`REGRAS_FUNIL`** no topo do script se precisar.
5. Rode **`atualizarHotmart`**. Vai preencher `vendas` e `faturamento` na aba `crm`, por funil.
6. **Agende:** ícone de relógio (Acionadores) → *Adicionar acionador* → função `atualizarHotmart` → *Baseado em tempo → Diário*.

> Na 1ª execução o Google pede autorização do script — é normal, é a sua própria conta.

### Mapa produto → funil
Hoje as regras assumem que os produtos **"Bússola Empresarial - <cidade>"** e **"Imersão ... Premium"**
são do funil **GINE** (GI na Estrada). Se algum produto for HOME ou TREINAMENTO, adicione uma regra, ex.:
```js
const REGRAS_FUNIL = [
  { contem: 'home',        funil: 'HOME' },
  { contem: 'treinamento', funil: 'TREINAMENTO' },
  { contem: 'bússola',     funil: 'GINE' },
];
```

---

## Kommo (`kommo.gs`) — MQL, SQL e (opcional) vendas por funil

1. Planilha → **Extensões → Apps Script** → cole [`kommo.gs`](./kommo.gs) num arquivo novo.
2. **⚙ Propriedades do script:**
   - `KOMMO_SUBDOMAIN` = o `XXXX` em `https://XXXX.kommo.com`
   - `KOMMO_TOKEN` = o token de longa duração (Bearer)
3. Rode **`listarPipelinesKommo`** e abra *Registros* (Ctrl+Enter). Vai listar cada pipeline (funil) e os
   estágios com seu `sort`. Anote, por funil: o `pipelineId` e o `sort` do estágio que marca **MQL** e **SQL**.
4. Preencha **`MAPA_KOMMO`** no topo do script, ex.:
   ```js
   const MAPA_KOMMO = {
     HOME:        { pipelineId: 111, mqlFromSort: 2, sqlFromSort: 4, gravaVendas: false },
     GINE:        { pipelineId: 222, mqlFromSort: 2, sqlFromSort: 4, gravaVendas: false }, // vendas vêm da Hotmart
     TREINAMENTO: { pipelineId: 333, mqlFromSort: 2, sqlFromSort: 4, gravaVendas: true  }, // alto ticket fecha no CRM
   };
   ```
   - `gravaVendas: false` → o Kommo só escreve `mql`/`sql` (as `vendas`/`faturamento` ficam com a Hotmart).
   - `gravaVendas: true`  → o Kommo também escreve `vendas`/`faturamento` desse funil (alto ticket fechado no CRM).
5. Rode **`atualizarKommo`** e **agende** (relógio → Diário).

> Lógica: estágio "ganho" = 142 e "perdido" = 143 (padrão Kommo em todo pipeline). Perdidos não contam.
> MQL = leads cujo estágio tem `sort ≥ mqlFromSort` (inclui quem já avançou além). SQL idem.

### Como Hotmart e Kommo convivem na aba `crm`
- **Hotmart** escreve só `vendas` + `faturamento` (eventos low ticket).
- **Kommo** escreve `mql` + `sql` sempre; e `vendas`/`faturamento` só nos funis com `gravaVendas: true`.
- Os dois fazem *upsert* por funil — não se atropelam.
