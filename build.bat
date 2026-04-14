@echo off
echo ==========================================
echo   IT MANAGER - Build de Producao
echo ==========================================
echo.

echo [1/3] Instalando dependencias do frontend...
cd /d "%~dp0frontend"
call npm install --silent
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias do frontend
    pause
    exit /b 1
)

echo [2/3] Gerando build do frontend...
call npm run build
if errorlevel 1 (
    echo ERRO: Falha no build do frontend
    pause
    exit /b 1
)

echo [3/3] Instalando dependencias do backend...
cd /d "%~dp0backend"
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias do backend
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Build concluido com sucesso!
echo   Execute start.bat para iniciar.
echo ==========================================
pause
