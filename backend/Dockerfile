FROM node:18-alpine

# Directorio de trabajo
WORKDIR /usr/src/app

# Instalar dependencias primero (aprovechar caché de capas)
COPY package*.json ./
RUN npm install

# Copiar el resto del código fuente
COPY . .

# El backend corre en el puerto 3000
EXPOSE 3000

# Comando para iniciar la aplicación
CMD [ "node", "server.js" ]
