/* check_syntax.js — compila tutti i blocchi <script> inline delle pagine */
const fs = require('fs');
const files = ['scheda.html', 'seduta-coach.html', 'index.html', 'coach.html', 'report.html', 'dashboard.html'];
let totali = 0, errori = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(html))) {
    i++; totali++;
    try { new Function(m[1]); console.log(`${f} blocco ${i}: OK`); }
    catch (e) { errori++; console.log(`${f} blocco ${i}: ERRORE — ${e.message}`); }
  }
}
console.log(`TOT blocchi: ${totali}, errori: ${errori}`);
