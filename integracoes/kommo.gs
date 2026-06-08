/**
 * Integração Kommo → Planilha (aba "crm") — MQL, SQL e vendas por funil E POR DATA.
 * ---------------------------------------------------------------------------------
 * 🔐 Propriedades do script (⚙ Configurações do projeto):
 *      KOMMO_SUBDOMAIN = leonardogestaoimpactocom
 *      KOMMO_TOKEN     = (token de longa duração)
 *
 * Grava na aba "crm" uma linha por (funil, data de entrada do lead):
 *      date | funil | mql | sql | vendas | faturamento
 * Assim o painel filtra MQL/SQL/Vendas por período igual ao tráfego.
 *
 * ▶ Rode "atualizarKommo" (e agende no relógio → Diário). "listarPipelinesKommo" mostra os IDs das etapas.
 */

const ABA_CRM_K = 'crm';
const TZ_OFFSET_H = -3; // fuso de Brasília para datar o lead

// HOME = soma de 4 pipelines. Para cada um, status_id que contam como MQL / SQL / Venda.
const MAPA_KOMMO = {
  HOME: {
    pipelines: [
      { id: 13684264, mql:[105607012,106485812,106485816,106485820,106485824,106485828,106485832,142], sql:[106485812,106485824,106485828,106485832,142], venda:[106485828,142] }, // HOME NOVO
      { id: 13679504, mql:[105569528,105661040,105569248,142], sql:[105661040,105569248,142], venda:[142] }, // IA
      { id: 11411643, mql:[142], sql:[142], venda:[142] }, // Funil de Vendas
      { id: 13530196, mql:[104390748,104390752,142], sql:[104390748,104390752,142], venda:[142] }, // CAMPANHA FORMS
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
function _diaDoLead(unixSec) {
  if (!unixSec) return '';
  const d = new Date((unixSec + TZ_OFFSET_H * 3600) * 1000);
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

function listarPipelinesKommo() {
  const d = _kget('/leads/pipelines');
  ((d._embedded || {}).pipelines || []).forEach(p => {
    Logger.log('PIPELINE  id=' + p.id + '  "' + p.name + '"');
    ((p._embedded || {}).statuses || []).slice().sort((a, b) => a.sort - b.sort).forEach(s => Logger.log('    id=' + s.id + '  "' + s.name + '"'));
  });
}

// agrega um pipeline em buckets por data: { 'YYYY-MM-DD': {mql,sql,vendas,fat} }
function _bucketsPipeline(cfg, acc) {
  const mql = new Set(cfg.mql || []), sql = new Set(cfg.sql || []), vend = new Set(cfg.venda || [142]);
  let page = 1;
  while (page <= 100) {
    const d = _kget('/leads?filter[pipeline_id]=' + cfg.id + '&limit=250&page=' + page);
    const leads = ((d._embedded || {}).leads) || [];
    if (!leads.length) break;
    leads.forEach(l => {
      const dia = _diaDoLead(l.created_at);
      const b = acc[dia] || (acc[dia] = { mql: 0, sql: 0, vendas: 0, fat: 0 });
      const st = l.status_id;
      if (mql.has(st)) b.mql++;
      if (sql.has(st)) b.sql++;
      if (vend.has(st)) { b.vendas++; b.fat += (l.price || 0); }
    });
    if (leads.length < 250) break;
    page++;
  }
  return acc;
}

// ▶ Principal — gera linhas (funil,data) e reescreve a aba "crm"
function atualizarKommo() {
  const linhas = [];
  Object.keys(MAPA_KOMMO).forEach(funil => {
    const acc = {};
    (MAPA_KOMMO[funil].pipelines || []).forEach(p => _bucketsPipeline(p, acc));
    Object.keys(acc).sort().forEach(dia => {
      const b = acc[dia];
      if (b.mql || b.sql || b.vendas || b.fat) linhas.push([dia, funil, b.mql, b.sql, b.vendas, Math.round(b.fat * 100) / 100]);
    });
  });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_CRM_K);
  if (!sh) sh = ss.insertSheet(ABA_CRM_K);
  sh.clearContents();
  sh.getRange(1, 1, 1, 6).setValues([['date', 'funil', 'mql', 'sql', 'vendas', 'faturamento']]);
  if (linhas.length) sh.getRange(2, 1, linhas.length, 6).setValues(linhas);
  Logger.log('Kommo: ' + linhas.length + ' linhas (funil×data) gravadas na aba crm.');
}
