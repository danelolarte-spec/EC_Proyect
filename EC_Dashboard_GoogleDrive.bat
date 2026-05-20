@echo off
REM Lanzador para Windows - doble clic
title EC Transportes - Envio Dashboard

cd /d "%~dp0"

echo Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    echo Descargalo desde: https://www.python.org/downloads/
    echo Al instalar, marca la casilla "Add Python to PATH".
    pause
    exit /b 1
)

echo Verificando openpyxl...
python -c "import openpyxl" 2>nul
if errorlevel 1 (
    echo Instalando openpyxl...
    python -m pip install openpyxl
)

echo.
python "%~dp0EC_Dashboard_GoogleDrive.py" %*
