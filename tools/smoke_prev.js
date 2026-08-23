/* smoke_prev.js — simula htmlPrevenzione con dati reali (estrazione mirata delle funzioni) */
const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:\\AI\\App deep\\squadra\\';

const html = fs.readFileSync(ROOT + 'scheda.html', 'utf8');
const blocco = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
const da = blocco.indexOf('const PREV_RUOLO_CHIAVE');
const a  = blocco.indexOf('function htmlIndividuale');
const snippet = blocco.slice(da, a);

const sandbox = {
  L: { serie: 'Serie', intensity: 'Intensità', rest: 'Recupero', prevRuolo: 'Ruolo', prevInd: 'Individuale', prevNoRuolo: 'n/a ruolo', prevNoInd: 'n/a ind', repeat: n => n, prehabFreq: 'x' },
  EN: {}, IT: {},
  esc: s => String(s ?? ''),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(snippet, sandbox);

/* dati reali */
const g = JSON.parse(fs.readFileSync(ROOT + 'tools\\out\\giocatrici_finali.json', 'utf8').replace(/^\uFEFF/, '')).find(x => String(x.ID) === '1');
const es = JSON.parse(fs.readFileSync(ROOT + 'tools\\out\\esercizi_finali.json', 'utf8').replace(/^\uFEFF/, ''));
const w1 = es.find(x => x.N_Seduta === 'W1-P' && x.Esercizio === 'Prevenzione ruolo');
const w4 = es.find(x => x.N_Seduta === 'W4-P' && x.Esercizio === 'Prevenzione ruolo');
const w6g = es.find(x => x.N_Seduta === 'W6-P' && x.Esercizio === 'Prevenzione ruolo') || null;

const out1 = sandbox.htmlPrevenzione(w1, g, 'log-1-W1-P-3-3');
const out4 = sandbox.htmlPrevenzione(w4, g, 'log-1-W4-P-5-5');
console.log('=== W1-P (attesa: ruolo Palleggiatrici W1-2, scheda 1, dose W1) ===');
console.log('contiene "Polso/mani":', out1.includes('Polso/mani'));
console.log('contiene "FASE INIZIALE":', out1.includes('FASE INIZIALE'));
console.log('contiene "3x8" (dose W1):', out1.includes('3x8'));
console.log('default attivo = ind:', out1.includes('class="prev-btn active" data-opt="ind"'));
console.log();
console.log('=== W4-P (attesa: ruolo Palleggiatrici W3-4, scheda 2, dose W4) ===');
console.log('contiene "wrist roller":', out4.includes('wrist roller'));
console.log('contiene "FASE INTERMEDIA":', out4.includes('FASE INTERMEDIA'));
console.log('contiene "3x15" (dose W4):', out4.includes('3x15'));
console.log();
console.log('W6-P Prevenzione presente nei dati:', !!w6g);
console.log();
console.log('--- estratto W1-P (inizio) ---');
console.log(out1.slice(0, 300));
