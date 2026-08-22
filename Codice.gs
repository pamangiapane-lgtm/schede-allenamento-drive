/* ============================================================
 * Schede Allenamento — Backend su Google Drive
 * ============================================================
 * Deploy: Apps Script → Distribuisci → App Web
 *   - Esegui come: Io (l'account proprietario della cartella Drive)
 *   - Chi può accedere: CHIUNQUE (anche anonimi)  ← obbligatorio
 * Il frontend chiama questa Web App via HTTPS (JSON).
 *
 * VINCOLO: questo script tocca SOLO la cartella FOLDER_ID.
 * Nessun altro file/cartella di Drive viene letto o modificato.
 *
 * Storage: file JSON dentro la cartella FOLDER_ID.
 *   Ogni "collezione" è un file <nome>.json con un array di oggetti.
 *   Le chiavi coincidono con gli header del vecchio foglio per
 *   compatibilità (ID, Nome, Ruolo, N_Seduta, Ord_Metodo, ...).
 * ============================================================ */

/* ---------- CONFIG (i valori reali vivono SOLO nel progetto deployato) ---------- */
const FOLDER_ID  = '1sD47TryHpz318COBJDSkfq5JRFE_5sqA'; // cartella Drive (unica area toccata)
const TOKEN      = 'SOSTITUISCI_TOKEN_ATLETE';          // token lettura/scrittura atlete
const COACH_KEY  = 'SOSTITUISCI_CHIAVE_COACH';          // chiave area coach

/* Mappa: nome logico (param "foglio" usato dal frontend) → file JSON su Drive */
const FOGLIO_FILE = {
  Giocatrici:         'giocatrici.json',
  Sedute:             'sedute.json',
  Esercizi:           'esercizi.json',
  LibreriaIndividuale:'libreria_individuale.json',
  Progressi:          'progressi.json',
  Info:               'info.json'
};

/* Collezioni che il coach può sovrascrivere (Progressi è solo append) */
const FOGLIO_SCRIVIBILI = ['Giocatrici', 'Sedute', 'Esercizi', 'LibreriaIndividuale', 'Info'];

/* Esegui questa funzione UNA volta dall'editor (▶ Esegui) per concedere
   il permesso a Google Sheets (auth/spreadsheets). Poi ridistribuisci la Web App. */
function autorizza() {
  try {
    SpreadsheetApp.openById('0'); // forza la richiesta del permesso spreadsheets
  } catch (e) {
    // l'errore qui è atteso (ID fittizio): il permesso viene chiesto prima dell'esecuzione
  }
  return 'Autorizzazione completata. Ora ridistribuisci la Web App.';
}

/* ============================================================
 * ENTRY POINT
 * ============================================================ */
function doGet(e) {
  if (e.parameter.token !== TOKEN) return errore('Token non valido');
  try {
    const az = e.parameter.azione;
    if (az === 'leggi') {
      const foglio = e.parameter.foglio;
      const file = FOGLIO_FILE[foglio];
      if (!file) return errore('Foglio non valido: ' + foglio);
      return ok(leggiFile(file));
    }
    if (az === 'lista_file') return listaFile();
    if (az === 'leggi_qualsiasi') return leggiQualsiasi(e.parameter.file);
    if (az === 'leggi_sheet') return leggiSheet(e.parameter.file);
    return errore('Azione GET non valida: ' + az);
  } catch (ex) {
    return errore(ex.toString());
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return errore('Token non valido');

    const az = body.azione;
    if (az === 'verifica_coach') {
      if (body.chiave !== COACH_KEY) return errore('Chiave coach non valida');
      return risposta({ ok: true });
    }
    if (az === 'log_progressi') return logProgressi(body);
    if (az === 'log_progressi_bulk') return logProgressiBulk(body);
    if (az === 'scrivi_foglio') {
      if (body.chiave !== COACH_KEY) return errore('Chiave coach non valida');
      return scriviFoglio(body);
    }
    if (az === 'inizializza_dati') {
      if (body.chiave !== COACH_KEY) return errore('Chiave coach non valida');
      return inizializzaDati();
    }
    if (az === 'importa_sheet') {
      if (body.chiave !== COACH_KEY) return errore('Chiave coach non valida');
      return importaSheet(body.file);
    }
    return errore('Azione POST non valida: ' + az);
  } catch (ex) {
    return errore(ex.toString());
  }
}

/* ============================================================
 * ACCESSO AI FILE JSON SU DRIVE (solo dentro FOLDER_ID)
 * ============================================================ */

/* Lettura pura (nessun lock necessario) */
function leggiFileRaw(nomeFile) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByName(nomeFile);
  if (!files.hasNext()) return [];
  return JSON.parse(files.next().getBlob().getDataAsString());
}

/* Scrittura pura (usare solo dentro una sezione con lock) */
function scriviFileRaw(nomeFile, dati) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByName(nomeFile);
  const file   = files.hasNext()
    ? files.next()
    : folder.createFile(nomeFile, '[]', MimeType.PLAIN_TEXT);
  file.setContent(JSON.stringify(dati, null, 2));
}

/* Lettura esposta (comoda per doGet) */
function leggiFile(nomeFile) {
  return leggiFileRaw(nomeFile);
}

/* Elenco dei file presenti nella cartella FOLDER_ID (solo lettura) */
function listaFile() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFiles();
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    out.push({ nome: f.getName(), dimensione: f.getSize(), data: f.getDateCreated().toISOString() });
  }
  out.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return risposta({ ok: true, dati: out });
}

/* Lettura di un file qualsiasi nella cartella (solo lettura, per ispezione).
   Se è JSON valido lo restituisce come "json", altrimenti come "anteprima" testuale. */
function leggiQualsiasi(nomeFile) {
  if (!nomeFile) return errore('Parametro file mancante');
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByName(nomeFile);
  if (!files.hasNext()) return errore('File non trovato: ' + nomeFile);
  const f = files.next();
  const testo = f.getBlob().getDataAsString();
  try {
    return risposta({ ok: true, nome: f.getName(), json: JSON.parse(testo) });
  } catch (e) {
    return risposta({ ok: true, nome: f.getName(), anteprima: testo.slice(0, 8000) });
  }
}

/* Ispezione di un Google Sheets nella cartella: per ogni foglio restituisce
   nome, numero righe, intestazioni e 2 righe di esempio (solo lettura). */
function leggiSheet(nomeFile) {
  if (!nomeFile) return errore('Parametro file mancante');
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByName(nomeFile);
  if (!files.hasNext()) return errore('File non trovato: ' + nomeFile);
  const ss = SpreadsheetApp.openById(files.next().getId());
  const out = {};
  ss.getSheets().forEach(function (sh) {
    const vals = sh.getDataRange().getValues();
    const headers = vals.length ? vals[0] : [];
    out[sh.getName()] = {
      righe: Math.max(0, vals.length - 1),
      headers: headers,
      esempio: vals.slice(1, 3)
    };
  });
  return risposta({ ok: true, nome: ss.getName(), fogli: out });
}

/* Converte un Google Sheets della cartella nei file JSON del database.
   Mappa i fogli per nome → file JSON. I fogli non mappati sono ignorati. */
function importaSheet(nomeFile) {
  if (!nomeFile) return errore('Parametro file mancante');
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByName(nomeFile);
  if (!files.hasNext()) return errore('File non trovato: ' + nomeFile);
  const ss = SpreadsheetApp.openById(files.next().getId());

  const MAP = {
    'Giocatrici':          'giocatrici.json',
    'Sedute':              'sedute.json',
    'Esercizi':            'esercizi.json',
    'LibreriaIndividuale': 'libreria_individuale.json',
    'Progressi':           'progressi.json'
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const esiti = [];
    ss.getSheets().forEach(function (sh) {
      const nome = sh.getName();
      const target = MAP[nome];
      if (!target) { esiti.push({ foglio: nome, esito: 'ignorato' }); return; }
      const vals = sh.getDataRange().getValues();
      const headers = vals.length ? vals[0] : [];
      const righe = vals.slice(1).map(function (r) {
        const o = {};
        headers.forEach(function (h, i) { o[h] = r[i]; });
        return o;
      });
      scriviFileRaw(target, righe);
      esiti.push({ foglio: nome, esito: 'importato', file: target, righe: righe.length });
    });
    return risposta({ ok: true, esiti: esiti });
  } finally {
    lock.releaseLock();
  }
}

/* Scrittura esposta con lock (per sostituzione intera di una collezione) */
function scriviFile(nomeFile, dati) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    scriviFileRaw(nomeFile, dati);
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 * AZIONI
 * ============================================================ */

/* Append di un log nel file progressi.json (append-only) */
function logProgressi(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const progressi = leggiFileRaw('progressi.json');
    progressi.push({
      Timestamp:    new Date().toISOString(),
      ID_Giocatrice: body.id_giocatrice,
      N_Seduta:      body.n_seduta,
      Esercizio:     body.esercizio,
      Data:          body.data,
      Valore:        body.valore,
      Note:          body.note || '',
      Kg_Usati:      body.kg_usati || '',
      Reps_Fatte:    body.reps_fatte || '',
      RM_Stimato:    body.rm_stimato || ''
    });
    scriviFileRaw('progressi.json', progressi);
    return risposta({ ok: true, logged: 1 });
  } finally {
    lock.releaseLock();
  }
}

/* Append in blocco (append-only, stesso formato di logProgressi).
   Utile per import storici e sincronizzazione coda offline. Max 200 righe per chiamata. */
function logProgressiBulk(body) {
  const righe = Array.isArray(body.righe) ? body.righe : [];
  if (!righe.length) return errore('Nessuna riga da salvare');
  if (righe.length > 200) return errore('Massimo 200 righe per chiamata');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const progressi = leggiFileRaw('progressi.json');
    righe.forEach(function (r) {
      progressi.push({
        Timestamp:     r.Timestamp || new Date().toISOString(),
        ID_Giocatrice: r.ID_Giocatrice,
        N_Seduta:      r.N_Seduta,
        Esercizio:     r.Esercizio,
        Data:          r.Data,
        Valore:        r.Valore,
        Note:          r.Note || '',
        Kg_Usati:      r.Kg_Usati || '',
        Reps_Fatte:    r.Reps_Fatte || '',
        RM_Stimato:    r.RM_Stimato || ''
      });
    });
    scriviFileRaw('progressi.json', progressi);
    return risposta({ ok: true, logged: righe.length, totale: progressi.length });
  } finally {
    lock.releaseLock();
  }
}

/* Sostituzione di una collezione (solo coach) */
function scriviFoglio(body) {
  const foglio = body.foglio;
  if (!FOGLIO_SCRIVIBILI.includes(foglio)) return errore('Foglio non consentito: ' + foglio);
  const file = FOGLIO_FILE[foglio];
  const dati = Array.isArray(body.dati) ? body.dati : [];
  scriviFile(file, dati);
  return risposta({ ok: true, scritte: dati.length });
}

/* ============================================================
 * SEED — crea i dati di esempio SOLO se i file non esistono.
 * Non sovrascrive MAI file esistenti. Opera SOLO in FOLDER_ID.
 * ============================================================ */
function inizializzaDati() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const esiti = [
      ['giocatrici.json',          seedSeManca('giocatrici.json', SEED_GIOCATRICI)],
      ['sedute.json',              seedSeManca('sedute.json', SEED_SEDUTE)],
      ['esercizi.json',            seedSeManca('esercizi.json', SEED_ESERCIZI)],
      ['libreria_individuale.json',seedSeManca('libreria_individuale.json', SEED_LIBRERIA)],
      ['progressi.json',           seedSeManca('progressi.json', [])],
      ['info.json',                seedSeManca('info.json', SEED_INFO)]
    ];
    const creati    = esiti.filter(e => e[1]).map(e => e[0]);
    const esistenti = esiti.filter(e => !e[1]).map(e => e[0]);
    return risposta({ ok: true, creati: creati, esistenti: esistenti });
  } finally {
    lock.releaseLock();
  }
}

function seedSeManca(nomeFile, dati) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByName(nomeFile);
  if (files.hasNext()) return false; // esiste già: NON toccare
  folder.createFile(nomeFile, JSON.stringify(dati, null, 2), MimeType.PLAIN_TEXT);
  return true;
}

const SEED_GIOCATRICI = [
  { ID: 1, Nome: 'Rossi Maria', Ruolo: 'Centrale', Attiva: 'SI', Lingua: 'IT', Fase_Prehab: 'F1', Colonne_Individuali: 'PREHAB-F1,PREHAB-F2', Obiettivi_Prehab: '{"F1":"Stabilità spalla","F2":"Forza caviglia"}', Link_Prehab: '', Analisi_Funzionale: '', Strategia: '' },
  { ID: 2, Nome: 'Bianchi Giulia', Ruolo: 'Palleggiatrice', Attiva: 'SI', Lingua: 'IT', Fase_Prehab: 'F1', Colonne_Individuali: 'PREHAB-F1', Obiettivi_Prehab: '{"F1":"Mobilità spalla"}', Link_Prehab: '', Analisi_Funzionale: '', Strategia: '' },
  { ID: 99, Nome: 'Demo', Ruolo: 'Coach', Attiva: 'SI', Lingua: 'IT' }
];

const SEED_SEDUTE = [
  { Numero_Seduta: 'W1-MarP', Nome_Seduta: 'Palestra P', ID_Giocatrice: 0, Settimana: 'W1', Giorno: 'Martedì', Luogo: 'Palestra', Durata_min: 90, Note: '' }
];

const SEED_ESERCIZI = [
  { N_Seduta: 'W1-MarP', ID_Giocatrice: 0, Escludi_ID: '', Ord_Metodo: 1, Ord_Eserc: 1, Esercizio: 'Squat', Esercizio_EN: 'Squat', Metodo: 'Forza massima', Desc_Metodo: '', Serie: '4', Reps: '2', 'Intensità': '78%', Recupero: '90s', RPE: '7', Log_Libero: 'SI', Tipo_Esercizio: 'Bipodalico', Catena: 'lower', Codice: 'SQ-MAX', Ruoli: 'tutti', Istruzione: '{"h":"Scendi sotto il parallelo","f":"Spinta dal tallone","a":"Perdere tensione"}', Note: '', VideoURL: '', Num_Ripetizioni: 2, SerieB: '', RepsB: '', 'IntensitàB': '', RecuperoB: '' },
  { N_Seduta: 'W1-MarP', ID_Giocatrice: 0, Escludi_ID: '', Ord_Metodo: 2, Ord_Eserc: 1, Esercizio: 'Panca piana', Esercizio_EN: 'Bench press', Metodo: 'Forza massima', Desc_Metodo: '', Serie: '3', Reps: '5', 'Intensità': '80%', Recupero: '120s', RPE: '7', Log_Libero: 'SI', Tipo_Esercizio: 'Spinta', Catena: 'upper', Codice: 'BP', Ruoli: 'tutti', Istruzione: '', Note: '', VideoURL: '', Num_Ripetizioni: '', SerieB: '', RepsB: '', 'IntensitàB': '', RecuperoB: '' }
];

const SEED_LIBRERIA = [
  { Codice: 'PREHAB-F1', Titolo_Colonna: 'Fase 1 — Stabilità', Ordine: 1, Esercizio: 'Rotazione esterna', Esercizio_EN: 'External rotation', Serie: '3', Reps: '12', Intensita: '', Recupero: '45s', Log_Libero: 'NO', Catena: 'upper', Note: '', Istruzione: '', VideoURL: '' },
  { Codice: 'PREHAB-F1', Titolo_Colonna: 'Fase 1 — Stabilità', Ordine: 2, Esercizio: 'Plank laterale', Esercizio_EN: 'Side plank', Serie: '3', Reps: '30s', Intensita: '', Recupero: '30s', Log_Libero: 'NO', Catena: 'core', Note: '', Istruzione: '', VideoURL: '' }
];

const SEED_INFO = [
  { chiave: 'stagione', valore: 'Pre-Season 2026' },
  { chiave: 'settimana_corrente', valore: 'W1' }
];

/* ============================================================
 * HELPER RISPOSTE JSON (CORS)
 * ============================================================ */
function ok(dati) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, dati: dati }))
    .setMimeType(ContentService.MimeType.JSON);
}
function risposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function errore(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, errore: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
