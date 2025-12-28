import re
import qrcode
import io
import requests

from django.http import HttpResponse
from django.views.generic import TemplateView

from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import permissions, status

from .permissions import IsAdminOrJefeOrTecnico
from .permissions import IsAdminOrTecnico
from .permissions import IsAdminOrJefe


OCS_API_BASE = "http://172.20.10.3:5001/ocs-api"
ESTADOS_VALIDOS = ["activo", "inactivo", "en_mantencion", "de_baja"]

#  AUDITORIA
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
        # para que la app no caiga si falla la auditoría,
        # solo se muestra en consola para depurar.
        print("Error enviando auditoría al OCS API:", e)

#  validacion de codigo
def validar_codigo_activo(codigo):
    return re.fullmatch(r"[A-Za-z0-9_-]{1,50}", str(codigo)) is not None

#  obtencion activo webservice
def obtener_activo_bd(codigo):

    try:
        url = f"{OCS_API_BASE}/activos/{codigo}/"
        r = requests.get(url, timeout=3)

        # si Flask devuelve 404, 500, etc, no hay activo
        if r.status_code != 200:
            print("OCS API devolvió status", r.status_code, "para código", codigo)
            return None

        try:
            data = r.json()
        except ValueError:
            # respuesta no era JSON valido
            print("Respuesta no JSON desde OCS API para código", codigo, "->", r.text[:200])
            return None

        return data

    except requests.RequestException as e:
        print("Error llamando al OCS API:", e)
        return None

@api_view(["PATCH"])
@permission_classes([IsAdminOrTecnico])
def actualizar_estado_activo(request, codigo):
    nuevo_estado = request.data.get("estado")

    if nuevo_estado not in ESTADOS_VALIDOS:
        return Response(
            {"error": "Estado inválido"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        flask_url = f"{OCS_API_BASE}/activos/{codigo}/estado/"
        r = requests.patch(flask_url, json={"estado": nuevo_estado}, timeout=5)
    except requests.RequestException as e:
        print("Error conectando con Flask:", e)
        return Response(
            {"error": "Error conectando con el webservice OCS"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # reenviamos la respuesta de Flask
    try:
        data = r.json()
    except ValueError:
        data = {"detail": r.text}

    return Response(data, status=r.status_code)

#  FRONTEND
class FrontendView(TemplateView):
    template_name = "index.html"

#  API: CONSULTA SEGURA DE ACTIVOS
class ActivoSeguroView(APIView):
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [IsAdminOrJefeOrTecnico]

    def get(self, request, codigo):

        # --- Código inválido ---
        if not validar_codigo_activo(codigo):
            registrar_evento(
                request,
                "consulta_activo_invalido",
                f"Código inválido ingresado: {codigo}"
            )
            return Response({"error": "Código inválido."}, status=400)

        # obtener datos del activo
        activo = obtener_activo_bd(codigo)

        if not activo:
            registrar_evento(
                request,
                "consulta_activo_no_encontrado",
                f"Código no encontrado: {codigo}"
            )
            return Response({"error": "Activo no encontrado."}, status=404)

        # consulta exitosa 
        registrar_evento(
            request,
            "consulta_activo_ok",
            f"Consultó activo {codigo}"
        )

        return Response(activo)

#  API generacion del QR
class ActivoQRSeguroView(APIView):
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [IsAdminOrTecnico]

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

        # registro de auditoría
        registrar_evento(
            request,
            "qr_generado",
            f"Generó QR del activo {codigo}"
        )

        # generar QR
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(str(codigo))
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, "PNG")
        buffer.seek(0)

        return HttpResponse(buffer.getvalue(), content_type="image/png")

#  mostrar el qr en un html diferente
class QRPageView(TemplateView):
    template_name = "qr.html"

    def get_context_data(self, codigo, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["codigo"] = codigo
        ctx["qr_url"] = f"/api/activos/{codigo}/qr/"
        return ctx

class ReporteActivosView(APIView):
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [IsAdminOrJefe]

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
