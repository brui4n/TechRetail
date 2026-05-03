# TechRetail - Arquitectura Microservicios con Docker Swarm

Este proyecto es una implementación de una arquitectura de microservicios contenerizada para la tienda en línea "TechRetail", orquestada a través de **Docker Swarm**.

## 🏗️ Arquitectura del Sistema

El sistema se compone de los siguientes servicios:
1. **Frontend (Nginx):** Sirve una interfaz HTML/JS estática. Utiliza *Docker Configs* para inyectar su configuración. Desplegado con 3 réplicas.
2. **Backend (Node.js):** API RESTful construida con Express. Conectada a MySQL y Redis. Desplegado con 2 réplicas.
3. **Database (MySQL 8):** Base de datos relacional para persistir los productos. Utiliza *Docker Secrets* para credenciales.
4. **Cache (Redis 7):** Caché en memoria para optimizar la carga de los productos más consultados.
5. **Visualizer:** Herramienta gráfica para monitorizar los contenedores distribuidos en el clúster.

---

## 🚀 Guía de Despliegue (Play with Docker)

### 1. Preparación de Imágenes en Docker Hub (Requisito previo)
Para que los nodos *Workers* puedan descargar tus imágenes personalizadas, debes construirlas y subirlas a Docker Hub.

Ejecuta estos comandos en tu computadora local:
```bash
# Inicia sesión en Docker Hub
docker login

# Construir y subir imagen Frontend
docker build -t TU_USUARIO_DOCKER/techretail-frontend ./frontend
docker push TU_USUARIO_DOCKER/techretail-frontend

# Construir y subir imagen Backend
docker build -t TU_USUARIO_DOCKER/techretail-backend ./backend
docker push TU_USUARIO_DOCKER/techretail-backend
```

### 2. Inicialización del Clúster Swarm
1. Ingresa a [Play with Docker](https://labs.play-with-docker.com/).
2. Crea **3 instancias** (Nodos).
3. En el **Nodo 1 (Manager)**, inicializa el clúster:
   ```bash
   docker swarm init --advertise-addr <IP_NODO_1>
   ```
4. Copia el comando que genera (ej. `docker swarm join --token ...`) y pégalo en el **Nodo 2** y **Nodo 3** para unirlos como Workers.

### 3. Configuración y Despliegue (En el Nodo 1)
Descarga este repositorio en el Nodo 1 y entra a la carpeta:
```bash
git clone <URL_DE_TU_REPOSITORIO>
cd techretail
```

Crea el secreto seguro para la base de datos:
```bash
echo "MiPasswordSegura123" | docker secret create db_password -
```

Exporta tu usuario de Docker (para que el `docker-compose.yml` sepa de dónde bajar las imágenes) y despliega el Stack:
```bash
export DOCKER_USER=TU_USUARIO_DOCKER
docker stack deploy -c docker-compose.yml techretail
```

### 4. Monitoreo y Pruebas
Verifica que los servicios están corriendo:
```bash
docker stack services techretail
```

Abre los puertos habilitados en la parte superior de Play with Docker:
- **Puerto 80:** Tienda TechRetail.
- **Puerto 8080:** Visualizer del clúster Swarm.

Para probar el **escalado dinámico**, ejecuta:
```bash
docker service scale techretail_frontend=5
```

---

## 🔒 Manejo de Configuraciones Sensibles
- **Docker Secrets:** Se usó para la contraseña de la base de datos. El secreto `db_password` se inyecta de forma segura en MySQL y es leído por Node.js desde `/run/secrets/db_password`.
- **Docker Configs:** Se usó para la configuración de Nginx. El archivo `frontend/nginx.conf` es leído por el manager y distribuido al clúster sin estar "quemado" en la imagen.
