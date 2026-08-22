# Schede Allenamento — PWA con Google Drive come database

Clone funzionale della PWA "Schede Allenamento" (Marsala Volley). Frontend vanilla
(HTML/CSS/JS, zero dipendenze) + backend Google Apps Script, con **Google Drive** come
archivio dati (file JSON nella cartella indicata).

## Struttura

```
app/
├── index.html          # lista atlete
├── scheda.html         # scheda personale atleta (sedute, log, 1RM, prehab, profilo)
├── coach.html          # area coach (protetta da chiave) + seed dati di esempio
├── dashboard.html      # dashboard coach: stato atlete, ultimi log, RPE (chiave coach)
├── seduta-coach.html   # vista seduta live: piano, timer recupero, log rapido (chiave coach)
├── report.html         # report progressi per atleta
├── dati.js             # modulo condiviso: API + cache offline + coda log
├── style.css           # design system
├── sw.js               # service worker (percorsi RELATIVI)
├── manifest.json       # manifest PWA
├── icon.svg            # logo/icona segnaposto (sostituire con il proprio)
├── Codice.gs           # backend Apps Script (con placeholder — sicuro da committare)
├── Codice.PROD.gs      # ⚠️ SOLO per il deploy: contiene i valori reali. NON committare.
├── dati/               # file JSON di esempio (alternativa al seed automatico)
├── tools/              # importa-progressi.ps1 (import storico progressi, append-only)
└── .github/workflows/pages.yml   # deploy automatico su GitHub Pages
```

## Modalità offline (palestra)

- Ogni collezione letta con successo finisce nella cache locale (`localStorage`).
  Senza rete, atlete e coach vedono gli **ultimi dati caricati** + banner "Offline".
- I log salvati senza rete vanno in **coda locale** e vengono **sincronizzati
  automaticamente** appena torna la connessione (evento `online`). Nessun log perso.
- Consiglio: aprire l'app una volta con rete attiva (anche solo la lista atlete) prima
  di andare in palestra, così la cache è piena.

## Setup in 3 passi

### 1. Backend (Google Apps Script)
1. Apri il progetto Apps Script già creato (oppure <https://script.google.com> → Nuovo progetto).
2. Seleziona tutto il codice esistente → incolla il contenuto di **`Codice.PROD.gs`**.
3. **Aggiorna la distribuzione esistente** (per mantenere lo stesso URL):
   Distribuisci → **Gestisci distribuzioni** → ⋮ → **Modifica** → Versione: "Nuova versione" → Distribuisci.
4. Verifica i parametri della distribuzione: *Esegui come: Io* · *Accesso: **Chiunque** (anche anonimi)*.
   > ⚠️ Se le chiamate rispondono **403**, l'accesso non è "Chiunque": correggilo e ridistribuisci.

### 2. Dati su Google Drive (Opzione B — seed automatico, consigliata)
1. Apri `coach.html` → entra con la chiave coach (comunicata fuori dal repo).
2. Premi **"Crea dati di esempio"** nella sezione Dati.
   → Il backend crea i file JSON mancanti nella cartella Drive. **I file esistenti non vengono mai sovrascritti.**
3. (Alternativa manuale) Trascina i file JSON della cartella `dati/` dentro la cartella Drive.

### 3. Frontend (GitHub Pages)
1. Il codice è **già cablato** con l'URL della Web App e il token atlete (pubblici per design: l'accesso in scrittura sensibile è protetto dalla chiave coach, che vive solo nel backend).
2. Crea un **nuovo repository** con questi file → Settings → Pages → Source: **GitHub Actions**.
3. Ogni push su `main` pubblica automaticamente il sito (workflow incluso).

## Note tecniche

- **Vincolo di sicurezza**: il backend tocca **esclusivamente** la cartella Drive configurata
  (`FOLDER_ID`). Nessun altro file/cartella viene letto o modificato.
- **Chiavi JSON**: coincidono con gli header del vecchio foglio (es. `ID`, `Nome`,
  `N_Seduta`, `Ord_Metodo`, `Intensità`, `ID_Giocatrice`, `Valore`, `RM_Stimato`). Non rinominarle.
- **Progressi** (`progressi.json`) è **append-only**: il backend aggiunge righe, mai
  sovrascrive. Le scritture sono protette da `LockService`.
- **Service Worker**: percorsi relativi (`./index.html`, …) — corretti per hosting in sottocartella.
- **Ambiente dev/prod**: se l'URL contiene `/dev/` compare il banner "AMBIENTE DI TEST"
  (attualmente dev punta allo stesso backend della produzione).
- **Segreti**: `Codice.PROD.gs` è in `.gitignore`. Nel repository resta solo `Codice.gs`
  con i placeholder.

## Test rapido
1. Apri `index.html` → deve comparire la lista atlete.
2. Tocca un nome → `scheda.html?id=1` → la scheda con gli esercizi.
3. Inserisci i kg → l'1RM si calcola live → "Fine seduta — Salva tutto".
4. `coach.html` → entra con la chiave → gestisci dati e consulta i progressi.
5. `report.html` → seleziona un'atleta → report dei log.
