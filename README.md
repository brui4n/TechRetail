# TechRetail - Arquitectura de Microservicios con Docker Swarm en AWS

Este proyecto implementa una arquitectura de microservicios escalable y de alta disponibilidad para la tienda "TechRetail", orquestada mediante **Docker Swarm** y desplegada en una infraestructura de nube en **Amazon Web Services (AWS)**.

---

## 🏗️ Arquitectura del Sistema

El ecosistema se distribuye en 3 nodos (instancias EC2) y consta de:
1.  **Frontend (Nginx):** Interfaz web con 3 réplicas (balanceo de carga).
2.  **Backend (Node.js):** API REST con 2 réplicas.
3.  **Database (MySQL 8):** Persistencia de datos con Docker Secrets.
4.  **Cache (Redis 7):** Optimización de consultas con TTL de 15s.
5.  **Visualizer:** Monitorización gráfica del clúster (Puerto 8080).

---

## 🚀 Guía de Despliegue Paso a Paso

### Paso 1: Configuración de Red en AWS (VPC)
Para que el clúster sea funcional, las instancias deben estar en la misma red con los puertos correctos abiertos.

1.  **Crear VPC:** Crea una VPC (ej. `10.0.0.0/16`).
2.  **Internet Gateway:** Crea uno y adjúntalo a tu VPC.
3.  **Subnets (Públicas):** Crea **2 subredes públicas** en diferentes Zonas de Disponibilidad (AZ). Es vital que sean públicas para que los nodos puedan descargar las imágenes desde Docker Hub sin necesidad de un NAT Gateway:
    *   **Subnet-1:** Rango `10.0.1.0/24` en Zona `us-east-1a`.
    *   **Subnet-2:** Rango `10.0.2.0/24` en Zona `us-east-1b`.
    *   Habilita "Auto-assign public IPv4" en ambas.
4.  **Security Group (Configuración Maestra):** Crea un grupo llamado `techretail-sg`. Debes configurar las **Reglas de Entrada (Inbound)** exactamente así:

| Tipo | Protocolo | Puerto | Origen | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | 22 | 0.0.0.0/0 | Acceso remoto |
| **HTTP** | TCP | 80 | 0.0.0.0/0 | Tienda Web |
| **Custom TCP** | TCP | 8080 | 0.0.0.0/0 | Visualizer |
| **Custom TCP** | TCP | 2377 | 10.0.0.0/16 | Gestión de Swarm (Solo VPC) |
| **Custom TCP** | TCP | 7946 | 10.0.0.0/16 | Comunicación Nodos (TCP) |
| **Custom UDP** | UDP | 7946 | 10.0.0.0/16 | Comunicación Nodos (UDP) |
| **Custom UDP** | UDP | 4789 | 10.0.0.0/16 | Red Overlay VXLAN |

> **💡 Tip Profesional:** Para mayor facilidad en AWS, puedes configurar el "Origen" de los puertos de Swarm (2377, 7946, 4789) usando el ID del propio Security Group. Esto permite que las máquinas se hablen entre ellas sin restricciones.

### Paso 2: Lanzamiento de Instancias EC2
Para maximizar la disponibilidad, distribuiremos las máquinas entre las dos zonas:
1.  **Instancia Manager:** Lanza una `t2.micro` (Ubuntu 22.04) en la **Subnet-1**.
2.  **Instancias Workers:** Lanza dos `t2.micro` (Ubuntu 22.04) en la **Subnet-2**.
3.  Asigna el Security Group `techretail-sg` a las tres instancias.

### Paso 3: Instalación de Docker
> **⚠️ Importante:** Para acceder a las máquinas mediante SSH, asegúrate de tener a mano tu par de claves (`.pem`) y ejecutar el comando:  
> `ssh -i "tu-llave.pem" ubuntu@<IP_PUBLICA>`

En las **3 máquinas**, ejecuta los comandos de instalación oficial:
```bash
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar para aplicar cambios de grupo
```

### Paso 4: Inicialización del Clúster Swarm
1.  En el nodo **Manager**, inicializa el clúster:
    ```bash
    docker swarm init --advertise-addr <IP_PRIVADA_MANAGER>
    ```
2.  Copia el comando `docker swarm join --token ...` que aparece en pantalla.
3.  Pega ese comando en **Worker-1** y **Worker-2**.
4.  Verifica los nodos desde el Manager: `docker node ls`.

### Paso 5: Preparación de Imágenes (Buildx)
Si trabajas desde una Mac (M1/M2/M3), debes compilar para arquitectura Intel/AMD que usa AWS:
```bash
# Desde tu PC local
docker buildx build --platform linux/amd64 -t brui4n/techretail-frontend ./frontend --push
docker buildx build --platform linux/amd64 -t brui4n/techretail-backend ./backend --push
```

### Paso 6: Despliegue del Stack (En el Manager)
1.  Clona el repositorio:
    ```bash
    git clone https://github.com/brui4n/TechRetail
    cd TechRetail/techretail
    ```
2.  Crea el secreto para la base de datos:
    ```bash
    echo "MiPasswordSegura123" | docker secret create db_password -
    ```
3.  Despliega el sistema:
    ```bash
    export DOCKER_USER=brui4n
    docker stack deploy -c docker-compose.yml techretail
    ```

---

## 📊 Monitoreo y Verificación

*   **Estado de servicios:** `docker stack services techretail`
*   **Acceso Web:** Ingresa a la IP Pública del **Manager** en el puerto `80`.
*   **Visualizer:** Ingresa a la IP Pública del **Manager** en el puerto `8080`.

> **Nota:** Al refrescar la tienda, verás que el campo "Contenedor" cambia entre diferentes IDs. Esto confirma que el balanceador de carga de Swarm está distribuyendo el tráfico entre las 3 réplicas del frontend.
