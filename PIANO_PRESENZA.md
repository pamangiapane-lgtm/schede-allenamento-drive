# PIANO_PRESENZA — App per la fase in presenza (6 settimane)

> Prompt di lavoro creato il 2026-08-22. Stato: **ESEGUITO** (vedi sezione "Eseguito").

## Obiettivo

Trasformare l'app "Schede Allenamento" (clone su Drive) da strumento a distanza a
strumento da palestra:

1. **App atlete in palestra** — deve funzionare anche con rete assente/scarsa:
   dati in cache sul telefono, log salvati in coda locale e sincronizzati appena
   torna la rete.
2. **Supporto coach durante le sedute** — vista "seduta live": piano della seduta,
   timer di recupero, log rapido per atleta, stato della squadra in tempo reale.
3. **Dashboard coach** — panoramica squadra: log, RPE/fatica medie, attività atlete.
4. **Storico completo** — importare i 649 progressi pre-season (backup locale) nel Drive.

## Architettura (decisioni)

| Tema | Decisione |
|---|---|
| Offline dati | `localStorage` per origine (GitHub Pages): ogni collezione letta con successo viene salvata in `dati-v1-<foglio>` + timestamp. In assenza di rete si usa la cache. |
| Offline log | Coda `coda-log-v1` in `localStorage`: se il POST `log_progressi` fallisce per rete, la riga va in coda. Evento `online` → svuotamento automatico. |
| Modulo condiviso | Nuovo file `dati.js` usato da tutte le pagine (API, token, `getDati`, `inviaLog`, coda, banner offline). |
| Vista live coach | `seduta-coach.html`: seduta selezionabile, esercizi raggruppati per metodo, timer recupero (30s–3min), log rapido kg×reps per atleta, tabella "oggi". Protetta da chiave coach. |
| Dashboard | `dashboard.html`: card riepilogo + stato per atleta + ultimi log. Protetta da chiave coach. |
| Import 649 progressi | Script `tools/importa-progressi.js` (Node): righe dal backup locale → POST `log_progressi` una a una (append-only, nessun redeploy backend necessario). Endpoint bulk `log_progressi_bulk` aggiunto al codice backend per il futuro. |
| Backend | Aggiunta azione `log_progressi_bulk` (append array, LockService). Nessun altro cambiamento. Per attivarla serve il redeploy Apps Script (facoltativo, non blocca l'import). |
| PWA | `sw.js` v2: aggiunte le nuove pagine + `dati.js` alla precache. |

## File toccati

- **Nuovi**: `dati.js`, `dashboard.html`, `seduta-coach.html`, `PIANO_PRESENZA.md`, `tools/importa-progressi.js`
- **Modificati**: `index.html`, `scheda.html`, `coach.html` (solo link), `style.css`, `sw.js`, `Codice.gs`, `Codice.PROD.gs`

## Vincoli rispettati

- Scrittura solo dentro `C:\AI\App deep` e cartella Drive autorizzata.
- `Progressi` resta **append-only**: l'import non sovrascrive nulla, le 2 righe TEST presenti restano in fondo.
- Le chiavi coincidono con il backend originale (`ID`, `Nome`, `N_Seduta`, `Ord_Metodo`, `Intensità`, `ID_Giocatrice`, `Valore`, `RM_Stimato`, …). Il campo storico `Note_Atleta` viene normalizzato in `Note` all'import.
- Chiave coach vive solo nel backend (`Codice.PROD.gs`, non committato).

## Eseguito

1. ✅ `dati.js` — modulo offline + coda log + banner
2. ✅ `index.html` / `scheda.html` — cache dati, coda log, banner offline, messaggi "In coda"
3. ✅ `dashboard.html` — card, stato atlete, ultimi log (chiave coach)
4. ✅ `seduta-coach.html` — piano seduta, timer, log rapido, stato "oggi" (chiave coach)
5. ✅ `style.css` + `sw.js` aggiornati
6. ✅ Backend: azione `log_progressi_bulk` in `Codice.gs` e `Codice.PROD.gs`
7. ✅ Import 649 progressi storici (append, senza toccare le righe TEST)
8. ✅ Push su GitHub → deploy automatico GitHub Pages

## Da fare (passi manuali per Paolo, se vuole)

- **Facoltativo**: redeploy Apps Script con il nuovo `Codice.PROD.gs` per attivare
  `log_progressi_bulk` (utile solo per import futuri; l'app funziona senza).
- **Consigliato**: alle atlete, aprire l'app una volta con rete attiva (installazione
  PWA + riempimento cache), così in palestra funziona anche offline.

## Test rapido (checklist)

- [ ] `index.html` → lista atlete; con rete spenta → lista dalla cache + banner "Offline"
- [ ] `scheda.html?id=1` → sedute visibili offline; compilare kg con rete spenta → "In coda"; riattivare rete → sincronizzazione automatica
- [ ] `dashboard.html` → login coach → card e tabelle popolate (inclusi i 649 storici)
- [ ] `seduta-coach.html` → scelta seduta → piano; timer con bip; log rapido per atleta; tabella "oggi"
