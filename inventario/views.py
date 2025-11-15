from django.views.generic import TemplateView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
import requests

class FrontendView(TemplateView):
    template_name = "index.html"


class ActivoFakeDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo):
        url = f"https://fakestoreapi.com/products/{codigo}"

        try:
            r = requests.get(url, timeout=5)
        except requests.RequestException:
            return Response(
                {"detail": "Error al conectar con el web service externo"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        if r.status_code != 200:
            return Response(
                {"detail": "Activo no encontrado en el web service"},
                status=status.HTTP_404_NOT_FOUND
            )

        data = r.json()
        return Response(data, status=status.HTTP_200_OK)
