@echo off
setlocal
REM Avvio Planner Flask su porta 5011 e apro browser
cd /d "%~dp0"

REM Crea venv se non esiste
if not exist ".\.venv\Scripts\python.exe" (
    echo Creazione ambiente virtuale...
    py -m venv .venv
)

REM Installa dipendenze se Flask non e' presente
".\.venv\Scripts\python.exe" -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Installazione dipendenze...
    ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
)

REM Avvia server in una nuova finestra
echo Avvio server su http://127.0.0.1:5011 ...
start "Planner Server" ".\.venv\Scripts\python.exe" app.py

REM Attendi qualche secondo e apri il browser
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5011/"

endlocal