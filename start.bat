@echo off
echo ==========================================
echo   IT MANAGER v2.0 - Iniciando...
echo ==========================================
echo.

cd /d "%~dp0backend"

set MODE=production
set HOST=0.0.0.0
set PORT=5004

echo Servidor: http://localhost:%PORT%
echo Rede:     http://%COMPUTERNAME%:%PORT%
echo.
echo Pressione Ctrl+C para encerrar.
echo.

python app.py
