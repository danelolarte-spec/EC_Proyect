#!/usr/bin/env python3
"""
EC_Dashboard_Trimestral.py

Lee un .xlsx con varios meses de servicios EC Transportes (formato consolidado,
con FECHA DEL SERVICIO en AAAA-MM-DD) y genera un dashboard HTML interactivo
con analisis cruzado mes a mes. Adjunta el HTML + el xlsx original al correo.

Uso:
    python EC_Dashboard_Trimestral.py archivo.xlsx

Comparte el mismo config.txt que EC_Dashboard_GoogleDrive.py
(GMAIL_USER, GMAIL_APP_PASSWORD, DESTINATARIOS, CC).
"""
import sys
import os
import json
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from datetime import datetime, date, time
from collections import defaultdict

try:
    from openpyxl import load_workbook
except ImportError:
    print("Falta openpyxl. Instala con:  pip install openpyxl")
    try:
        input("\nPresiona Enter para cerrar...")
    except EOFError:
        pass
    sys.exit(1)

EMPRESA = "EC Transportes"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
TEMPLATE_FILE = "EC_Dashboard_Trimestral.html"
CONFIG_FILE = "config.txt"

CONFIG_TEMPLATE = """# Configuracion (compartida con EC_Dashboard_GoogleDrive)
GMAIL_USER=tu_correo@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
DESTINATARIOS=gerenciademarca@ectransportes.com
CC=
"""

MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


def fmt_cop(v):
    if v is None:
        return "-"
    return "$" + f"{int(round(v)):,}".replace(",", ".")


def fmt_pct(v):
    if v is None:
        return "-"
    return f"{v * 100:.1f}%"


def numv(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def parse_fecha(d):
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
        try:
            return datetime.fromisoformat(s.replace(' ', 'T'))
        except ValueError:
            pass
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d")
        except ValueError:
            pass
        for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(s[:10], fmt)
            except ValueError:
                continue
    return None


def load_config():
    cfg_path = Path(__file__).resolve().parent / CONFIG_FILE
    if not cfg_path.exists():
        cfg_path.write_text(CONFIG_TEMPLATE, encoding="utf-8")
        print(f"Se creo {cfg_path}")
        print("Editalo con tus datos y vuelve a ejecutar.")
        try:
            input("\nPresiona Enter para cerrar...")
        except EOFError:
            pass
        sys.exit(0)

    cfg = {}
    for line in cfg_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        cfg[k.strip()] = v.strip()
    return (
        cfg.get("GMAIL_USER", "").strip(),
        cfg.get("GMAIL_APP_PASSWORD", "").strip(),
        [x.strip() for x in cfg.get("DESTINATARIOS", "").split(",") if x.strip()],
        [x.strip() for x in cfg.get("CC", "").split(",") if x.strip()],
    )


GMAIL_USER, GMAIL_APP_PASSWORD, DESTINATARIOS, CC = load_config()


def load_rows(xlsx_path):
    wb = load_workbook(xlsx_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [dict(zip(headers, r)) for r in rows[1:]]


def month_key(dt):
    return f"{dt.year}-{dt.month:02d}"


def month_label(key):
    y, m = key.split("-")
    return f"{MONTHS_ES[int(m) - 1]} {y}"


def aggregate(rows):
    """Devuelve un dict serializable con todo el analisis cruzado."""
    # 1) Parsear fechas y agrupar por mes
    months = set()
    for r in rows:
        d = parse_fecha(r.get("FECHA DEL SERVICIO"))
        r["_dt"] = d
        if d:
            months.add(month_key(d))

    months_sorted = sorted(months)
    month_labels = [month_label(k) for k in months_sorted]
    if not months_sorted:
        return None

    active_states = {"DIALIQUIDADO", "LIQUIDADO"}

    def is_active(r):
        return r.get("ESTADO") in active_states

    active = [r for r in rows if is_active(r) and r["_dt"]]

    # 2) Metricas mensuales
    monthly = []
    for mk in months_sorted:
        in_month = [r for r in rows if r["_dt"] and month_key(r["_dt"]) == mk]
        act = [r for r in in_month if is_active(r)]
        canc = [r for r in in_month if r.get("ESTADO") == "CANCELADO"]
        fact = sum(numv(r.get("VALOR")) for r in act)
        svc = len(act)
        total_in_month = len(in_month)
        monthly.append({
            "mes": month_label(mk),
            "key": mk,
            "servicios": svc,
            "facturacion": fact,
            "ticket": (fact / svc) if svc else 0,
            "cancelados": len(canc),
            "pctCancel": (len(canc) / total_in_month) if total_in_month else 0,
        })

    total_fact = sum(m["facturacion"] for m in monthly)
    total_svc = sum(m["servicios"] for m in monthly)
    total_canc = sum(m["cancelados"] for m in monthly)
    total_all = sum(1 for r in rows if r["_dt"])

    growth_mom = None
    if len(monthly) >= 2 and monthly[-2]["facturacion"]:
        growth_mom = (monthly[-1]["facturacion"] - monthly[-2]["facturacion"]) / monthly[-2]["facturacion"]

    best_month = max(monthly, key=lambda m: m["facturacion"]) if monthly else None

    # 3) Top por entidad con desglose mensual
    def top_by(key_field, n=15, source=None, value="factura"):
        src = source if source is not None else active
        agg_per = defaultdict(lambda: {"total": 0.0, "byMonth": defaultdict(float), "svc": 0})
        for r in src:
            name = r.get(key_field)
            if not name:
                continue
            mk = month_key(r["_dt"])
            v = numv(r.get("VALOR")) if value == "factura" else 1
            agg_per[name]["total"] += v
            agg_per[name]["byMonth"][mk] += v
            agg_per[name]["svc"] += 1
        out = []
        for name, d in agg_per.items():
            by_month_arr = [d["byMonth"].get(mk, 0.0) for mk in months_sorted]
            out.append({
                "name": name,
                "total": d["total"],
                "byMonth": by_month_arr,
                "svc": d["svc"],
            })
        out.sort(key=lambda x: -x["total"])
        return out[:n]

    top_clientes = top_by("CLIENTE", 15)
    top_conductores = top_by("CONDUCTOR", 15)
    top_placas = top_by("PLACA", 12)
    top_productos = top_by("PRODUCTO", 12)

    hotels = [r for r in active if r.get("TIPO DE CLIENTE") == "HOTEL"]
    top_hoteles = top_by("CLIENTE", 12, source=hotels)

    # 4) Matrices stacked (categoria x mes) — facturacion
    def matrix_by(key_field, source=None, n=8):
        src = source if source is not None else active
        # Top N categorias por total
        totals = defaultdict(float)
        for r in src:
            k = r.get(key_field) or "(sin)"
            totals[k] += numv(r.get("VALOR"))
        cats = sorted(totals.keys(), key=lambda k: -totals[k])[:n]
        # Construir matriz
        matriz = [[0.0] * len(months_sorted) for _ in cats]
        cat_idx = {c: i for i, c in enumerate(cats)}
        for r in src:
            k = r.get(key_field) or "(sin)"
            if k not in cat_idx:
                continue
            mi = months_sorted.index(month_key(r["_dt"]))
            matriz[cat_idx[k]][mi] += numv(r.get("VALOR"))
        return {"categorias": cats, "matriz": matriz}

    by_tipo_cliente = matrix_by("TIPO DE CLIENTE")
    by_pago = matrix_by("MÉTODO DE PAGO")
    by_vehiculo = matrix_by("TIPO DE VEHÍCULO")

    # 5) Estados por mes (conteo, no facturacion)
    estados = defaultdict(lambda: [0] * len(months_sorted))
    for r in rows:
        if not r["_dt"]:
            continue
        e = r.get("ESTADO") or "(sin)"
        mi = months_sorted.index(month_key(r["_dt"]))
        estados[e][mi] += 1
    estado_keys = sorted(estados.keys(), key=lambda k: -sum(estados[k]))[:6]
    by_estado = {
        "categorias": estado_keys,
        "matriz": [estados[k] for k in estado_keys],
    }

    return {
        "periodo": f"{month_labels[0]} — {month_labels[-1]}" if len(month_labels) > 1 else month_labels[0],
        "meses": month_labels,
        "monthly": monthly,
        "totals": {
            "facturacion": total_fact,
            "servicios": total_svc,
            "ticket": (total_fact / total_svc) if total_svc else 0,
            "cancelados": total_canc,
            "pctCancel": (total_canc / total_all) if total_all else 0,
            "growthMoM": growth_mom,
        },
        "bestMonth": {
            "name": best_month["mes"] if best_month else "-",
            "facturacion": best_month["facturacion"] if best_month else 0,
        },
        "topClientes": top_clientes,
        "topConductores": top_conductores,
        "topPlacas": top_placas,
        "topProductos": top_productos,
        "topHoteles": top_hoteles,
        "byTipoCliente": by_tipo_cliente,
        "byPago": by_pago,
        "byVehiculo": by_vehiculo,
        "byEstado": by_estado,
    }


def build_interactive_html(D):
    template_path = Path(__file__).resolve().parent / TEMPLATE_FILE
    if not template_path.exists():
        return None
    template = template_path.read_text(encoding="utf-8")
    embedded = json.dumps(D, ensure_ascii=False, default=str)
    injection = (
        "<script>window.__EMBEDDED__ = " + embedded + ";</script>\n"
    )
    # Insertar antes del primer <script> que usa __EMBEDDED__ (despues de </template>)
    marker = "<template id=\"tpl-content\">"
    if marker in template:
        return template.replace(marker, injection + marker)
    return template.replace("</body>", injection + "</body>")


def build_email_html(D):
    rows_monthly = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'><strong>{m['mes']}</strong></td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;color:#1A7A4A;font-weight:bold'>{fmt_cop(m['facturacion'])}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{m['servicios']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{fmt_cop(m['ticket'])}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;color:#C0392B'>{fmt_pct(m['pctCancel'])}</td></tr>"
        for m in D["monthly"]
    )
    growth = D["totals"]["growthMoM"]
    growth_html = (
        f"<span style='color:{'#1A7A4A' if growth and growth>=0 else '#C0392B'};font-weight:bold'>"
        f"{'▲' if growth and growth>=0 else '▼'} {fmt_pct(growth)}</span>"
    ) if growth is not None else "—"

    return f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#1B2A4A;max-width:720px;margin:0 auto;padding:24px;background:#fff">
  <div style="border-bottom:3px solid #C9A84C;padding-bottom:14px;margin-bottom:22px">
    <h2 style="color:#C9A84C;margin:0;letter-spacing:2px">EC TRANSPORTES</h2>
    <p style="margin:4px 0 0;color:#666;font-size:13px">Dashboard Trimestral &mdash; {D['periodo']}</p>
  </div>

  <h3 style="color:#1B2A4A;font-size:15px">Resumen del Periodo</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Facturacion Total</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#C9A84C;font-weight:bold;font-size:16px">{fmt_cop(D['totals']['facturacion'])}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Servicios Liquidados</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{D['totals']['servicios']:,}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Ticket Promedio</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{fmt_cop(D['totals']['ticket'])}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Crecimiento MoM (ultimo vs anterior)</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{growth_html}</td></tr>
    <tr><td style="padding:8px"><strong>Mejor Mes</strong></td>
        <td style="padding:8px;text-align:right">{D['bestMonth']['name']} &mdash; {fmt_cop(D['bestMonth']['facturacion'])}</td></tr>
  </table>

  <h3 style="color:#1B2A4A;margin-top:26px;font-size:15px">Comparativa Mensual</h3>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
    <tr style="background:#1B2A4A;color:#C9A84C">
      <th style="padding:8px;text-align:left">Mes</th>
      <th style="padding:8px;text-align:right">Facturacion</th>
      <th style="padding:8px;text-align:right">Servicios</th>
      <th style="padding:8px;text-align:right">Ticket</th>
      <th style="padding:8px;text-align:right">% Cancel</th>
    </tr>
    {rows_monthly}
  </table>

  <p style="margin-top:26px;font-size:12px;color:#666;background:#f7f7f7;padding:12px;border-radius:6px">
    Adjuntos:<br>
    &mdash; Dashboard interactivo (.html) con tablas top y graficos comparativos mes a mes<br>
    &mdash; Archivo .xlsx fuente
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">Reporte trimestral automatico &mdash; {EMPRESA}</p>
</body></html>
"""


def send_mail(D, dashboard_html, dashboard_filename, xlsx_path):
    msg = EmailMessage()
    msg["Subject"] = f"Dashboard Trimestral {EMPRESA} - {D['periodo']}"
    msg["From"] = GMAIL_USER
    msg["To"] = ", ".join(DESTINATARIOS)
    if CC:
        msg["Cc"] = ", ".join(CC)

    msg.set_content(
        f"Dashboard Trimestral {EMPRESA}\n"
        f"Periodo: {D['periodo']}\n\n"
        f"Facturacion total: {fmt_cop(D['totals']['facturacion'])}\n"
        f"Servicios: {D['totals']['servicios']}\n"
        f"Mejor mes: {D['bestMonth']['name']} ({fmt_cop(D['bestMonth']['facturacion'])})\n\n"
        f"Adjuntos: dashboard interactivo (.html) y archivo fuente (.xlsx)."
    )
    msg.add_alternative(build_email_html(D), subtype="html")

    msg.add_attachment(dashboard_html.encode("utf-8"),
                       maintype="text", subtype="html",
                       filename=dashboard_filename)

    with open(xlsx_path, "rb") as f:
        msg.add_attachment(f.read(),
                           maintype="application",
                           subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                           filename=Path(xlsx_path).name)

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as smtp:
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        smtp.send_message(msg, from_addr=GMAIL_USER, to_addrs=DESTINATARIOS + CC)


def pick_file_dialog():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(
            title="Selecciona el .xlsx con los meses a analizar",
            filetypes=[("Excel", "*.xlsx *.xls"), ("Todos", "*.*")],
        )
        root.destroy()
        return path
    except Exception:
        return None


def pause_exit(code=0):
    try:
        input("\nPresiona Enter para cerrar...")
    except EOFError:
        pass
    sys.exit(code)


def main():
    print("=" * 60)
    print(" EC TRANSPORTES - Dashboard Trimestral (analisis cruzado)")
    print("=" * 60)

    if len(sys.argv) >= 2:
        xlsx_path = sys.argv[1]
    else:
        print("\nSelecciona el .xlsx con varios meses ...")
        xlsx_path = pick_file_dialog()
        if not xlsx_path:
            xlsx_path = input("Pega la ruta del .xlsx: ").strip().strip('"')

    if not xlsx_path or not Path(xlsx_path).exists():
        print(f"\nERROR: no existe: {xlsx_path}")
        pause_exit(1)

    if (not GMAIL_USER or not GMAIL_APP_PASSWORD
            or GMAIL_USER == "tu_correo@gmail.com"
            or GMAIL_APP_PASSWORD == "xxxxxxxxxxxxxxxx"):
        print("\nERROR: faltan credenciales en config.txt")
        pause_exit(1)
    if not DESTINATARIOS:
        print("\nERROR: no hay destinatarios en config.txt")
        pause_exit(1)

    print(f"\n[1/4] Leyendo {Path(xlsx_path).name} ...")
    try:
        rows = load_rows(xlsx_path)
    except Exception as e:
        print(f"ERROR al leer: {e}")
        pause_exit(1)
    if not rows:
        print("ERROR: el archivo esta vacio.")
        pause_exit(1)
    print(f"        {len(rows)} filas leidas.")

    print("[2/4] Agregando por mes ...")
    D = aggregate(rows)
    if not D:
        print("ERROR: no se detectaron fechas validas.")
        pause_exit(1)
    print(f"        Periodo detectado: {D['periodo']}")
    print(f"        Meses: {', '.join(D['meses'])}")
    for m in D["monthly"]:
        print(f"          {m['mes']:>20s}  {m['servicios']:>5d} svc  {fmt_cop(m['facturacion']):>12s}")

    print("[3/4] Generando dashboard HTML ...")
    html = build_interactive_html(D)
    if html is None:
        print(f"ERROR: falta plantilla '{TEMPLATE_FILE}' en esta carpeta.")
        pause_exit(1)

    safe = D["periodo"].replace(" ", "_").replace("—", "a").replace("/", "-")
    out_name = f"Dashboard_Trimestral_ECT_{safe}.html"
    try:
        local = Path(xlsx_path).resolve().parent / out_name
        local.write_text(html, encoding="utf-8")
        print(f"        Copia guardada en: {local}")
    except Exception as e:
        print(f"        (No se pudo guardar copia local: {e})")

    print(f"[4/4] Enviando a: {', '.join(DESTINATARIOS)} ...")
    try:
        send_mail(D, html, out_name, xlsx_path)
    except smtplib.SMTPAuthenticationError:
        print("\nERROR de autenticacion. Verifica config.txt.")
        pause_exit(1)
    except Exception as e:
        print(f"\nERROR al enviar: {e}")
        pause_exit(1)

    print("\nOK: correo enviado correctamente.")
    print(f"     Dashboard: {out_name}")
    pause_exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelado.")
        pause_exit(1)
    except Exception as e:
        print(f"\nERROR inesperado: {e}")
        import traceback
        traceback.print_exc()
        pause_exit(1)
