@echo off
REM Lanzador para Windows - doble clic
title EC Transportes - Envio Dashboard

cd /d "%~dp0"

REM ============================================================
REM  Buscar Python en multiples ubicaciones
REM ============================================================
set "PY_CMD="

REM 1) python en el PATH
python --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
    goto :found
)

REM 2) py launcher (viene con Python en Windows aunque no marques PATH)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=py -3"
    goto :found
)

py --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=py"
    goto :found
)

REM 3) Buscar instalaciones tipicas en disco
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
    "C:\Program Files\Python313\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python310\python.exe"
    "C:\Program Files (x86)\Python313\python.exe"
    "C:\Program Files (x86)\Python312\python.exe"
    "C:\Program Files (x86)\Python311\python.exe"
) do (
    if exist %%P (
        set "PY_CMD=%%P"
        goto :found
    )
)

echo ============================================================
echo  ERROR: No se encontro Python.
echo ============================================================
echo.
echo  Opciones para arreglarlo:
echo.
echo  A) Reinstalar Python marcando "Add Python to PATH":
echo     https://www.python.org/downloads/
echo.
echo  B) Si ya esta instalado en otra ruta, dime cual es y
echo     la agregamos al .bat.
echo.
pause
exit /b 1

:found
echo ============================================================
echo  Python encontrado: %PY_CMD%
echo ============================================================
%PY_CMD% --version
echo.

echo Verificando openpyxl...
%PY_CMD% -c "import openpyxl" 2>nul
if errorlevel 1 (
    echo Instalando openpyxl...
    %PY_CMD% -m pip install openpyxl
    if errorlevel 1 (
        echo.
        echo ERROR: no se pudo instalar openpyxl.
        echo Intenta manualmente:  %PY_CMD% -m pip install openpyxl
        pause
        exit /b 1
    )
)

echo.
%PY_CMD% "%~dp0EC_Dashboard_GoogleDrive.py" %*
