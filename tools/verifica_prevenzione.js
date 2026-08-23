/* verifica_prevenzione.js — stampa panoramica + anomalie del parse */
const fs = require('fs');
const P = 'C:\\AI\\App deep\\squadra\\tools\\out\\prevenzione_ind.json';
const d = JSON.parse(fs.readFileSync(P, 'utf8'));
let anomalie = 0;
for (const [nome, v] of Object.entries(d)) {
  console.log(`== ${nome} ${v.ok ? '' : '(NON OK)'}`);
  for (const [n, s] of Object.entries(v.schede)) {
    console.log(`  S${n}: ${s.titolo}`);
    s.esercizi.forEach(e => {
      const wk = Object.entries(e.param.weeks).map(([w, val]) => `W${w}=${val}`).join(' ');
      const riga = `    - ${e.nome} | ${wk || ('RAW: ' + e.param.extra)} | RPE ${e.param.rpe} | ${e.param.tempo} | ${e.note.slice(0, 60)}`;
      console.log(riga);
      if (!Object.keys(e.param.weeks).length && !e.param.extra) { console.log('      ⚠ ANOMALIA: parametri vuoti'); anomalie++; }
      if (e.note.includes('|')) { console.log('      ⚠ ANOMALIA: pipe nella nota'); anomalie++; }
      if (e.nome.length > 60) { console.log('      ⚠ ANOMALIA: nome lungo (forse celle fuse)'); anomalie++; }
    });
  }
}
console.log('ANOMALIE TOTALI: ' + anomalie);
