# Utiliser une image Node.js officielle
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source compilé
COPY dist ./dist
COPY .env .env

# Exposer le port
EXPOSE 3000

# Lancer l'application
CMD ["node", "dist/index.js"]
