# Planner App

Una semplice applicazione di gestione task (To-Do List) multi-utente, sviluppata con Python (Flask).

## Funzionalità

- Registrazione e Login utenti.
- Creazione, modifica e cancellazione task.
- Assegnazione task ad altri utenti.
- Commenti sulle task.
- Gestione permessi:
  - Solo chi ha creato la task può modificarne i dettagli (titolo, descrizione, ecc.) o cancellarla.
  - L'assegnatario può solo cambiare lo stato (es. da "To Do" a "Completed").
- Supporto Database: SQLite (Locale) e PostgreSQL (Produzione/Supabase).

## Setup Locale

1.  **Clona il repository o scarica i file.**
2.  **Crea un ambiente virtuale (opzionale ma consigliato):**
    ```bash
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # Mac/Linux
    source venv/bin/activate
    ```
3.  **Installa le dipendenze:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Avvia l'applicazione:**
    ```bash
    python app.py
    ```
    L'app sarà disponibile su `http://127.0.0.1:5011`.
    In locale, verrà creato automaticamente un file `planner.db` (SQLite).

---

## Guida alla Pubblicazione (Vercel + Supabase)

Segui questi passaggi per mettere online la tua app gratuitamente.

### 1. Preparazione Database (Supabase)

1.  Vai su [supabase.com](https://supabase.com/) e crea un account.
2.  Clicca su **"New Project"**.
3.  Dai un nome al progetto e imposta una password sicura per il database.
4.  Attendi che il database sia pronto (qualche minuto).
5.  **Crea le tabelle:**
    *   Vai alla sezione **"SQL Editor"** (icona terminale nella barra laterale).
    *   Clicca su **"New query"**.
    *   Copia e incolla il contenuto del file `schema.sql` presente in questo repository.
    *   Clicca su **"Run"**.
6.  **Ottieni la stringa di connessione:**
    *   Vai su **Project Settings** (icona ingranaggio) -> **Database**.
    *   Scorri fino a **Connection String**.
    *   Seleziona la scheda **"URI"**.
    *   Copia la stringa. Sarà simile a:
        `postgresql://postgres:[TUAPASSWORD]@db.projectref.supabase.co:5432/postgres`
    *   *Nota: Sostituisci `[TUAPASSWORD]` con la password che hai scelto al punto 3.*

### 2. Caricamento su GitHub

1.  Vai su [github.com](https://github.com/) e crea un nuovo repository (es. `planner-app`).
2.  Carica i file del progetto su GitHub. Se usi Git da terminale:
    ```bash
    git init
    git add .
    git commit -m "Primo commit"
    git branch -M main
    git remote add origin https://github.com/TUO_USERNAME/planner-app.git
    git push -u origin main
    ```

### 3. Deploy su Vercel

1.  Vai su [vercel.com](https://vercel.com/) e accedi con il tuo account GitHub.
2.  Clicca su **"Add New..."** -> **"Project"**.
3.  Importa il repository `planner-app` che hai appena creato.
4.  **Configurazione Environment Variables:**
    *   Nella schermata di configurazione ("Configure Project"), trova la sezione **"Environment Variables"**.
    *   Aggiungi le seguenti variabili:
        *   **Nome:** `DATABASE_URL`
        *   **Valore:** La stringa di connessione copiata da Supabase (punto 1.6).
        *   **Nome:** `PLANNER_SECRET`
        *   **Valore:** Una stringa casuale a tua scelta (serve per la sicurezza delle sessioni).
5.  Clicca su **"Deploy"**.

Attend qualche secondo e la tua app sarà online! Vercel ti fornirà un link (es. `planner-app.vercel.app`) per accedere.
