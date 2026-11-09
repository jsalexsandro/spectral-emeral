@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Spectral - iniciando os tres servicos
echo ==========================================
echo.

if not exist "node_modules" (
  echo [erro] Dependencias da raiz ausentes.
  echo Rode: npm install
  echo.
  pause
  exit /b 1
)

if not exist "spectral\backend\node_modules" (
  echo [erro] Dependencias do backend ausentes.
  echo Rode: npm run install:services
  echo.
  pause
  exit /b 1
)

if not exist "spectral\driver\node_modules" (
  echo [erro] Dependencias do driver ausentes.
  echo Rode: npm run install:services
  echo.
  pause
  exit /b 1
)

start "Spectral - Backend" cmd /k "npm run dev:backend"
timeout /t 2 /nobreak >nul

start "Spectral - Web" cmd /k "npm run dev"
start "Spectral - Driver" cmd /k "npm run dev:driver"

echo.
echo Servicos iniciados em janelas separadas:
echo   - Backend  (porta 4001)
echo   - Web/Next (porta 3000)
echo   - Driver
echo.
echo Feche cada janela para encerrar o servico correspondente.
echo.
pause
endlocal
