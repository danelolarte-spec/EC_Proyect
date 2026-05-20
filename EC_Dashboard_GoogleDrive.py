#!/usr/bin/env python3
"""
EC_Dashboard_GoogleDrive.py

Envia el .xlsx generado por el dashboard EC Transportes por correo
usando SMTP de Gmail con contrasena de aplicacion.

Uso:
    python EC_Dashboard_GoogleDrive.py archivo.xlsx

Requisitos:
    pip install openpyxl

Configuracion previa (una sola vez):
    1. En tu cuenta Google: activa la verificacion en 2 pasos
       (myaccount.google.com -> Seguridad).
    2. Genera una "Contrasena de aplicacion" en
       myaccount.google.com/apppasswords (elige "Correo" / "Otro").
       Obtienes 16 caracteres tipo: abcd efgh ijkl mnop
    3. Edita GMAIL_USER y GMAIL_APP_PASSWORD abajo, o exportalos
       como variables de entorno antes de ejecutar:
           export GMAIL_USER="tu_correo@gmail.com"
           export GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
"""
import sys
import os
import json
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from datetime import datetime, date, time

try:
    from openpyxl import load_workbook
except ImportError:
    print("Falta openpyxl. Instala con:  pip install openpyxl")
    try:
        input("\nPresiona Enter para cerrar...")
    except EOFError:
        pass
    sys.exit(1)

# =============================================================
# CONFIGURACION
#
# YA NO necesitas editar este archivo. Las credenciales y los
# destinatarios se leen de "config.txt" (junto a este script).
# Si config.txt no existe, el script lo crea con una plantilla
# la primera vez que se ejecuta.
# =============================================================

EMPRESA = "EC Transportes"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465

# Plantilla del dashboard HTML interactivo (debe estar en la misma carpeta)
TEMPLATE_FILE = "EC_Transportes_Dashboard.html"

CONFIG_FILE = "config.txt"
CONFIG_TEMPLATE = """# Configuracion para EC_Dashboard_GoogleDrive.py
# Edita las lineas de abajo con tus datos. NO uses comillas.
# Lineas que empiezan con # son comentarios y se ignoran.

# Tu correo de Gmail
GMAIL_USER=tu_correo@gmail.com

# Contrasena de aplicacion (16 caracteres, con o sin espacios)
# Generala en: https://myaccount.google.com/apppasswords
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx

# Destinatarios (separados por coma)
DESTINATARIOS=gerenciademarca@ectransportes.com

# Con copia (opcional, separados por coma. Dejar vacio si no se usa)
CC=
"""


def load_config():
    """Lee config.txt o lo crea con plantilla si no existe."""
    script_dir = Path(__file__).resolve().parent
    cfg_path = script_dir / CONFIG_FILE

    if not cfg_path.exists():
        cfg_path.write_text(CONFIG_TEMPLATE, encoding="utf-8")
        print(f"Se creo {cfg_path}")
        print("Editalo con tus datos (Bloc de notas) y vuelve a ejecutar.")
        try:
            input("\nPresiona Enter para cerrar...")
        except EOFError:
            pass
        sys.exit(0)

    cfg = {}
    for line in cfg_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        cfg[key.strip()] = value.strip()

    user = cfg.get("GMAIL_USER", "").strip()
    password = cfg.get("GMAIL_APP_PASSWORD", "").strip()
    destinatarios = [x.strip() for x in cfg.get("DESTINATARIOS", "").split(",") if x.strip()]
    cc = [x.strip() for x in cfg.get("CC", "").split(",") if x.strip()]

    return user, password, destinatarios, cc


GMAIL_USER, GMAIL_APP_PASSWORD, DESTINATARIOS, CC = load_config()
# =============================================================


MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


def fmt_cop(v):
    return "$" + f"{int(round(v)):,}".replace(",", ".")


def fmt_pct(v):
    return f"{v * 100:.1f}%"


def numv(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def to_jsonable(value):
    """Convierte tipos no serializables (datetime/date/time) a string."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return value


def load_rows(xlsx_path):
    """Lee el .xlsx y devuelve (headers, rows_dict_originales, rows_dict_serializables)."""
    wb = load_workbook(xlsx_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return [], [], []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    data_raw = [dict(zip(headers, r)) for r in rows[1:]]
    data_json = [{h: to_jsonable(v) for h, v in zip(headers, r)} for r in rows[1:]]
    return headers, data_raw, data_json


def build_interactive_html(rows_json, kpis):
    """Inserta los datos dentro del template HTML para que abra ya con todo cargado."""
    script_dir = Path(__file__).resolve().parent
    template_path = script_dir / TEMPLATE_FILE
    if not template_path.exists():
        return None
    template = template_path.read_text(encoding="utf-8")

    embedded = json.dumps(rows_json, ensure_ascii=False)

    injection = (
        "<script>\n"
        "(function(){\n"
        "  const __EMBEDDED__ = " + embedded + ";\n"
        "  function autoload(){\n"
        "    if (typeof compute !== 'function' || typeof renderDashboard !== 'function') {\n"
        "      setTimeout(autoload, 50); return;\n"
        "    }\n"
        "    try {\n"
        "      G = compute(__EMBEDDED__);\n"
        "      renderDashboard();\n"
        "      showScreen('dashboard');\n"
        "    } catch(e) { console.error('Auto-load error:', e); }\n"
        "  }\n"
        "  if (document.readyState === 'complete') autoload();\n"
        "  else window.addEventListener('load', autoload);\n"
        "})();\n"
        "</script>\n"
    )

    if "</body>" in template:
        return template.replace("</body>", injection + "</body>")
    return template + injection


def parse_fecha(d):
    """Acepta datetime, date, o string 'YYYY-MM-DD'."""
    if d is None:
        return None
    if isinstance(d, datetime):
        return d
    if isinstance(d, date):
        return datetime(d.year, d.month, d.day)
    if isinstance(d, str):
        s = d.strip()
        if not s:
            return None
        # YYYY-MM-DD opcional con hora
        try:
            return datetime.fromisoformat(s.replace(' ', 'T'))
        except ValueError:
            pass
        # solo fecha
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d")
        except ValueError:
            pass
        # DD/MM/YYYY
        for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(s[:10], fmt)
            except ValueError:
                continue
    return None


def compute_kpis_from_data(data):
    if not data:
        return None

    # Periodo (mes / anio) a partir de la primera fecha valida
    mes = "-"
    for r in data:
        d = parse_fecha(r.get('FECHA DEL SERVICIO'))
        if d is not None:
            mes = f"{MONTHS_ES[d.month - 1]} {d.year}"
            break

    active = [r for r in data if r.get('ESTADO') in ('DIALIQUIDADO', 'LIQUIDADO')]
    cancelled = [r for r in data if r.get('ESTADO') == 'CANCELADO']

    total_active = len(active)
    total_cancelled = len(cancelled)
    total_svc = len(data)
    pct_cancel = (total_cancelled / total_svc) if total_svc else 0.0
    total_factura = sum(numv(r.get('VALOR')) for r in active)
    ticket = (total_factura / total_active) if total_active else 0.0

    clientes = set()
    conductores = set()
    cliente_fact = {}
    conductor_fact = {}
    for r in active:
        c = r.get('CLIENTE')
        if c:
            clientes.add(c)
            cliente_fact[c] = cliente_fact.get(c, 0.0) + numv(r.get('VALOR'))
        d = r.get('CONDUCTOR')
        if d:
            conductores.add(d)
            conductor_fact[d] = conductor_fact.get(d, 0.0) + numv(r.get('VALOR'))

    top_cli = sorted(cliente_fact.items(), key=lambda x: -x[1])[:5]
    top_cond = sorted(conductor_fact.items(), key=lambda x: -x[1])[:5]

    return {
        'mes': mes,
        'total_active': total_active,
        'total_cancelled': total_cancelled,
        'pct_cancel': pct_cancel,
        'total_factura': total_factura,
        'ticket': ticket,
        'clientes_n': len(clientes),
        'conductores_n': len(conductores),
        'top_cli': top_cli,
        'top_cond': top_cond,
    }


def build_html(k):
    rows_cli = "".join(
        f"<tr><td style='padding:6px;border-bottom:1px solid #eee'>{i+1}. {n}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;text-align:right;color:#1A7A4A'>{fmt_cop(v)}</td></tr>"
        for i, (n, v) in enumerate(k['top_cli'])
    )
    rows_cond = "".join(
        f"<tr><td style='padding:6px;border-bottom:1px solid #eee'>{i+1}. {n}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;text-align:right;color:#1A7A4A'>{fmt_cop(v)}</td></tr>"
        for i, (n, v) in enumerate(k['top_cond'])
    )
    return f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#1B2A4A;max-width:680px;margin:0 auto;padding:24px;background:#fff">
  <div style="border-bottom:3px solid #C9A84C;padding-bottom:14px;margin-bottom:22px">
    <h2 style="color:#C9A84C;margin:0;letter-spacing:2px">EC TRANSPORTES</h2>
    <p style="margin:4px 0 0;color:#666;font-size:13px">Dashboard Ejecutivo &mdash; {k['mes']}</p>
  </div>

  <h3 style="color:#1B2A4A;font-size:15px">Indicadores Clave</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Servicios Liquidados</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#1A7A4A;font-weight:bold">{k['total_active']:,}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Cancelados</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#C0392B">{k['total_cancelled']:,} ({fmt_pct(k['pct_cancel'])})</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Facturacion Total</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#C9A84C;font-weight:bold;font-size:16px">{fmt_cop(k['total_factura'])}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Ticket Promedio</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{fmt_cop(k['ticket'])}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Conductores Activos</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{k['conductores_n']}</td></tr>
    <tr><td style="padding:8px"><strong>Clientes Distintos</strong></td>
        <td style="padding:8px;text-align:right">{k['clientes_n']}</td></tr>
  </table>

  <h3 style="color:#1B2A4A;margin-top:26px;font-size:15px">Top 5 Clientes</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">{rows_cli}</table>

  <h3 style="color:#1B2A4A;margin-top:26px;font-size:15px">Top 5 Conductores</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">{rows_cond}</table>

  <p style="margin-top:26px;font-size:12px;color:#666;background:#f7f7f7;padding:12px;border-radius:6px">
    Adjunto: dashboard completo en Excel con todas las hojas de detalle
    (clientes, conductores, vehiculos, productos, hoteles, tendencia diaria,
    horas pico, cancelaciones).
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">Reporte generado automaticamente &mdash; {EMPRESA}</p>
</body></html>
"""


def send_mail(kpis, dashboard_html, dashboard_filename, xlsx_path):
    msg = EmailMessage()
    msg['Subject'] = f"Dashboard Ejecutivo {EMPRESA} - {kpis['mes']}"
    msg['From'] = GMAIL_USER
    msg['To'] = ", ".join(DESTINATARIOS)
    if CC:
        msg['Cc'] = ", ".join(CC)

    msg.set_content(
        f"Dashboard {EMPRESA} - {kpis['mes']}\n\n"
        f"Servicios liquidados: {kpis['total_active']}\n"
        f"Facturacion total: {fmt_cop(kpis['total_factura'])}\n"
        f"Cancelados: {kpis['total_cancelled']} ({fmt_pct(kpis['pct_cancel'])})\n\n"
        f"Adjuntos:\n"
        f"  - {dashboard_filename} (dashboard interactivo - abrir en navegador)\n"
        f"  - {Path(xlsx_path).name} (datos fuente)"
    )
    msg.add_alternative(build_html(kpis), subtype='html')

    # Adjuntar el dashboard HTML interactivo
    msg.add_attachment(
        dashboard_html.encode('utf-8'),
        maintype='text',
        subtype='html',
        filename=dashboard_filename,
    )

    # Adjuntar tambien el .xlsx original
    with open(xlsx_path, 'rb') as f:
        msg.add_attachment(
            f.read(),
            maintype='application',
            subtype='vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=Path(xlsx_path).name,
        )

    recipients = DESTINATARIOS + CC
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as smtp:
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        smtp.send_message(msg, from_addr=GMAIL_USER, to_addrs=recipients)


def pick_file_dialog():
    """Abre un dialogo de Windows/Mac/Linux para escoger el .xlsx."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        path = filedialog.askopenfilename(
            title="Selecciona el archivo .xlsx del dashboard",
            filetypes=[("Excel", "*.xlsx *.xls"), ("Todos", "*.*")],
        )
        root.destroy()
        return path
    except Exception:
        return None


def pause_exit(code=0):
    """Espera Enter antes de cerrar (para que no se cierre la ventana en Windows)."""
    try:
        input("\nPresiona Enter para cerrar...")
    except EOFError:
        pass
    sys.exit(code)


def main():
    print("=" * 60)
    print(" EC TRANSPORTES - Envio de Dashboard por correo")
    print("=" * 60)

    # 1) Obtener ruta del xlsx (argumento o dialogo)
    if len(sys.argv) >= 2:
        xlsx_path = sys.argv[1]
    else:
        print("\nNo pasaste un archivo. Abriendo selector...")
        xlsx_path = pick_file_dialog()
        if not xlsx_path:
            xlsx_path = input("Pega aqui la ruta del .xlsx: ").strip().strip('"')

    if not xlsx_path or not Path(xlsx_path).exists():
        print(f"\nERROR: no existe el archivo: {xlsx_path}")
        pause_exit(1)

    # 2) Validar credenciales
    if (not GMAIL_USER or not GMAIL_APP_PASSWORD
            or GMAIL_USER == "tu_correo@gmail.com"
            or GMAIL_APP_PASSWORD == "xxxxxxxxxxxxxxxx"):
        print("\nERROR: faltan credenciales.")
        print("Abre 'config.txt' (en esta misma carpeta) con el Bloc de notas")
        print("y completa:")
        print("   GMAIL_USER=tu_correo@gmail.com")
        print("   GMAIL_APP_PASSWORD=tu contrasena de aplicacion")
        print("\nGenera la contrasena en: https://myaccount.google.com/apppasswords")
        print("(Necesitas verificacion en 2 pasos activada).")
        pause_exit(1)

    if not DESTINATARIOS:
        print("\nERROR: no hay destinatarios.")
        print("Edita 'config.txt' y agrega al menos un correo en DESTINATARIOS.")
        pause_exit(1)

    # 3) Procesar
    print(f"\n[1/4] Leyendo {Path(xlsx_path).name} ...")
    try:
        _, data_raw, data_json = load_rows(xlsx_path)
    except Exception as e:
        print(f"ERROR al leer el archivo: {e}")
        pause_exit(1)

    if not data_raw:
        print("ERROR: el archivo esta vacio o no tiene filas de datos.")
        pause_exit(1)

    kpis = compute_kpis_from_data(data_raw)
    print(f"[2/4] Periodo: {kpis['mes']} | "
          f"{kpis['total_active']} servicios | {fmt_cop(kpis['total_factura'])}")

    # 4) Generar dashboard interactivo
    print("[3/4] Generando dashboard HTML interactivo ...")
    dashboard_html = build_interactive_html(data_json, kpis)
    if dashboard_html is None:
        print(f"ERROR: no se encontro '{TEMPLATE_FILE}' en la carpeta del script.")
        print(f"Pon el archivo '{TEMPLATE_FILE}' junto al .py y vuelve a ejecutar.")
        pause_exit(1)

    safe_mes = kpis['mes'].replace(' ', '_')
    dashboard_filename = f"Dashboard_ECT_{safe_mes}.html"

    # Guardar tambien una copia local junto al .xlsx
    try:
        local_copy = Path(xlsx_path).resolve().parent / dashboard_filename
        local_copy.write_text(dashboard_html, encoding="utf-8")
        print(f"        Copia guardada en: {local_copy}")
    except Exception as e:
        print(f"        (No se pudo guardar copia local: {e})")

    # 5) Enviar
    print(f"[4/4] Enviando a: {', '.join(DESTINATARIOS)} ...")
    try:
        send_mail(kpis, dashboard_html, dashboard_filename, xlsx_path)
    except smtplib.SMTPAuthenticationError:
        print("\nERROR: autenticacion fallida. Verifica:")
        print("  - Tener verificacion en 2 pasos activada en tu cuenta Google.")
        print("  - Usar contrasena de APLICACION (no la contrasena normal).")
        print("  - GMAIL_USER y GMAIL_APP_PASSWORD correctos.")
        pause_exit(1)
    except Exception as e:
        print(f"\nERROR al enviar: {e}")
        pause_exit(1)

    print("\nOK: correo enviado correctamente.")
    print(f"     Dashboard interactivo adjunto como: {dashboard_filename}")
    pause_exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelado por el usuario.")
        pause_exit(1)
    except Exception as e:
        print(f"\nERROR inesperado: {e}")
        import traceback
        traceback.print_exc()
        pause_exit(1)
