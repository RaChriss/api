#!/bin/bash

# Script d'installation complet du système de signalements
# Utilisation: bash setup.sh

set -e

echo "🚀 Installation du système de signalements"
echo "==========================================="
echo ""

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "Téléchargez-le sur https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js trouvé: $(node --version)${NC}"
echo ""

# Installer frontend
echo -e "${YELLOW}📦 Installation du frontend...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Frontend installé${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules existe déjà${NC}"
fi
echo ""

# Installer backend
echo -e "${YELLOW}📦 Installation du backend...${NC}"
if [ ! -d "backend/node_modules" ]; then
    cd backend
    npm install
    echo -e "${GREEN}✅ Backend installé${NC}"
    cd ..
else
    echo -e "${YELLOW}⚠️  backend/node_modules existe déjà${NC}"
fi
echo ""

# Créer .env files
echo -e "${YELLOW}🔐 Configuration des fichiers .env${NC}"

# Frontend
if [ ! -f ".env.local" ]; then
    cat > .env.local << EOF
VITE_API_URL=http://localhost:3000
EOF
    echo -e "${GREEN}✅ .env.local créé${NC}"
else
    echo -e "${YELLOW}⚠️  .env.local existe déjà${NC}"
fi

# Backend
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}⚠️  backend/.env créé${NC}"
    echo -e "${RED}❌ IMPORTANT: Remplissez backend/.env avec vos credentials Firebase!${NC}"
else
    echo -e "${YELLOW}⚠️  backend/.env existe déjà${NC}"
fi
echo ""

# Résumé
echo -e "${GREEN}✅ Installation terminée!${NC}"
echo ""
echo "📋 Prochaines étapes:"
echo "===================="
echo ""
echo "1️⃣  Configurez Firebase Admin SDK:"
echo "   • Allez sur: https://console.firebase.google.com"
echo "   • Sélectionnez: fir-project-59287"
echo "   • Paramètres → Comptes de service"
echo "   • Générez une clé privée JSON"
echo "   • Copiez les valeurs dans backend/.env"
echo ""
echo "2️⃣  Démarrez le backend:"
echo "   cd backend && npm run dev"
echo ""
echo "3️⃣  Démarrez le frontend (nouveau terminal):"
echo "   npm run dev"
echo ""
echo "4️⃣  Ouvrez:"
echo "   • Frontend: http://localhost:5173"
echo "   • Backend: http://localhost:3000/health"
echo ""
echo "📚 Documentation:"
echo "   • API_INTEGRATION_README.md - Vue d'ensemble"
echo "   • ARCHITECTURE.md - Architecture système"
echo "   • FIREBASE_CONFIG.md - Configuration Firebase"
echo "   • FRONTEND_API_GUIDE.md - Guide intégration API"
echo "   • backend/README.md - Documentation backend"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Ne commitez jamais backend/.env dans Git!${NC}"
echo ""
