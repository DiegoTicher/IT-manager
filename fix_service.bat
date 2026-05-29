@echo off
echo Corrigindo caminho do Python no NSSM...
.\nssm.exe set ITManagerService Application "C:\Users\Diego.BRAPIRAREV\AppData\Local\Programs\Python\Python312\python.exe"

echo.
echo Habilitando logs para monitoramento de erros...
.\nssm.exe set ITManagerService AppStdout "C:\Aplicacoes\it-manager\service.log"
.\nssm.exe set ITManagerService AppStderr "C:\Aplicacoes\it-manager\service.log"

echo.
echo Tentando iniciar o servico novamente...
.\nssm.exe start ITManagerService

echo.
pause
