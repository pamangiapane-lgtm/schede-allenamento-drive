/* analizza_note.js — dump campo Note di tutti gli esercizi live + flag qualità */
const fs = require('fs');
const ROOT = 'C:\\AI\\App deep\\squadra\\';
const live = JSON.parse(fs.readFileSync(ROOT + 'tools\\out\\esercizi_live.json', 'utf8').replace(/^\uFEFF/, ''));
const loc  = JSON.parse(fs.readFileSync(ROOT + 'tools\\out\\esercizi.json', 'utf8').replace(/^\uFEFF/, ''));
const pre  = JSON.parse(fs.readFileSync(ROOT + 'backup\\2026-08-23-pre-enrich\\Esercizi.json', 'utf8').replace(/^\uFEFF/, ''));

const MOJ = /[ÃÂ][\u0080-\u00BF]|â€|â–|Â |Ã /;
const out = [];
let mojTot = 0, senzaNote = 0, senzaIstr = 0;

live.forEach((e, i) => {
  const l = loc.find(x => x.N_Seduta === e.N_Seduta && x.Esercizio === e.Esercizio && x.Ord_Metodo === e.Ord_Metodo && x.Ord_Eserc === e.Ord_Eserc);
  const p = pre.find(x => x.N_Seduta === e.N_Seduta && x.Esercizio === e.Esercizio && x.Ord_Metodo === e.Ord_Metodo && x.Ord_Eserc === e.Ord_Eserc);
  const note = String(e.Note || '').trim();
  const campi = [e.Note, e.Istruzione, e.Esercizio, e.Metodo, e.Desc_Metodo, e.Esercizio_EN].join(' ');
  const flags = [];
  if (MOJ.test(campi)) { flags.push('MOJIBAKE'); mojTot++; }
  if (!note) { flags.push('NO_NOTE'); senzaNote++; }
  if (!String(e.Istruzione || '').trim()) { flags.push('NO_ISTR'); senzaIstr++; }
  let cmp = 'OK';
  if (!l) cmp = 'NON_IN_LOC';
  else if ((l.Note || '') !== (e.Note || '')) cmp = 'NOTE_DIVERSE';
  else if ((l.Istruzione || '') !== (e.Istruzione || '')) cmp = 'ISTR_DIVERSE';
  const orig = p ? ((p.Note || '').trim() === note ? 'AS_BUILD' : 'ENRICH') : 'NUOVO';
  const istr = String(e.Istruzione || '').trim();
  const istrKeys = istr ? (() => { try { return Object.keys(JSON.parse(istr)).join(','); } catch (x) { return 'JSON_INVALIDO'; } })() : '-';
  out.push(`${String(i + 1).padStart(3)}|${e.N_Seduta}|${String(e.Ord_Metodo).padStart(2)}.${String(e.Ord_Eserc).padStart(2)}|${e.Esercizio}|${cmp}|${orig}|${flags.join(',') || '-'}|istr:${istrKeys}|NOTE: ${note}`);
});

fs.writeFileSync(ROOT + 'tools\\_analisi_note.txt', out.join('\n'), 'utf8');
console.log('TOT=' + live.length + ' MOJIBAKE=' + mojTot + ' SENZA_NOTE=' + senzaNote + ' SENZA_ISTR=' + senzaIstr);
