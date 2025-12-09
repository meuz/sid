import re
import qrcode
import io
import requests
import os
import datetime

from django.http import HttpResponse
from django.views.generic import TemplateView

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

OCS_API_BASE = "http://192.168.1.12:5001/ocs-api"

#  AUDITORÍA 
def registrar_evento(request, accion, descripcion):
    """
    Envía la auditoría al servidor OCS mediante el webservice Flask.
    No guarda nada localmente.
    """
    try:
        usuario = request.user.username if request.user.is_authenticated else "anonimo"

        payload = {
            "usuario": usuario,
            "accion": accion,
            "descripcion": descripcion,
        }

        url = f"{OCS_API_BASE}/auditoria/"

        # Enviamos el POST al OCS API
        requests.post(url, json=payload, timeout=3)

    except Exception as e:
        # No queremos que la app se caiga si falla la auditoría,
        # solo lo mostramos en consola para depurar.
        print("Error enviando auditoría al OCS API:", e)

#  VALIDACIÓN DE CÓDIGO
def validar_codigo_activo(codigo):
    return re.fullmatch(r"[A-Za-z0-9_-]{1,50}", str(codigo)) is not None

#  OBTENER ACTIVO DESDE WEBSERVICE (futuro: Flask OCS API)
def obtener_activo_bd(codigo):
    """
    Llama a tu webservice Flask en el servidor OCS:
    GET /ocs-api/activos/<codigo>/

    Devuelve el JSON del activo o None si no existe / hay error.
    """
    try:
        url = f"{OCS_API_BASE}/activos/{codigo}/"
        r = requests.get(url, timeout=3)

        # Si Flask devuelve 404, 500, etc → no hay activo
        if r.status_code != 200:
            print("OCS API devolvió status", r.status_code, "para código", codigo)
            return None

        try:
            data = r.json()
        except ValueError:
            # Respuesta no era JSON válido
            print("Respuesta no JSON desde OCS API para código", codigo, "->", r.text[:200])
            return None

        return data

    except requests.RequestException as e:
        print("Error llamando al OCS API:", e)
        return None


#  FRONTEND
class FrontendView(TemplateView):
    template_name = "index.html"

#  API: CONSULTA SEGURA DE ACTIVOS
class ActivoSeguroView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo):

        # --- Código inválido ---
        if not validar_codigo_activo(codigo):
            registrar_evento(
                request,
                "consulta_activo_invalido",
                f"Código inválido ingresado: {codigo}"
            )
            return Response({"error": "Código inválido."}, status=400)

        # --- Obtener datos del activo ---
        activo = obtener_activo_bd(codigo)

        if not activo:
            registrar_evento(
                request,
                "consulta_activo_no_encontrado",
                f"Código no encontrado: {codigo}"
            )
            return Response({"error": "Activo no encontrado."}, status=404)

        # --- Consulta exitosa ---
        registrar_evento(
            request,
            "consulta_activo_ok",
            f"Consultó activo {codigo}"
        )

        return Response(activo)

#  API: GENERACIÓN DE QR
class ActivoQRSeguroView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo):

        if not validar_codigo_activo(codigo):
            registrar_evento(
                request,
                "qr_codigo_invalido",
                f"Intentó generar QR con código inválido: {codigo}"
            )
            return Response({"error": "Código inválido"}, status=400)

        activo = obtener_activo_bd(codigo)
        if not activo:
            registrar_evento(
                request,
                "qr_codigo_no_encontrado",
                f"Intentó generar QR de código inexistente: {codigo}"
            )
            return Response({"error": "Activo no existe"}, status=404)

        # Registro de auditoría
        registrar_evento(
            request,
            "qr_generado",
            f"Generó QR del activo {codigo}"
        )

        # Generar QR
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(str(codigo))
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, "PNG")
        buffer.seek(0)

        return HttpResponse(buffer.getvalue(), content_type="image/png")

#  VISTA PARA MOSTRAR UNA PÁGINA HTML CON EL QR
class QRPageView(TemplateView):
    template_name = "qr.html"

    def get_context_data(self, codigo, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["codigo"] = codigo
        ctx["qr_url"] = f"/api/activos/{codigo}/qr/"
        return ctx

class ReporteActivosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        edificio = request.query_params.get("edificio")
        area = request.query_params.get("area")
        departamento = request.query_params.get("departamento")

        params = {}
        if edificio:
            params["edificio"] = edificio
        if area:
            params["area"] = area
        if departamento:
            params["departamento"] = departamento

        try:
            url = f"{OCS_API_BASE}/reportes/activos/"
            r = requests.get(url, params=params, timeout=5)

            try:
                data = r.json()
            except ValueError:
                data = {"error": "Respuesta no válida desde OCS API"}

            return Response(data, status=r.status_code)

        except requests.RequestException as e:
            print("Error llamando al OCS API (reporte activos):", e)
            return Response(
                {"error": "No se pudo obtener el reporte desde el servidor OCS"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
