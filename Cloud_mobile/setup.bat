@echo off
REM Script d'installation complet du système de signalements (Windows)
REM Utilisation: setup.bat

setlocal enabledelayedexpansion

echo.
echo 🚀 Installation du système de signalements
echo ===========================================
echo.

REM Vérifier Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js n'est pas installé
    echo Téléchargez-le sur https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js trouvé: %NODE_VERSION%
echo.

REM Installer frontend
echo 📦 Installation du frontend...
if not exist "node_modules\" (
    call npm install
    echo ✅ Frontend installé
) else (
    echo ⚠️  node_modules existe déjà
)
echo.

REM Installer backend
echo 📦 Installation du backend...
if not exist "backend\node_modules\" (
    cd backend
    call npm install
    echo ✅ Backend installé
    cd ..
) else (
    echo ⚠️  backend\node_modules existe déjà
)
echo.

REM Créer .env files
echo 🔐 Configuration des fichiers .env

REM Frontend .env.local
if not exist ".env.local" (
    (
        echo VITE_API_URL=http://localhost:3000
    ) > .env.local
    echo ✅ .env.local créé
) else (
    echo ⚠️  .env.local existe déjà
)

REM Backend .env
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo ✅ backend/.env créé
    echo ❌ IMPORTANT: Remplissez backend/.env avec vos credentials Firebase!
) else (
    echo ⚠️  backend/.env existe déjà
)
echo.

REM Résumé
echo ✅ Installation terminée!
echo.
echo 📋 Prochaines étapes:
echo ====================
echo.
echo 1️⃣  Configurez Firebase Admin SDK:
echo    • Allez sur: https://console.firebase.google.com
echo    • Sélectionnez: fir-project-59287
echo    • Paramètres -^> Comptes de service
echo    • Générez une clé privée JSON
echo    • Copiez les valeurs dans backend/.env
echo.
echo 2️⃣  Démarrez le backend (Terminal 1):
echo    cd backend
echo    npm run dev
echo.
echo 3️⃣  Démarrez le frontend (Terminal 2):
echo    npm run dev
echo.
echo 4️⃣  Ouvrez:
echo    • Frontend: http://localhost:5173
echo    • Backend: http://localhost:3000/health
echo.
echo 📚 Documentation:
echo    • API_INTEGRATION_README.md - Vue d'ensemble
echo    • ARCHITECTURE.md - Architecture système
echo    • FIREBASE_CONFIG.md - Configuration Firebase
echo    • FRONTEND_API_GUIDE.md - Guide intégration API
echo    • backend/README.md - Documentation backend
echo.
echo ⚠️  IMPORTANT: Ne commitez jamais backend/.env dans Git!
echo.
pause
