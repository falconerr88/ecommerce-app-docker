# Ecommerce App

Este repositorio contiene una aplicación de ecommerce orquestada con **Docker Compose**.  
Incluye backend, frontend, base de datos, cache y servidor web.

---

## 🛠 Tecnologías utilizadas

- **FastAPI**: Backend API.
- **Redis**: Cache y mensajería.
- **PostgreSQL**: Base de datos.
- **NGINX**: Servidor web y reverse proxy.
- **Docker**: Contenerización de servicios.
- **Docker Compose**: Orquestación de contenedores.
- **Frontend**: HTML, CSS y JavaScript puros servidos con NGINX.

---



🚀 Cómo ejecutar la aplicación
Requisitos

Docker

Docker Compose

Pasos

Clonar el repositorio:

git clone git@github.com:falconerr88/ecommerce-app-docker.git

cd ecommerce-app-docker


Crear .env a partir de .env.example:

cp .env.example .env


Levantar los contenedores:

docker-compose up -d --build


Verificar contenedores corriendo:

docker-compose ps

🌐 Acceso a la aplicación

Frontend:
Abrir en el navegador:

http://localhost:${FRONTEND_PORT}

🧹 Detener y limpiar

Para detener los contenedores:

docker-compose down


Para detener y borrar contenedores, redes y volúmenes:

docker-compose down -v

📜 Licencia

MIT License
© 2025 Thiago
