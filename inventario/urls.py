from django.urls import path
from .views import FrontendView, ActivoSeguroView, ActivoQRSeguroView, QRPageView, ReporteActivosView, actualizar_estado_activo

urlpatterns = [
    path("", FrontendView.as_view(), name="frontend"),

    # GET /api/activos/<codigo>/
    path("activos/<codigo>/", ActivoSeguroView.as_view(), name="activo-seguro"),

    # PATCH /api/activos/<codigo>/estado/
    path("activos/<codigo>/estado/", actualizar_estado_activo, name="activo-estado",),

    path("activos/<codigo>/qr/", ActivoQRSeguroView.as_view(), name="qr-seguro"),
    path("activos/<codigo>/qr/view/", QRPageView.as_view(), name="qr-view"),

    path("reportes/activos/", ReporteActivosView.as_view(), name="reporte-activos"),
]
