/* ============================================================
 * enrich_note_esercizi.js
 * Arricchisce gli esercizi W1-W6 con Note/Istruzione/Esercizio_EN
 * riusati dagli esercizi ORIGINALI (stesso nome) — stile note originale.
 *
 * Uso: node tools/enrich_note_esercizi.js <out_esercizi.json> <backup_esercizi.json>
 * ============================================================ */
const fs = require('fs');

function leggiJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}

const OUT   = process.argv[2] || 'C:\\AI\\App deep\\squadra\\tools\\out\\esercizi.json';
const BACK  = process.argv[3] || 'C:\\AI\\App deep\\squadra\\backup\\2026-08-22-pre-upload\\Esercizi.json';

const nuovi = leggiJson(OUT);
const orig  = leggiJson(BACK);

/* dizionario: nome originale → primo oggetto con Istruzione */
const dict = {};
orig.forEach(o => {
  const k = String(o.Esercizio || '').trim();
  if (!k || dict[k]) return;
  dict[k] = o;
});

/* equivalenze: nome nuovo → candidati originali (in ordine di preferenza) */
const MAP = {
  'Squat':                    ['Squat', 'Box Squat BB', 'Box Squat'],
  'Squat veloce':             ['Squat', 'Squat Jump'],
  'Squat (VBT)':              ['Squat', 'Box Squat BB'],
  'Jump squat':               ['Squat Jump', 'Squat Jump senza carico'],
  'Contrasto Squat/Jump':     ['Squat Jump', 'Squat'],
  'Row':                      ['Row BB'],
  'Row / Lat machine':        ['Row BB', 'Pull-up / Lat Machine'],
  'Bench':                    ['Bench Press BB'],
  'Clean':                    ['Clean', 'Clean o Snatch', 'Hang Power Clean'],
  'Push Press':               ['Push Press manubri', 'Push Press con manubri'],
  'Lat/Pull-up':              ['Pull-up / Lat Machine', 'Lat Machine'],
  'Pallof':                   ['Pallof Press con elastico', 'Single Leg Pallof'],
  'Pallof in ginocchio':      ['Pallof Press con elastico', 'Single Leg Pallof'],
  'Pallof / Deadbug':         ['Pallof Press con elastico'],
  'Deadbug / Pallof':         ['Pallof Press con elastico'],
  'Stacco Rumeni':            ['Stacchi Rumeni'],
  'Box jump':                 ['Box Jump', 'Box Jump bipodalico'],
  'Box jump + salti muro/attacco': ['Box Jump', 'Box Jump bipodalico'],
  'Box jump + contrasto (squat leggero → salto verticale immediato)': ['Box Jump', 'Box Jump bipodalico'],
  'Drop Jump':                ['Box Jump', 'Box Jump bipodalico'],
  'Drop-landing':             ['Box Jump', 'Box Jump bipodalico'],
  'Rotazioni tronco':         ['Esercizio di rotazione', 'Rotational MB Throw'],
  'Lanci MB + salti bassi':   ['Standing MB Overhead Throw', 'Rotational MB Throw'],
  'CMJ (controllo)':          ['CMJ (Counter-Movement Jump)'],
  'CMJ (verifica)':           ['CMJ (Counter-Movement Jump)'],
  'Glutei (banda) + CMJ':     ['CMJ (Counter-Movement Jump)'],
};

let arricchiti = 0, senzaMatch = 0;
const mancanti = [];

nuovi.forEach(e => {
  const candidati = MAP[e.Esercizio] || [];
  let src = null;
  for (const c of candidati) {
    if (dict[c]) { src = dict[c]; break; }
  }
  if (!src || !src.Istruzione) {
    senzaMatch++;
    mancanti.push(e.Esercizio);
    return;
  }
  e.Istruzione = src.Istruzione;
  if (src.Esercizio_EN) e.Esercizio_EN = src.Esercizio_EN;
  if (!e.Note && src.Note) e.Note = src.Note;
  arricchiti++;
});

fs.writeFileSync(OUT, JSON.stringify(nuovi, null, 2), 'utf8');
console.log(`Arricchiti con note/istruzioni: ${arricchiti}`);
console.log(`Senza fonte (resta descrizione breve): ${senzaMatch}`);
console.log('Senza fonte:');
mancanti.forEach(m => console.log('  ' + m));
