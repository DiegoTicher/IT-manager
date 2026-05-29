@echo off
echo ==========================================
echo   IT MANAGER - Modo Desenvolvimento
echo ==========================================
echo.
echo Subindo Backend (Flask) e Frontend (Vite)...
echo.

cd /d "%~dp0backend"
start "IT Manager - Backend" cmd /k "set PORT=5004 && python app.py"

cd /d "%~dp0frontend"
start "IT Manager - Frontend" cmd /k "npm run dev"

echo Backend:  http://localhost:5004
echo Frontend: http://localhost:5173
echo.
echo Duas janelas foram abertas.
pause
