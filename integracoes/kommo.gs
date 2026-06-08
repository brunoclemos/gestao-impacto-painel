/**
 * Integração Kommo → Planilha (aba "crm") — MQL, SQL (e, se quiser, vendas) por funil.
 * ---------------------------------------------------------------------------------
 * 🔐 Segredos nas Propriedades do script (⚙ Configurações do projeto):
 *      KOMMO_SUBDOMAIN = o XXXX em https://XXXX.kommo.com
 *      KOMMO_TOKEN     = o token de longa duração (Bearer)
 *
 * PASSO 1) Rode "listarPipelinesKommo" e abra os Registros (Ctrl+Enter).
 *          Anote, para cada funil, o id do PIPELINE e o "sort" do estágio que marca MQL e SQL.
 * PASSO 2) Preencha MAPA_KOMMO abaixo.
 * PASSO 3) Rode "atualizarKommo" (e agende no relógio → Diário).
 *
 * Regras: "ganho" = status 142 (won, padrão Kommo) e "perdido" = 143 (lost) — perdidos não contam.
 * MQL = leads cujo estágio tem sort >= mqlFromSort (inclui quem avançou além). SQL idem.
 */

const ABA_CRM_K = 'crm';
const WON = 142, LOST = 143; // ids globais padrão do Kommo em todo pipeline

// Preencha após rodar listarPipelinesKommo():
const MAPA_KOMMO = {
  // HOME:        { pipelineId: 0, mqlFromSort: 0, sqlFromSort: 0, gravaVendas: false },
  // GINE:        { pipelineId: 0, mqlFromSort: 0, sqlFromSort: 0, gravaVendas: false }, // vendas vêm da Hotmart
  // TREINAMENTO: { pipelineId: 0, mqlFromSort: 0, sqlFromSort: 0, gravaVendas: true  }, // alto ticket fecha no CRM
};

// ---------------------------------------------------------------------------------
function _kbase() {
  const p = PropertiesService.getScriptProperties();
  const sub = p.getProperty('KOMMO_SUBDOMAIN'), tok = p.getProperty('KOMMO_TOKEN');
  if (!sub || !tok) throw new Error('Configure KOMMO_SUBDOMAIN e KOMMO_TOKEN nas Propriedades do script.');
  return { base: 'https://' + sub.replace(/\..*$/, '').trim() + '.kommo.com/api/v4', tok: tok.trim() };
}

function _kget(path) {
  const { base, tok } = _kbase();
  const res = UrlFetchApp.fetch(base + path, { muteHttpExceptions: true, headers: { 'Authorization': 'Bearer ' + tok } });
  const code = res.getResponseCode();
  if (code === 204) return { _embedded: {} };
  if (code !== 200) throw new Error('Kommo HTTP ' + code + ': ' + res.getContentText().slice(0, 250));
  return JSON.parse(res.getContentText());
}

// 🔎 Liste pipelines e estágios para preencher o MAPA_KOMMO
function listarPipelinesKommo() {
  const d = _kget('/leads/pipelines');
  ((d._embedded || {}).pipelines || []).forEach(p => {
    Logger.log('PIPELINE  id=' + p.id + '  "' + p.name + '"');
    const sts = ((p._embedded || {}).statuses || []).slice().sort((a, b) => a.sort - b.sort);
    sts.forEach(s => Logger.log('    sort=' + s.sort + '  id=' + s.id + '  "' + s.name + '"'));
  });
}

// ▶ Função principal — calcula MQL/SQL/vendas por funil e grava na aba "crm"
function atualizarKommo() {
  const pipes = ((_kget('/leads/pipelines')._embedded || {}).pipelines) || [];
  const byId = {}; pipes.forEach(p => byId[p.id] = p);
  const out = {};

  Object.keys(MAPA_KOMMO).forEach(funil => {
    const cfg = MAPA_KOMMO[funil];
    const pipe = byId[cfg.pipelineId];
    const sortById = {};
    if (pipe) (((pipe._embedded || {}).statuses) || []).forEach(s => sortById[s.id] = s.sort);

    let page = 1, mql = 0, sql = 0, vendas = 0, fat = 0;
    while (page <= 100) {
      const d = _kget('/leads?filter[pipeline_id]=' + cfg.pipelineId + '&limit=250&page=' + page);
      const leads = ((d._embedded || {}).leads) || [];
      if (!leads.length) break;
      leads.forEach(l => {
        const st = l.status_id;
        if (st === LOST) return;                 // perdidos não contam
        const sort = sortById[st];
        if (st === WON) { vendas++; fat += (l.price || 0); }
        if (sort != null && sort >= cfg.mqlFromSort) mql++;
        if (sort != null && sort >= cfg.sqlFromSort) sql++;
      });
      page++;
    }
    out[funil] = { mql, sql, vendas, fat, gravaVendas: !!cfg.gravaVendas };
  });

  _gravarCrmKommo(out);
  Logger.log('Kommo atualizado: ' + JSON.stringify(out));
}

// upsert por funil: sempre atualiza mql/sql; vendas/faturamento só se gravaVendas=true
function _gravarCrmKommo(out) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_CRM_K);
  if (!sh) { sh = ss.insertSheet(ABA_CRM_K); sh.appendRow(['data', 'funil', 'mql', 'sql', 'vendas', 'faturamento']); }
  const rng = sh.getDataRange().getValues();
  const head = rng[0].map(h => String(h).trim().toLowerCase());
  const i = {
    funil: head.indexOf('funil'), mql: head.indexOf('mql'), sql: head.indexOf('sql'),
    vendas: head.indexOf('vendas'), faturamento: head.indexOf('faturamento')
  };
  if (i.funil < 0 || i.mql < 0 || i.sql < 0)
    throw new Error('A aba "crm" precisa ter as colunas: funil, mql, sql (na 1ª linha).');
  const linha = {};
  for (let r = 1; r < rng.length; r++) { const f = String(rng[r][i.funil] || '').toUpperCase().trim(); if (f) linha[f] = r + 1; }
  Object.keys(out).forEach(funil => {
    const v = out[funil];
    let row = linha[funil];
    if (!row) { const nova = new Array(head.length).fill(0); nova[i.funil] = funil; sh.appendRow(nova); row = sh.getLastRow(); }
    sh.getRange(row, i.mql + 1).setValue(v.mql);
    sh.getRange(row, i.sql + 1).setValue(v.sql);
    if (v.gravaVendas && i.vendas >= 0 && i.faturamento >= 0) {
      sh.getRange(row, i.vendas + 1).setValue(v.vendas);
      sh.getRange(row, i.faturamento + 1).setValue(v.fat);
    }
  });
}
