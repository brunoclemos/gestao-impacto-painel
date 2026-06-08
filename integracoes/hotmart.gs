/**
 * Integração Hotmart → Planilha (aba "crm") — Painel Gestão de Impacto
 * ---------------------------------------------------------------------
 * Busca as vendas APROVADAS na Hotmart e grava, por funil, a quantidade de
 * vendas e o faturamento na aba "crm" (colunas "vendas" e "faturamento").
 * As colunas "mql" e "sql" NÃO são tocadas (ficam por conta do Kommo).
 *
 * 🔐 O token Basic NÃO fica no código. Configure em:
 *    Extensões → Apps Script → ⚙ Configurações do projeto → Propriedades do script
 *      HOTMART_BASIC = <seu token Basic, SEM a palavra "Basic ">
 *
 * ▶ Rodar agora: selecione a função "atualizarHotmart" e clique em Executar.
 * ⏰ Agendar:   Acionadores (relógio) → Adicionar → atualizarHotmart → Diário.
 */

const ABA_CRM = 'crm';
const DIAS = 365;                 // janela de vendas a considerar
const FUNIS = ['HOME', 'GINE', 'TREINAMENTO'];

// Mapeia o PRODUTO da Hotmart → funil. Regras em ordem; "contem" é case-insensitive.
// Ajuste conforme seus produtos reais (rode listarProdutosHotmart() para ver os nomes).
const REGRAS_FUNIL = [
  // { contem: 'home',        funil: 'HOME' },
  // { contem: 'treinamento', funil: 'TREINAMENTO' },
  { contem: 'bússola', funil: 'GINE' },   // "Bússola Empresarial - <cidade>" = GI na Estrada
  { contem: 'imersão', funil: 'GINE' },
];
const FUNIL_PADRAO = 'GINE';      // usado se nenhuma regra casar

function funilDoProduto(nome) {
  const n = (nome || '').toLowerCase();
  for (const r of REGRAS_FUNIL) if (n.indexOf(r.contem.toLowerCase()) > -1) return r.funil;
  return FUNIL_PADRAO;
}

// ---------------------------------------------------------------------
function _basic() {
  const b = PropertiesService.getScriptProperties().getProperty('HOTMART_BASIC');
  if (!b) throw new Error('Configure HOTMART_BASIC nas Propriedades do script.');
  return b.replace(/^Basic\s+/i, '').trim();
}

function _token() {
  const basic = _basic();
  const dec = Utilities.newBlob(Utilities.base64Decode(basic)).getDataAsString(); // client_id:client_secret
  const sep = dec.indexOf(':');
  const cid = dec.slice(0, sep), csec = dec.slice(sep + 1);
  const url = 'https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials'
    + '&client_id=' + encodeURIComponent(cid) + '&client_secret=' + encodeURIComponent(csec);
  const res = UrlFetchApp.fetch(url, {
    method: 'post', muteHttpExceptions: true,
    headers: { 'Authorization': 'Basic ' + basic, 'Content-Type': 'application/json' }
  });
  const data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error('Falha OAuth Hotmart: ' + res.getContentText());
  return data.access_token;
}

function _sales(token) {
  const start = Date.now() - DIAS * 86400 * 1000, end = Date.now();
  let pageToken = null, pages = 0, all = [];
  do {
    let url = 'https://developers.hotmart.com/payments/api/v1/sales/history?start_date=' + start
      + '&end_date=' + end + '&max_results=50';
    if (pageToken) url += '&page_token=' + encodeURIComponent(pageToken);
    const res = UrlFetchApp.fetch(url, {
      method: 'get', muteHttpExceptions: true,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    if (res.getResponseCode() !== 200) break;
    const data = JSON.parse(res.getContentText());
    all = all.concat(data.items || []);
    pageToken = (data.page_info || {}).next_page_token || null;
    pages++;
  } while (pageToken && pages < 60);
  return all;
}

// ▶ Função principal — rode esta (ou agende)
function atualizarHotmart() {
  const items = _sales(_token());
  const acc = {}; FUNIS.forEach(f => acc[f] = { vendas: 0, faturamento: 0 });
  items.forEach(it => {
    const pur = it.purchase || {}, prod = it.product || {};
    const st = pur.status || '';
    if (st !== 'COMPLETE' && st !== 'APPROVED') return;
    const funil = funilDoProduto(prod.name);
    if (!acc[funil]) acc[funil] = { vendas: 0, faturamento: 0 };
    acc[funil].vendas += 1;
    acc[funil].faturamento += ((pur.price || {}).value || 0);
  });
  _gravarCrm(acc);
  Logger.log('Hotmart atualizado: ' + JSON.stringify(acc));
}

// 🔎 Auxiliar: lista os produtos e o funil que cada um cairia (para ajustar REGRAS_FUNIL)
function listarProdutosHotmart() {
  const items = _sales(_token());
  const prod = {};
  items.forEach(it => {
    const p = it.product || {}, pur = it.purchase || {};
    if ((pur.status || '') !== 'COMPLETE' && (pur.status || '') !== 'APPROVED') return;
    const k = p.name || '?';
    prod[k] = prod[k] || { vendas: 0, rev: 0 };
    prod[k].vendas++; prod[k].rev += ((pur.price || {}).value || 0);
  });
  Object.keys(prod).sort((a, b) => prod[b].rev - prod[a].rev).forEach(n =>
    Logger.log(`${n}  →  ${funilDoProduto(n)}  | vendas=${prod[n].vendas} receita=R$${prod[n].rev.toFixed(2)}`));
}

// upsert por funil: atualiza só vendas/faturamento, preserva mql/sql
function _gravarCrm(acc) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_CRM);
  if (!sh) { sh = ss.insertSheet(ABA_CRM); sh.appendRow(['data', 'funil', 'mql', 'sql', 'vendas', 'faturamento']); }
  const rng = sh.getDataRange().getValues();
  const head = rng[0].map(h => String(h).trim().toLowerCase());
  const iFunil = head.indexOf('funil'), iVendas = head.indexOf('vendas'), iFat = head.indexOf('faturamento');
  if (iFunil < 0 || iVendas < 0 || iFat < 0)
    throw new Error('A aba "crm" precisa ter as colunas: funil, vendas, faturamento (na 1ª linha).');
  const linha = {};
  for (let r = 1; r < rng.length; r++) { const f = String(rng[r][iFunil] || '').toUpperCase().trim(); if (f) linha[f] = r + 1; }
  Object.keys(acc).forEach(funil => {
    const v = acc[funil];
    if (linha[funil]) {
      sh.getRange(linha[funil], iVendas + 1).setValue(v.vendas);
      sh.getRange(linha[funil], iFat + 1).setValue(v.faturamento);
    } else {
      const nova = new Array(head.length).fill(0);
      nova[iFunil] = funil; nova[iVendas] = v.vendas; nova[iFat] = v.faturamento;
      sh.appendRow(nova);
    }
  });
}
