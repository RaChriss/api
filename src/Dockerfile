# ============================================
# Dockerfile - API REST Node.js
# ============================================

FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY src ./src

# Exposer le port
EXPOSE 3001

# Variables d'environnement par défaut
ENV NODE_ENV=development
ENV PORT=3001

# Commande de démarrage
CMD ["node", "src/server.js"]
