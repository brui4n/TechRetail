FROM nginx:alpine

# Copiamos el archivo HTML
COPY index.html /usr/share/nginx/html/index.html

# NOTA: No copiamos nginx.conf aquí, porque usaremos Docker Configs 
# en Swarm para inyectarlo en /etc/nginx/conf.d/default.conf

EXPOSE 80
