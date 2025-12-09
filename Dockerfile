# Imagen base con Python
FROM python:3.11-slim

# Evitar que Python guarde .pyc y buffering raro
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Crear carpeta de trabajo
WORKDIR /app

# Instalar dependencias del sistema (opcional pero útil)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalarlos
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo el proyecto
COPY . /app/

# Exponer el puerto donde correrá Django dentro del contenedor
EXPOSE 8000

# Comando por defecto: correr Django (modo desarrollo)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
