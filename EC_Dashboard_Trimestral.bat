@echo off
title EC Transportes - Envio Dashboard

REM ============================================================
REM  Esta linea evita que se cierre sin importar lo que pase
REM ============================================================
setlocal enabledelayedexpansion

echo ============================================================
echo  EC TRANSPORTES - Lanzador
echo ============================================================
echo.
echo Carpeta actual: %~dp0
echo.

cd /d "%~dp0"
if errorlevel 1 (
    echo ERROR: no se pudo cambiar a la carpeta del script.
    goto :end
)

REM ============================================================
REM  Buscar Python
REM ============================================================
set "PY_CMD="

echo [1/4] Buscando 'python' en PATH...
python --version 2>nul
if not errorlevel 1 (
    set "PY_CMD=python"
    goto :found
)

echo [2/4] Buscando 'py -3'...
py -3 --version 2>nul
if not errorlevel 1 (
    set "PY_CMD=py -3"
    goto :found
)

echo [3/4] Buscando 'py'...
py --version 2>nul
if not errorlevel 1 (
    set "PY_CMD=py"
    goto :found
)

echo [4/4] Buscando en rutas tipicas...
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
        set "PY_CMD=%%~P"
        echo   Encontrado: %%~P
        goto :found
    )
)

echo.
echo ============================================================
echo  ERROR: No se encontro Python en ninguna ubicacion.
echo ============================================================
echo.
echo  Cosas que puedes probar:
echo.
echo   1) Abre cmd y ejecuta:    py --version
echo      o tambien:             where python
echo      Si funciona alguno, pegame el resultado.
echo.
echo   2) Reinstala Python marcando "Add Python to PATH":
echo      https://www.python.org/downloads/
echo.
goto :end

:found
echo.
echo ============================================================
echo  Python encontrado: %PY_CMD%
echo ============================================================
%PY_CMD% --version
echo.

echo Verificando dependencia 'openpyxl'...
%PY_CMD% -c "import openpyxl" 2>nul
if errorlevel 1 (
    echo No esta instalada. Instalando ahora...
    %PY_CMD% -m pip install openpyxl
    if errorlevel 1 (
        echo.
        echo ERROR al instalar openpyxl.
        echo Prueba manualmente en cmd:
        echo   %PY_CMD% -m pip install openpyxl
        goto :end
    )
)

echo openpyxl OK.
echo.

REM ============================================================
REM  Ejecutar el script de Python
REM ============================================================
if not exist "%~dp0EC_Dashboard_Trimestral.py" (
    echo ERROR: no se encuentra EC_Dashboard_Trimestral.py
    echo Asegurate que este .bat y el .py esten en la MISMA carpeta.
    goto :end
)

echo Ejecutando script...
echo ============================================================
echo.
%PY_CMD% "%~dp0EC_Dashboard_Trimestral.py" %*

:end
echo.
echo ============================================================
echo  Fin del lanzador. Presiona una tecla para cerrar.
echo ============================================================
pause >nul
endlocal
