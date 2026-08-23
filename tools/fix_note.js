/* fix_note.js — corregge istruzioni non adatte (Drop Jump/Drop-landing, Row/Lat machine) */
const fs = require('fs');
const file = process.argv[2] || 'C:\\AI\\App deep\\squadra\\tools\\out\\esercizi.json';
const esercizi = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

const DROP_JUMP = JSON.stringify({
  h: 'Sali sul rialzo (20-25 cm). Scendi in avanti e al contatto atterra sulla parte anteriore del piede: rimbalzo elastico immediato, tempo di contatto minimo.',
  f: 'Caviglie reattive, talloni quasi a terra, spinta subito dopo l\'atterraggio.',
  a: 'Non atterrare a piedi piatti né con le ginocchia che collassano verso l\'interno.',
  h_en: 'Step onto the box (20-25 cm). Step off forward and land on the balls of your feet: immediate elastic rebound, minimal ground contact time.',
  f_en: 'Reactive ankles, heels almost touching the ground, push off right after landing.',
  a_en: 'Don\'t land flat-footed or let your knees cave inward.'
});

const DROP_LANDING = JSON.stringify({
  h: 'Sali sul rialzo (20 cm), scendi e atterra in modo controllato: ammortizza flettendo anche, ginocchia e caviglie, poi fermati in posizione atletica.',
  f: 'Atterraggio morbido e silenzioso, controllo del ginocchio, posizione stabile.',
  a: 'Non atterrare a gambe rigide né con le ginocchia che collassano verso l\'interno.',
  h_en: 'Step onto the box (20 cm), step off and land under control: absorb by bending hips, knees and ankles, then hold an athletic stance.',
  f_en: 'Soft, quiet landing, knee control, stable position.',
  a_en: 'Don\'t land with stiff legs or with knees caving in.'
});

let nDrop = 0, nRow = 0;
esercizi.forEach(e => {
  if (e.Esercizio === 'Drop Jump') { e.Istruzione = DROP_JUMP; nDrop++; }
  if (e.Esercizio === 'Drop-landing') { e.Istruzione = DROP_LANDING; nDrop++; }
  if (e.Esercizio === 'Row / Lat machine') { e.Istruzione = ''; e.Esercizio_EN = ''; nRow++; }
});

fs.writeFileSync(file, JSON.stringify(esercizi, null, 2), 'utf8');
console.log(`Drop Jump/Drop-landing corrette: ${nDrop}`);
console.log(`Row / Lat machine: istruzioni rimosse (${nRow}), resta la descrizione`);
