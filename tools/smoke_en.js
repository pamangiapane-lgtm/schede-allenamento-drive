/* smoke_en.js — verifica rendering EN (menù ruolo bilingue + programma individuale EN) per Nelly */
const fs = require('fs');
const vm = require('vm');
const ROOT = 'C:\\AI\\App deep\\squadra\\';

const html = fs.readFileSync(ROOT + 'scheda.html', 'utf8');
const blocco = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
const snippet = blocco.slice(blocco.indexOf('const PREV_RUOLO_CHIAVE'), blocco.indexOf('function htmlIndividuale'));

const EN = { prevRuolo: 'Role', prevInd: 'Individual', prevNoRuolo: 'n/a role', prevNoInd: 'n/a ind' };
const sandbox = { IT: {}, EN, L: EN, esc: s => String(s ?? '') };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(snippet, sandbox);

const g = JSON.parse(fs.readFileSync(ROOT + 'tools\\out\\giocatrici_finali2.json', 'utf8').replace(/^\uFEFF/, '')).find(x => String(x.ID) === '14');
const es = JSON.parse(fs.readFileSync(ROOT + 'tools\\out\\esercizi_finali2.json', 'utf8').replace(/^\uFEFF/, ''));
const w3 = es.find(x => x.N_Seduta === 'W3-P' && x.Esercizio === 'Prevenzione ruolo');
const w1 = es.find(x => x.N_Seduta === 'W1-P' && x.Esercizio === 'Prevenzione ruolo');

const o3 = sandbox.htmlPrevenzione(w3, g, 'log-14-W3-P-3-3');
const o1 = sandbox.htmlPrevenzione(w1, g, 'log-14-W1-P-3-3');

console.log('=== Nelly (Banda, EN) W3-P — attesa ruolo EN "Loaded cuff" + scheda 2 EN ===');
console.log('card name "Role Prevention":', o3.includes('Role Prevention'));
console.log('ruolo EN "Loaded cuff":', o3.includes('Loaded cuff'));
console.log('individuale "INTERMEDIATE PHASE":', o3.includes('INTERMEDIATE PHASE'));
console.log('individuale "Scapular Wall Slides (Right)":', o3.includes('Scapular Wall Slides (Right)'));
console.log('dose W3 "3x8":', o3.includes('3x8'));
console.log();
console.log('=== Nelly W1-P — attesa ruolo EN "Ankle: heel raise" + scheda 1 EN ===');
console.log('ruolo EN "Ankle: heel raise":', o1.includes('Ankle: heel raise'));
console.log('individuale "INITIAL PHASE":', o1.includes('INITIAL PHASE'));
console.log();
console.log('--- estratto ruolo W3-P ---');
const m = o3.match(/prev-panel" data-panel="ruolo"[^>]*>([\s\S]*?)<\/div>/);
console.log(m ? m[1].slice(0, 220) : 'NON TROVATO');
