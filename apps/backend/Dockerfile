# ---------- Stage 1: Builder ----------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar herramientas necesarias para compilar dependencias
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar en un directorio temporal
COPY requirements.txt /app/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---------- Stage 2: Runtime ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Crear usuario no root
RUN groupadd -r app && useradd -r -g app app

# Copiar librerías desde builder
COPY --from=builder /install /usr/local

# Copiar el código de la app
COPY . /app/

# Ajustar permisos
RUN chown -R app:app /app
USER app

# Healthcheck para verificar que la app está corriendo
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health/ || exit 1

EXPOSE 8000

# Comando final
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


