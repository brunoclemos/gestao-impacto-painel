/**
 * Integração Kommo → Planilha (aba "crm") — MQL, SQL e vendas por funil.
 * ---------------------------------------------------------------------------------
 * 🔐 Propriedades do script (⚙ Configurações do projeto):
 *      KOMMO_SUBDOMAIN = leonardogestaoimpactocom
 *      KOMMO_TOKEN     = (token de longa duração)
 *
 * Cada funil pode somar VÁRIOS pipelines. Para cada pipeline, liste os status_id que
 * contam como MQL, SQL e Venda. Rode "listarPipelinesKommo" para ver os IDs.
 *
 * ▶ Rode "atualizarKommo" (e agende no relógio → Diário).
 */

const ABA_CRM_K = 'crm';

// HOME = soma de 4 pipelines (HOME NOVO + IA + Funil de Vendas + Campanha Forms).
const MAPA_KOMMO = {
  HOME: {
    gravaVendas: true, // grava vendas/faturamento (faturamento vem do "price" do lead no Kommo; 0 até preencherem)
    pipelines: [
      { id: 13684264, // HOME NOVO
        mql:   [105607012, 106485812, 106485816, 106485820, 106485824, 106485828, 106485832, 142],
        sql:   [106485812, 106485824, 106485828, 106485832, 142],
        venda: [106485828, 142] },
      { id: 13679504, // IA  (Meet agendado/realizado, Qualificado)
        mql:   [105569528, 105661040, 105569248, 142],
        sql:   [105661040, 105569248, 142],
        venda: [142] },
      { id: 11411643, // Funil de Vendas (genérico — só entrada/contato; conta venda ganha)
        mql:   [142], sql: [142], venda: [142] },
      { id: 13530196, // CAMPANHA FORMS (Oferta feita, Negociação)
        mql:   [104390748, 104390752, 142],
        sql:   [104390748, 104390752, 142],
        venda: [142] },
    ],
  },
  // GINE / TREINAMENTO: mapear quando definir os pipelines.
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

// 🔎 Liste pipelines e o ID de cada etapa
function listarPipelinesKommo() {
  const d = _kget('/leads/pipelines');
  ((d._embedded || {}).pipelines || []).forEach(p => {
    Logger.log('PIPELINE  id=' + p.id + '  "' + p.name + '"');
    ((p._embedded || {}).statuses || []).slice().sort((a, b) => a.sort - b.sort)
      .forEach(s => Logger.log('    id=' + s.id + '  "' + s.name + '"'));
  });
}

// conta leads de UM pipeline pelos conjuntos de status
function _contaPipeline(cfg) {
  const mql = new Set(cfg.mql || []), sql = new Set(cfg.sql || []), vend = new Set(cfg.venda || [142]);
  let page = 1, M = 0, S = 0, V = 0, F = 0, L = 0;
  while (page <= 100) {
    const d = _kget('/leads?filter[pipeline_id]=' + cfg.id + '&limit=250&page=' + page);
    const leads = ((d._embedded || {}).leads) || [];
    if (!leads.length) break;
    leads.forEach(l => {
      const st = l.status_id; L++;
      if (mql.has(st)) M++;
      if (sql.has(st)) S++;
      if (vend.has(st)) { V++; F += (l.price || 0); }
    });
    if (leads.length < 250) break;
    page++;
  }
  return { leads: L, mql: M, sql: S, vendas: V, fat: F };
}

// ▶ Principal — soma os pipelines de cada funil e grava na aba "crm"
function atualizarKommo() {
  const out = {};
  Object.keys(MAPA_KOMMO).forEach(funil => {
    const cfg = MAPA_KOMMO[funil];
    const agg = { mql: 0, sql: 0, vendas: 0, fat: 0, leadsCrm: 0, gravaVendas: !!cfg.gravaVendas };
    (cfg.pipelines || []).forEach(p => {
      const r = _contaPipeline(p);
      agg.mql += r.mql; agg.sql += r.sql; agg.vendas += r.vendas; agg.fat += r.fat; agg.leadsCrm += r.leads;
    });
    out[funil] = agg;
  });
  _gravarCrmKommo(out);
  Logger.log('Kommo atualizado: ' + JSON.stringify(out));
}

// upsert por funil: sempre mql/sql; vendas/faturamento só se gravaVendas=true
function _gravarCrmKommo(out) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_CRM_K);
  if (!sh) { sh = ss.insertSheet(ABA_CRM_K); sh.appendRow(['data', 'funil', 'mql', 'sql', 'vendas', 'faturamento']); }
  const rng = sh.getDataRange().getValues();
  const head = rng[0].map(h => String(h).trim().toLowerCase());
  const i = { funil: head.indexOf('funil'), mql: head.indexOf('mql'), sql: head.indexOf('sql'), vendas: head.indexOf('vendas'), faturamento: head.indexOf('faturamento') };
  if (i.funil < 0 || i.mql < 0 || i.sql < 0) throw new Error('A aba "crm" precisa ter colunas: funil, mql, sql.');
  const linha = {};
  for (let r = 1; r < rng.length; r++) { const f = String(rng[r][i.funil] || '').toUpperCase().trim(); if (f) linha[f] = r + 1; }
  Object.keys(out).forEach(funil => {
    const v = out[funil]; let row = linha[funil];
    if (!row) { const nova = new Array(head.length).fill(0); nova[i.funil] = funil; sh.appendRow(nova); row = sh.getLastRow(); }
    sh.getRange(row, i.mql + 1).setValue(v.mql);
    sh.getRange(row, i.sql + 1).setValue(v.sql);
    if (v.gravaVendas && i.vendas >= 0 && i.faturamento >= 0) {
      sh.getRange(row, i.vendas + 1).setValue(v.vendas);
      sh.getRange(row, i.faturamento + 1).setValue(v.fat);
    }
  });
}
