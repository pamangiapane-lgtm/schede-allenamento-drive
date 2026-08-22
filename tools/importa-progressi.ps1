# ============================================================
# importa-progressi.ps1 - import storico dei progressi nel Drive
# Uso:
#   & tools\importa-progressi.ps1 -File "C:\AI\pre season 26\backup_locale\progressi-current.json" [-Skip 0] [-Limit 100] [-DryRun]
# Le righe vengono inviate UNA A UNA via azione=log_progressi (append-only).
# Nessun dato esistente sul Drive viene sovrascritto.
# ============================================================
param(
  [string]$File,
  [int]$Skip = 0,
  [int]$Limit = 99999,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$API   = 'https://script.google.com/macros/s/AKfycbxvILKHvT01CCNRqaLzea-V2pm5lC3yNKJxUjFG9I28PYB52mAejeWgZZufXJYBi5OflA/exec'
$TOKEN = 'tk-e9fe32f6fc35456a'

if (-not $File) { Write-Output 'ERRORE: specificare -File <percorso json>'; exit 2 }

$raw   = Get-Content $File -Raw -Encoding UTF8 | ConvertFrom-Json
$tutte = if ($raw -is [System.Array]) { $raw } else { $raw.dati }
$righe = @($tutte) | Select-Object -Skip $Skip -First $Limit

Write-Output "File: $File"
Write-Output "Totale righe nel file: $(@($tutte).Count)"
$dr = ''
if ($DryRun) { $dr = ' - DRY RUN' }
Write-Output "Da importare: $(@($righe).Count) (skip=$Skip, limit=$Limit)$dr"

function Normalizza($r) {
  $note = $r.Note
  if (-not $note) { $note = $r.Note_Atleta }
  if (-not $note) { $note = '' }
  $ts = $r.Timestamp
  if (-not $ts) { $ts = (Get-Date).ToString('o') }
  [pscustomobject]@{
    Timestamp     = $ts
    ID_Giocatrice = $r.ID_Giocatrice
    N_Seduta      = $r.N_Seduta
    Esercizio     = $r.Esercizio
    Data          = $r.Data
    Valore        = $r.Valore
    Note          = [string]$note
    Kg_Usati      = [string]$r.Kg_Usati
    Reps_Fatte    = [string]$r.Reps_Fatte
    RM_Stimato    = [string]$r.RM_Stimato
  }
}

function Invia($riga) {
  $body = @{
    token = $TOKEN; azione = 'log_progressi'
    id_giocatrice = $riga.ID_Giocatrice; n_seduta = $riga.N_Seduta; esercizio = $riga.Esercizio
    data = $riga.Data; valore = $riga.Valore; note = $riga.Note
    kg_usati = $riga.Kg_Usati; reps_fatte = $riga.Reps_Fatte; rm_stimato = $riga.RM_Stimato
  }
  $json = $body | ConvertTo-Json -Compress -Depth 5
  $r = Invoke-RestMethod -Uri $API -Method Post -ContentType 'text/plain;charset=utf-8' -Body $json -TimeoutSec 60
  if (-not $r.ok) { throw ($r.errore) }
  return $r
}

if ($DryRun) {
  Write-Output 'DRY RUN - prime 3 righe normalizzate:'
  $righe | Select-Object -First 3 | ForEach-Object { (Normalizza $_) | ConvertTo-Json -Compress }
  exit 0
}

$ok = 0; $ko = 0
$t0 = Get-Date
$i = 0
$tot = @($righe).Count
foreach ($r in $righe) {
  $riga = Normalizza $r
  $fatto = $false
  for ($tent = 0; $tent -lt 3 -and -not $fatto; $tent++) {
    try {
      Invia $riga | Out-Null
      $ok++; $fatto = $true
    } catch {
      if ($tent -eq 2) { $ko++; Write-Output "KO riga $($Skip + $i): $($_.Exception.Message)" }
      else { Start-Sleep -Milliseconds (1500 * ($tent + 1)) }
    }
  }
  $i++
  if (($i % 25) -eq 0 -or $i -eq $tot) {
    $sec = [int]((Get-Date) - $t0).TotalSeconds
    Write-Output "$i/$tot - ok=$ok ko=$ko - ${sec}s"
  }
}
Write-Output "FINE - importate: $ok, fallite: $ko"
if ($ko -gt 0) { exit 1 }
