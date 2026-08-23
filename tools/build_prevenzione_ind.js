/* build_prevenzione_ind.js
 * Estrae dagli PROGRAMMA_RECUPERO_*.md (parte 2: le 3 schede)
 * il programma individuale di prevenzione per ogni atleta.
 * Output: tools/out/prevenzione_ind.json  { ID: {schede:{1:{...},2:{...},3:{...}}} }
 */
const fs = require('fs');
const path = require('path');

const DIR_ATLETE = 'C:\\AI\\Pallavolo\\Marsala volley\\02_Atlete';
const OUT = 'C:\\AI\\App deep\\squadra\\tools\\out\\prevenzione_ind.json';

function pulisci(s) {
  return String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/* parametri: "W1: 3x8, W2: 3x10 [RPE: 7, Tempo: 3-1-1-0]" → {weeks:{1:'3x8',2:'3x10'}, rpe:'7', tempo:'3-1-1-0'} */
function parseParametri(raw) {
  const s = pulisci(raw);
  const mAttr = s.match(/\[(.*)\]\s*$/);
  const attrStr = mAttr ? mAttr[1] : '';
  const body = mAttr ? s.slice(0, mAttr.index).trim() : s;
  const weeks = {};
  let extra = '';
  const mRange = body.match(/W(\d+)\s*-\s*W(\d+)\s*:\s*([^,]+)/);
  if (mRange) {
    for (let w = +mRange[1]; w <= +mRange[2]; w++) weeks[w] = mRange[3].trim();
  } else {
    const re = /W(\d+)\s*:\s*([^,]+)/g;
    let m;
    while ((m = re.exec(body))) weeks[+m[1]] = m[2].trim();
  }
  if (!Object.keys(weeks).length && body) extra = body;
  let rpe = '', tempo = '';
  if (attrStr) {
    const mR = attrStr.match(/RPE\s*:\s*([^,;]+)/);
    const mT = attrStr.match(/Tempo\s*:\s*([^,;]+)/);
    rpe = mR ? mR[1].trim() : '';
    tempo = mT ? mT[1].trim() : '';
  }
  return { weeks, extra, rpe, tempo };
}

/* riga tabella → 4 celle (le pipe in eccesso finiscono nella nota) */
function parseRiga(riga) {
  const celle = riga.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  if (celle.length < 4) return null;
  return {
    nome: pulisci(celle[0]),
    razionale: pulisci(celle[1]),
    parametri: pulisci(celle[2]),
    note: pulisci(celle.slice(3).join(' ')),
  };
}

const out = {};
const files = fs.readdirSync(DIR_ATLETE, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => path.join(DIR_ATLETE, d.name))
  .map(dir => fs.readdirSync(dir).filter(f => /^PROGRAMMA_RECUPERO_.*\.md$/i.test(f)).map(f => path.join(dir, f)))
  .flat();

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  const mNome = txt.match(/PROGRAMMA DI RECUPERO FUNZIONALE\s*[—–-]\s*(.+)/i);
  if (!mNome) { console.error('Nome non trovato in ' + file); continue; }
  const nome = mNome[1].trim();
  const righe = txt.split(/\r?\n/);
  const schede = {};
  let cur = null;
  for (const r of righe) {
    const mS = r.match(/^###\s*SCHEDA\s*(\d+)\s*:?\s*(.*)$/i);
    if (mS) {
      cur = { num: +mS[1], titolo: pulisci(mS[2]), obiettivo: '', durata: '', esercizi: [] };
      schede[cur.num] = cur;
      continue;
    }
    if (!cur) continue;
    const mO = r.match(/^\*\s*\*\*Obiettivo:\*\*\s*(.*)$/i);
    if (mO) { cur.obiettivo = pulisci(mO[1]); continue; }
    const mD = r.match(/^\*\s*\*\*Durata consigliata:\*\*\s*(.*)$/i);
    if (mD) { cur.durata = pulisci(mD[1]); continue; }
    const t = r.trim();
    if (t.startsWith('|') && !/^\|---/.test(t) && !/^\|\s*Esercizio e Distretto/i.test(t)) {
      const row = parseRiga(t);
      if (row && row.nome) {
        const p = parseParametri(row.parametri);
        cur.esercizi.push({ nome: row.nome, razionale: row.razionale, param: p, note: row.note });
      }
    }
  }
  const chiavi = Object.keys(schede);
  if (chiavi.length !== 3) {
    console.error(`${nome}: schede trovate ${chiavi.join(',')} (attese 1,2,3)`);
  }
  const ok = chiavi.every(k => schede[k].esercizi.length);
  out[nome] = { ok, schede };
  console.log(`${nome}: ${chiavi.map(k => `S${k}=${schede[k].esercizi.length}es`).join(' ')} ${ok ? '' : '⚠ VUOTA'}`);
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log('scritto ' + OUT);
