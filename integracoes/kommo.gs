/**
 * Integração Kommo → Planilha (aba "crm") — MQL, SQL e (opcional) vendas por funil.
 * ---------------------------------------------------------------------------------
 * 🔐 Propriedades do script (⚙ Configurações do projeto):
 *      KOMMO_SUBDOMAIN = leonardogestaoimpactocom
 *      KOMMO_TOKEN     = (token de longa duração)
 *
 * Conta: leonardogestaoimpactocom.kommo.com (id 34771623)
 *
 * Como definir as etapas de cada funil:
 *   1) Rode "listarPipelinesKommo" → Registros (Ctrl+Enter): mostra pipelines e o ID de cada etapa.
 *   2) Em MAPA_KOMMO, liste os IDs das etapas que contam como MQL, como SQL e como Venda.
 *   3) Rode "atualizarKommo" e agende (relógio → Diário).
 */

const ABA_CRM_K = 'crm';

// ----------------------------------------------------------------------------------
//  MAPA: para cada funil, quais ETAPAS (status_id) contam como MQL, SQL e Venda.
//  HOME já vem pré-preenchido (pipeline "HOME NOVO" id 13684264) — ajuste se quiser.
// ----------------------------------------------------------------------------------
const MAPA_KOMMO = {
  HOME: {
    pipelineId: 13684264, // "HOME NOVO"
    // MQL = lead QUALIFICADO (passou por "AGENDADO QUALIFICADO" em diante). Exclui "não qualificado" e "desqualificado/perdido".
    mqlStatus:   [105607012, 106485812, 106485816, 106485820, 106485824, 106485828, 106485832, 142],
    //            AGENDADO QUALIF. · PARTICIPOU CALL · REAGENDOU · NOSHOW · NEGOCIANDO · VENDA FEITA · PROX TURMA · ganho
    // SQL = lead que ENGAJOU com vendas (participou da call / negociando / vendeu).
    sqlStatus:   [106485812, 106485824, 106485828, 106485832, 142],
    //            PARTICIPOU CALL · NEGOCIANDO · VENDA FEITA · PROX TURMA · ganho
    // VENDA = "VENDA FEITA" + "Venda ganha" (142). Soma price = faturamento.
    vendaStatus: [106485828, 142],
    gravaVendas: true, // HOME fecha venda no CRM
  },
  // GINE:        { pipelineId: 0, mqlStatus:[], sqlStatus:[], vendaStatus:[142], gravaVendas:false }, // rode listarPipelinesKommo p/ achar
  // TREINAMENTO: { pipelineId: 0, mqlStatus:[], sqlStatus:[], vendaStatus:[142], gravaVendas:true },
};

// ----------------------------------------------------------------------------------
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

// 🔎 Liste pipelines e o ID de cada etapa (para montar as listas de MQL/SQL/Venda)
function listarPipelinesKommo() {
  const d = _kget('/leads/pipelines');
  ((d._embedded || {}).pipelines || []).forEach(p => {
    Logger.log('PIPELINE  id=' + p.id + '  "' + p.name + '"');
    ((p._embedded || {}).statuses || []).slice().sort((a, b) => a.sort - b.sort)
      .forEach(s => Logger.log('    id=' + s.id + '  "' + s.name + '"'));
  });
}

// ▶ Função principal — conta MQL/SQL/vendas por funil e grava na aba "crm"
function atualizarKommo() {
  const out = {};
  Object.keys(MAPA_KOMMO).forEach(funil => {
    const cfg = MAPA_KOMMO[funil];
    const mqlS = new Set(cfg.mqlStatus || []), sqlS = new Set(cfg.sqlStatus || []), vS = new Set(cfg.vendaStatus || [142]);
    let page = 1, mql = 0, sql = 0, vendas = 0, fat = 0;
    while (page <= 100) {
      const d = _kget('/leads?filter[pipeline_id]=' + cfg.pipelineId + '&limit=250&page=' + page);
      const leads = ((d._embedded || {}).leads) || [];
      if (!leads.length) break;
      leads.forEach(l => {
        const st = l.status_id;
        if (mqlS.has(st)) mql++;
        if (sqlS.has(st)) sql++;
        if (vS.has(st)) { vendas++; fat += (l.price || 0); }
      });
      if (leads.length < 250) break;
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
