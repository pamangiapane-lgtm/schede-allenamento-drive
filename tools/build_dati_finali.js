/* build_dati_finali.js
 * Produce giocatrici_finali.json e esercizi_finali.json pronti per il Drive:
 * - Giocatrici: + Ruolo (da Sintesi), + Prevenzione_Ind (schede 1-3 dal programma di recupero)
 * - Esercizi: note corrette + Menu_Ruolo sulle righe "Prevenzione ruolo"
 */
const fs = require('fs');
const ROOT = 'C:\\AI\\App deep\\squadra\\';
const out = ROOT + 'tools\\out\\';

const giocatrici = JSON.parse(fs.readFileSync(out + 'giocatrici_live.json', 'utf8').replace(/^\uFEFF/, ''));
const esercizi   = JSON.parse(fs.readFileSync(out + 'esercizi_live.json', 'utf8').replace(/^\uFEFF/, ''));
const prevenzione = JSON.parse(fs.readFileSync(out + 'prevenzione_ind.json', 'utf8'));

/* ---------- ruoli (da Sintesi_Integrata_Atlete.md) ---------- */
const RUOLI = {
  1: 'Palleggiatrice', 2: 'Centrale', 3: 'Schiacciatrice', 4: 'Opposto',
  5: 'Libero', 6: 'Centrale', 7: 'Banda', 8: 'Opposto', 9: 'Banda',
  /* 11 Luna, 12 Erin, 13 Giulia, 14 Nelly: ruolo da confermare con Paolo */
};

/* ---------- mappa nome programma → giocatrice ---------- */
const perNome = {};
giocatrici.forEach(g => { perNome[String(g.Nome || '').trim().toLowerCase()] = g; });

let indOk = 0, indMancanti = [];
giocatrici.forEach(g => {
  const idNum = Number(g.ID);
  if (RUOLI[idNum] && !String(g.Ruolo || '').trim()) g.Ruolo = RUOLI[idNum];
  const chiave = String(g.Nome || '').trim().toLowerCase();
  const prog = prevenzione[chiave.toUpperCase()] || prevenzione[Object.keys(prevenzione).find(k => k.toLowerCase() === chiave)];
  if (prog && prog.ok) {
    const schede = {};
    for (const [n, s] of Object.entries(prog.schede)) {
      schede[n] = {
        titolo: s.titolo, obiettivo: s.obiettivo, durata: s.durata,
        esercizi: s.esercizi.map(e => ({ nome: e.nome, razionale: e.razionale, param: e.param, note: e.note })),
      };
    }
    g.Prevenzione_Ind = JSON.stringify({ schede });
    indOk++;
  } else {
    indMancanti.push(g.Nome);
  }
});

/* ---------- menù prevenzione per ruolo (da Programma_FINALE §11) ---------- */
const MENU_W1 = { 'Centrali': 'Caviglia: heel raise deficit, equilibrio su sabbia', 'Schiacciatrici/Opposti': 'Cuffia: extrarotazioni cavo/elastico, mobilità toracica', 'Palleggiatrici': 'Polso/mani: circonduzioni, presa; spalla leggera', 'Libero': 'Anca/ginocchio: Copenhagen, affondo laterale' };
const MENU_W2 = { 'Centrali': 'Polpaccio carico: heel raise zavorrato, step down', 'Schiacciatrici/Opposti': 'Cuffia sotto carico: extrarot. eccentrica, trap-3', 'Palleggiatrici': 'Avambraccio carico: wrist roller, farmer polsi', 'Libero': 'Eccentrico: nordic assistito, skater' };
const MENU_W3 = { 'Centrali': 'Reattività caviglia: pogo mono, atterraggi da muro', 'Schiacciatrici/Opposti': 'Overhead veloce: lanci MB sopra il capo', 'Palleggiatrici': 'Rapidità mani: palline reattive, dual-task', 'Libero': 'Tuffo e rialzata: cadute controllate su timing' };

function menuPerSettimana(nSeduta) {
  const m = String(nSeduta).match(/^W(\d+)/);
  const w = m ? +m[1] : 0;
  if (w <= 2) return MENU_W1;
  if (w <= 4) return MENU_W2;
  return MENU_W3;
}

let prevRows = 0, noteFixed = 0;
esercizi.forEach(e => {
  if (e.Esercizio === 'Prevenzione ruolo') {
    e.Menu_Ruolo = JSON.stringify(menuPerSettimana(e.N_Seduta));
    prevRows++;
    const n = String(e.Note || '').trim();
    if (n === 'Varianti: 3 serie' || n === 'Varianti: 2-3 serie') {
      e.Note = 'Scegli: menù per ruolo · programma individuale';
      noteFixed++;
    }
  }

  /* --- correzioni note concordate --- */
  if (e.Esercizio === 'Prevenzione ruolo' && String(e.Note || '').includes('dal forza-nel-range di W3-4')) {
    e.Note = String(e.Note).replace('dal forza-nel-range di W3-4', 'dalla forza-nel-range di W3-4');
    noteFixed++;
  }
  if (e.Esercizio === 'Push Press') {
    const nuovo = String(e.Note || '').replace(' · Varianti: Push Press bilanciere · Pulley basso', '');
    if (nuovo !== e.Note) { e.Note = nuovo; noteFixed++; }
  }
  if (e.Esercizio === 'Lat/Pull-up') {
    const nuovo = String(e.Note || '').replace('Varianti: Push Press bilanciere · Pulley basso', 'Varianti: Pulley basso');
    if (nuovo !== e.Note) { e.Note = nuovo; noteFixed++; }
  }
  if (String(e.Note || '').includes('*verifica*')) {
    e.Note = String(e.Note).replace(/\*verifica\*/g, 'verifica');
    noteFixed++;
  }
  if (String(e.Note || '').includes('Front Squat volume ridotto')) {
    e.Note = String(e.Note).replace('Front Squat volume ridotto', 'Front Squat (volume ridotto)');
    noteFixed++;
  }
  if (String(e.Note || '').includes('(cruscotto §10)')) {
    e.Note = String(e.Note).replace('(cruscotto §10)', '(decisione del coach)');
    noteFixed++;
  }
});

fs.writeFileSync(out + 'giocatrici_finali.json', JSON.stringify(giocatrici, null, 2), 'utf8');
fs.writeFileSync(out + 'esercizi_finali.json', JSON.stringify(esercizi, null, 2), 'utf8');
console.log('Giocatrici: ' + giocatrici.length + ' — con programma individuale: ' + indOk + (indMancanti.length ? ' — MANCANTI: ' + indMancanti.join(', ') : ''));
console.log('Righe Prevenzione ruolo con Menu_Ruolo: ' + prevRows);
console.log('Note corrette: ' + noteFixed);
console.log('Scritti giocatrici_finali.json + esercizi_finali.json');
