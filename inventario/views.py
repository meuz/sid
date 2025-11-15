import re
import qrcode
import io
import requests

from django.http import HttpResponse
from django.db import connection
from django.views.generic import TemplateView

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

def validar_codigo_activo(codigo):
    return re.fullmatch(r"[0-9]{1,10}", str(codigo)) is not None

#// Para una base de datos
# def obtener_activo_bd(codigo):

#     with connection.cursor() as cursor:
#         cursor.execute(
#             "SELECT deviceid, name, serial, location FROM hardware WHERE deviceid = %s",
#             [codigo]
#         )
#         row = cursor.fetchone()

#     if not row:
#         return None

#     return {
#         "id": row[0],
#         "nombre": row[1],
#         "serial": row[2],
#         "ubicacion": row[3],
#     }

def obtener_activo_bd(codigo):
    url = f"https://fakestoreapi.com/products/{codigo}"
    r = requests.get(url)

    if r.status_code != 200:
        return None

    data = r.json()

    return {
        "id": data["id"],
        "nombre": data["title"],
        "serial": data["category"],
        "ubicacion": "No aplica (FakeStoreAPI)"
    }



class FrontendView(TemplateView):
    template_name = "index.html"

class ActivoSeguroView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo):

        if not validar_codigo_activo(codigo):
            return Response({"error": "Código inválido."}, status=400)

        activo = obtener_activo_bd(codigo)

        if not activo:
            return Response({"error": "Activo no encontrado."}, status=404)

        return Response(activo)

class ActivoQRSeguroView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo):

        if not validar_codigo_activo(codigo):
            return Response({"error": "Código inválido"}, status=400)

        activo = obtener_activo_bd(codigo)
        if not activo:
            return Response({"error": "Activo no existe"}, status=404)

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(str(codigo))
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, "PNG")
        buffer.seek(0)

        return HttpResponse(buffer.getvalue(), content_type="image/png")

class QRPageView(TemplateView):
    template_name = "qr.html"

    def get_context_data(self, codigo, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["codigo"] = codigo
        ctx["qr_url"] = f"/api/activos/{codigo}/qr/"
        return ctx
