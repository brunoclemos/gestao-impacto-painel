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

## Kommo (em breve — `kommo.gs`)
Mesma ideia: um script lê o pipeline do Kommo (estágios MQL/SQL/ganho) e escreve `mql`, `sql` (e, se as
vendas de alto ticket fecharem no CRM, também `vendas`/`faturamento`) na aba `crm`, por funil.
Vou montar quando você me passar o **subdomínio** + **token de longa duração** do Kommo e qual estágio
do funil corresponde a MQL e a SQL.
