from django.urls import path
from .views import FrontendView, ActivoSeguroView, ActivoQRSeguroView, QRPageView, ReporteActivosView

urlpatterns = [
    path("", FrontendView.as_view(), name="frontend"),
    path("activos/<codigo>/", ActivoSeguroView.as_view(), name="activo-seguro"),
    path("activos/<codigo>/qr/", ActivoQRSeguroView.as_view(), name="qr-seguro"),
    path("activos/<codigo>/qr/view/", QRPageView.as_view(), name="qr-view"),

    path("reportes/activos/", ReporteActivosView.as_view(), name="reporte-activos"),
]
