from rest_framework import serializers
from .models import Activo

class ActivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Activo
        fields = ['codigo', 'nombre', 'ubicacion', 'estado']
