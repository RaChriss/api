# Dockerfile pour l'API de gestion des travaux routiers
FROM node:18-alpine

# Installer les dépendances système nécessaires
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

# Créer le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci --only=production && \
    npm cache clean --force

# Copier le code source
COPY src/ ./src/

# Compiler TypeScript
RUN npm run build

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001 -G nodejs

# Créer le répertoire pour les logs et donner les permissions
RUN mkdir -p /app/logs && \
    chown -R apiuser:nodejs /app

# Passer à l'utilisateur non-root
USER apiuser

# Exposer le port de l'API
EXPOSE 3001

# Définir les variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3001

# Commande de démarrage
CMD ["npm", "start"]

# Labels pour la documentation
LABEL maintainer="Travaux Routiers API"
LABEL version="1.0.0"
LABEL description="API REST pour la gestion des travaux routiers avec Firebase et PostgreSQL"
