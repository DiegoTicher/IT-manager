@echo off
echo ==========================================
echo   Instalador de Servico NSSM - IT Manager
echo ==========================================
echo.
echo Este script configurara o IT Manager como um servico do Windows.
echo Certifique-se de ter o NSSM instalado e no PATH do sistema.
echo.

set SERVICE_NAME=ITManagerService
set BACKEND_DIR=%~dp0backend
set PYTHON_EXE=python

echo Instalando servico: %SERVICE_NAME%
nssm install %SERVICE_NAME% "%PYTHON_EXE%" "%BACKEND_DIR%\app.py"

echo.
echo Configurando diretorio de trabalho...
nssm set %SERVICE_NAME% AppDirectory "%BACKEND_DIR%"

echo.
echo Configurando variaveis de ambiente...
nssm set %SERVICE_NAME% AppEnvironmentExtra MODE=production HOST=0.0.0.0 PORT=5004

echo.
echo Configurando inicio automatico com o Windows...
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START

echo.
echo Configurando descricao...
nssm set %SERVICE_NAME% Description "Servico backend e frontend do sistema IT Manager"

echo.
echo Servico instalado com sucesso!
echo.
echo Para iniciar o servico, execute: nssm start %SERVICE_NAME%
echo Ou acesse "Servicos" no Windows e inicie por la.
echo.
pause
