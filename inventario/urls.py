from django.urls import path
from .views import FrontendView, ActivoFakeDetailView

urlpatterns = [
    path('', FrontendView.as_view(), name='frontend'),
    path('activos/<int:codigo>/', ActivoFakeDetailView.as_view(), name='activo-fake-detalle'),
]
