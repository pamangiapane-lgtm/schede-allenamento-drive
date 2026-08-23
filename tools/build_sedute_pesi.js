/* ============================================================
 * build_sedute_pesi.js
 * Converte le Scheda_Sedute_W1..W6_FINALE.md (sezioni PALESTRA)
 * in sedute.json + esercizi.json nel formato dell'app.
 *
 * Uso: node tools/build_sedute_pesi.js <dir_schede_md> <out_dir>
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || 'C:\\AI\\pre season 26\\programmi\\preseason_a2_2026\\sedute';
const OUT = process.argv[3] || 'C:\\AI\\App deep\\squadra\\tools\\out';

/* ---------- normalizzazione nomi ---------- */
function pulisci(s) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nomeBase(cellaEsercizio, fase) {
  let nome = pulisci(cellaEsercizio).split(',')[0];
  // casi speciali: normalizzazione per esercizi stabili
  const f = pulisci(fase).toLowerCase();
  const n = nome.toLowerCase();

  if (f.includes('prevenzione')) return 'Prevenzione ruolo';
  if (f.includes('cmj')) return 'CMJ (controllo)';
  if (f.includes('verifica') && n.includes('cmj')) return 'CMJ (verifica)';
  if (/^mobilit/.test(n)) return 'Mobilità';
  if (f.includes('scarico')) return 'Mobilità';
  if (/^hinge/i.test(n)) return 'Stacco Rumeni';
  if (/^row bilanciere/i.test(n)) return 'Row / Lat machine';
  if (/^jump squat/i.test(n)) return 'Jump squat';
  if (/^squat veloce/i.test(n)) return 'Squat veloce';
  if (/^squat pesante/i.test(n)) return 'Contrasto Squat/Jump';
  if (/^squat, cluster/i.test(n) || /^squat, carico/i.test(n)) {
    if (f.includes('vbt')) return 'Squat (VBT)';
    return 'Squat';
  }
  if (/^box jump \+ salti specifici/i.test(n)) return 'Box jump + salti muro/attacco';
  if (/^box jump, box basso/i.test(n)) return 'Box jump';
  if (/^box jump atterraggio/i.test(n)) return 'Box jump';
  if (/^drop jump/i.test(n)) return 'Drop Jump';
  if (/^pallof o deadbug/i.test(n)) return 'Pallof / Deadbug';
  if (/^deadbug o pallof/i.test(n)) return 'Deadbug / Pallof';
  if (/^glutei/i.test(n)) return 'Glutei (banda) + CMJ';
  if (/^lanci mb/i.test(n)) return 'Lanci MB + salti bassi';
  if (/^drop-landing/i.test(n) || /^da 20cm/i.test(n)) return 'Drop-landing';
  if (/^superman/i.test(n)) return 'Superman hold';
  if (/^rotaz/i.test(n)) return 'Rotazioni tronco';
  return nome;
}

/* ---------- parsing volume ---------- */
function parseVolume(v, fase) {
  const raw = pulisci(v);
  const f = pulisci(fase).toLowerCase();
  if (!raw || raw === '—' || raw === '-') return { Serie: '', Reps: '' };

  // durate (4', 6', 10', 5', 4'+3', 8')
  if (/^[\d.]+'(\+[\d.]+')?$/.test(raw)) return { Serie: '', Reps: raw };

  // 2-3 serie / 3 serie
  if (/^[\d-]+ serie$/.test(raw)) {
    const m = raw.match(/^([\d-]+)/);
    return { Serie: m[1], Reps: '' };
  }

  // 3 salti / 3 salti, media
  if (/^3 salti/.test(raw)) return { Serie: '', Reps: '3 salti' };

  // 3×(2+1)
  let m = raw.match(/^(\d+)×\((\d+\+\d+)\)$/);
  if (m) return { Serie: m[1], Reps: '(' + m[2] + ')' };

  // 2×10+10
  m = raw.match(/^(\d+)×(\d+\+\d+)$/);
  if (m) return { Serie: m[1], Reps: m[2] };

  // 3×45"/45"
  m = raw.match(/^(\d+)×([\d.]+"\/[\d.]+")$/);
  if (m) return { Serie: m[1], Reps: m[2] };

  // 2×20m+2×20"
  m = raw.match(/^(\d+)×([\d.]+m\+[\d.]+")$/);
  if (m) return { Serie: m[1], Reps: m[2] };

  // 4×20m / 2×15m / 3×15m / 2×10 / 4× (6-8m/passaggio)
  m = raw.match(/^(\d+)×([\d.]+[m"]?)$/);
  if (m) return { Serie: m[1], Reps: m[2] };
  m = raw.match(/^(\d+)×\s*\((.+)\)$/);
  if (m) return { Serie: m[1], Reps: m[2] };

  // 4×2, 3×4, 2×3, 5×1, 4×1, 3×3, 2×2, 3×4, 2×4, 2×6, 3×6, 3×7, 3×5...
  m = raw.match(/^(\d+)×(\d+)$/);
  if (m) return { Serie: m[1], Reps: m[2] };

  // Banda 3×4 · Centrali/Palleggio 2×4 (volumi per ruolo) — prima cifra = banda
  m = raw.match(/^Banda\s+(\d+)×(\d+)/i);
  if (m) return { Serie: m[1] + '×' + m[2] + ' (banda)', Reps: raw };

  // 2 rip pesanti + 3 rip salto, ×3 complessi
  if (/rip/.test(raw)) {
    const c = raw.match(/×(\d+)\s+complessi/);
    return { Serie: c ? c[1] : '', Reps: raw };
  }

  // fallback: riga grezza in Reps
  return { Serie: '', Reps: raw };
}

/* ---------- log libero / catena ---------- */
function isLogLibero(nome, intensita) {
  const n = String(nome).toLowerCase();
  const i = String(intensita || '');
  if (/%/.test(i)) return 'SI';
  if (/^(squat|row|bench|clean|push press|lat|pull|hinge|stacco|jump squat|contrasto)/.test(n)) return 'SI';
  return 'NO';
}

function catena(nome) {
  const n = String(nome).toLowerCase();
  if (/squat|stacco|hinge|jump/.test(n)) return 'lower';
  if (/row|bench|press|lat|pull|clean|tirata/.test(n)) return 'upper';
  if (/pallof|deadbug|superman|rotaz|plank/.test(n)) return 'core';
  return '';
}

/* ---------- parsing markdown ---------- */
function parseScheda(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const righe = txt.split(/\r?\n/);
  const sedute = []; // {titolo, tipo, giorno, righeTabella[]}
  let i = 0;

  while (i < righe.length) {
    const r = righe[i];
    const mSec = r.match(/^##\s+(.*?)\s*—\s*PALESTRA/i);
    if (mSec) {
      const titolo = r.replace(/^##\s+/, '');
      // tipo P / V / R
      let tipo = 'R';
      if (/PALESTRA\s+P\b/i.test(titolo)) tipo = 'P';
      else if (/PALESTRA\s+V\b/i.test(titolo)) tipo = 'V';
      else if (/PALESTRA\s+richiamo/i.test(titolo)) tipo = 'R';

      let giorno = '';
      const mg = titolo.match(/^(LUNEDÌ|MARTEDÌ|MERCOLEDÌ|GIOVEDÌ|VENERDÌ)/i);
      if (mg) giorno = mg[1].toUpperCase();

      // raccogli la tabella che segue (finché non c'è una riga vuota + titolo)
      const tab = [];
      let j = i + 1;
      while (j < righe.length && !/^##\s/.test(righe[j])) {
        const tr = righe[j].trim();
        if (tr.startsWith('|') && !tr.startsWith('|---')) {
          // salta header e separatore
          if (/^\| Ord\.? \|/i.test(tr)) { j++; continue; }
          tab.push(tr);
        }
        j++;
      }
      sedute.push({ titolo, tipo, giorno, tab });
      i = j;
      continue;
    }
    i++;
  }
  return sedute;
}

function parseRigaTabella(tr) {
  const celle = tr.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  if (celle.length < 7) return null;
  return {
    ord: celle[0],
    fase: pulisci(celle[1]),
    esercizio: pulisci(celle[2]),
    descrizione: pulisci(celle[3]),
    varianti: pulisci(celle[4]),
    volume: pulisci(celle[5]),
    intensita: pulisci(celle[6]),
    recupero: celle.length > 7 ? pulisci(celle[7]) : '',
    rpe: celle.length > 8 ? pulisci(celle[8]) : '',
  };
}

/* split superserie "Row 3×5 ss Bench 3×5" */
function splitSuperserie(nome) {
  const m = nome.match(/^(.+?)\s+(\d+)×(\d+)\s+ss\s+(.+?)\s+(\d+)×(\d+)$/);
  if (!m) return null;
  return [
    { nome: m[1].trim(), serie: m[2], reps: m[3] },
    { nome: m[4].trim(), serie: m[5], reps: m[6] },
  ];
}

/* ---------- generazione ---------- */
const SETTIMANA = { W1: 1, W2: 2, W3: 3, W4: 4, W5: 5, W6: 6 };
const GIORNI = { 'LUNEDÌ': 'Lunedì', 'MARTEDÌ': 'Martedì', 'MERCOLEDÌ': 'Mercoledì', 'GIOVEDÌ': 'Giovedì', 'VENERDÌ': 'Venerdì' };

const seduteOut = [];
const eserciziOut = [];
let ordine = 0;

for (let w = 1; w <= 6; w++) {
  const wk = 'W' + w;
  const file = path.join(DIR, `Scheda_Sedute_${wk}_FINALE.md`);
  if (!fs.existsSync(file)) { console.error('Manca: ' + file); continue; }
  const sezioni = parseScheda(file);

  // ordine dei tipi nella settimana (P, V, R) come compaiono
  for (const sez of sezioni) {
    const tipo = sez.tipo;
    const suffisso = tipo === 'P' ? 'P' : tipo === 'V' ? 'V' : 'R';
    const num = `${wk}-${suffisso}`;
    ordine++;
    const nomeSed = `${wk} — ${tipo === 'P' ? 'Palestra P' : tipo === 'V' ? 'Palestra V' : 'Richiamo'} (${GIORNI[sez.giorno] || sez.giorno})`;
    seduteOut.push({ ID_Giocatrice: 0, Numero_Seduta: num, Nome_Seduta: nomeSed, Ordine: ordine });

    const fasiViste = {};
    let ordMetodo = 0;

    for (const tr of sez.tab) {
      const row = parseRigaTabella(tr);
      if (!row) continue;
      if (!row.esercizio || row.esercizio === '—') continue;

      const fase = pulisci(row.fase) || '—';
      if (!fasiViste[fase]) { fasiViste[fase] = true; ordMetodo++; }

      const nome = nomeBase(row.esercizio, fase);
      const note = row.descrizione && row.descrizione !== '—'
        ? row.descrizione + (row.varianti && row.varianti !== '—' ? ` · Varianti: ${row.varianti}` : '')
        : (row.varianti && row.varianti !== '—' ? `Varianti: ${row.varianti}` : '');

      const vol = parseVolume(row.volume, fase);
      const intensita = row.intensita && row.intensita !== '—' ? row.intensita : '';
      const recupero = row.recupero && row.recupero !== '—' && !/come indicato/i.test(row.recupero) ? row.recupero : '';
      const rpe = row.rpe && row.rpe !== '—' ? row.rpe : '';

      // superserie?
      const ss = splitSuperserie(row.esercizio);
      if (ss) {
        ss.forEach((s, idx) => {
          eserciziOut.push({
            N_Seduta: num, ID_Giocatrice: 0, Escludi_ID: '',
            Ord_Metodo: ordMetodo, Ord_Eserc: Number(row.ord) + idx * 0.1,
            Esercizio: s.nome, Esercizio_EN: '', Metodo: fase, Desc_Metodo: '',
            Serie: s.serie, Reps: s.reps, 'Intensità': intensita, Recupero: recupero,
            RPE: rpe, Log_Libero: isLogLibero(s.nome, intensita), Tipo_Esercizio: '',
            Catena: catena(s.nome), SerieB: '', RepsB: '', 'IntensitàB': '', RecuperoB: '',
            Num_Ripetizioni: '', Istruzione: '', Note: note, VideoURL: ''
          });
        });
      } else {
        eserciziOut.push({
          N_Seduta: num, ID_Giocatrice: 0, Escludi_ID: '',
          Ord_Metodo: ordMetodo, Ord_Eserc: Number(row.ord) || 1,
          Esercizio: nome, Esercizio_EN: '', Metodo: fase, Desc_Metodo: '',
          Serie: vol.Serie, Reps: vol.Reps, 'Intensità': intensita, Recupero: recupero,
          RPE: rpe, Log_Libero: isLogLibero(nome, intensita), Tipo_Esercizio: '',
          Catena: catena(nome), SerieB: '', RepsB: '', 'IntensitàB': '', RecuperoB: '',
          Num_Ripetizioni: '', Istruzione: '', Note: note, VideoURL: ''
        });
      }
    }
  }
}

/* ---------- scrittura ---------- */
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'sedute.json'), JSON.stringify(seduteOut, null, 2), 'utf8');
fs.writeFileSync(path.join(OUT, 'esercizi.json'), JSON.stringify(eserciziOut, null, 2), 'utf8');

console.log(`Sedute generate: ${seduteOut.length}`);
console.log(`Esercizi generati: ${eserciziOut.length}`);
console.log('Sedute:');
seduteOut.forEach(s => console.log(`  ${s.Numero_Seduta} — ${s.Nome_Seduta}`));
