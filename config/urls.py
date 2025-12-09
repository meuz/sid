from django.contrib import admin
from django.urls import path, include
from inventario.views import FrontendView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('', FrontendView.as_view(), name='frontend-root'),

    path('admin/', admin.site.urls),

    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/', include('inventario.urls')),
]
