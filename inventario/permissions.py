from rest_framework.permissions import BasePermission

def is_in_group(user, group_name: str) -> bool:
    return user.is_authenticated and user.groups.filter(name=group_name).exists()

class IsAdministrador(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or is_in_group(request.user, "Administrador")
        )

class IsJefeArea(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and is_in_group(request.user, "JefeArea")

class IsTecnico(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and is_in_group(request.user, "Tecnico")

class IsAdminOrJefeOrTecnico(BasePermission):
    """Permite a cualquiera de los 3 grupos (o superuser)."""
    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (
            u.is_superuser
            or u.groups.filter(name__in=["Administrador", "JefeArea", "Tecnico"]).exists()
        )

class IsAdminOrTecnico(BasePermission):
    message = "No tienes permisos para realizar esta acción."

    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (
            u.is_superuser
            or u.groups.filter(name__in=["Administrador", "Tecnico"]).exists()
        )

class IsAdminOrJefe(BasePermission):
    message = "No tienes permisos para realizar esta acción."

    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (
            u.is_superuser
            or u.groups.filter(name__in=["Administrador", "JefeArea"]).exists()
        )
