import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Travaux Routiers - Authentification',
      version: '1.0.0',
      description: `
API REST pour la gestion des travaux routiers à Antananarivo.

## Fonctionnalités principales

### Module Authentification
- Inscription et connexion (email/password)
- Gestion des sessions avec durée de vie paramétrable
- Blocage automatique après tentatives échouées
- API de déblocage pour les managers

### Types d'utilisateurs
- **Visiteur** (type 1): Accès en lecture seule
- **Utilisateur** (type 2): Peut créer des signalements
- **Manager** (type 3): Accès complet + administration

### Sécurité
- Sessions avec tokens uniques
- Limite de tentatives de connexion (paramétrable, défaut: 3)
- Blocage automatique des comptes
- Durée de session configurable par type d'utilisateur
      `,
      contact: {
        name: 'Support API',
        email: 'support@travaux.mg'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Serveur de développement'
      },
      {
        url: 'http://api:3001',
        description: 'Serveur Docker'
      },
       {
        url: 'http://192.168.88.228:3001', // ex: 192.168.1.42 ou ton IP publique
        description: 'Accès externe'
  }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token',
          description: 'Token de session obtenu lors de la connexion'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nom: { type: 'string', example: 'Rakoto' },
            prenom: { type: 'string', example: 'Jean' },
            email: { type: 'string', format: 'email', example: 'jean@email.mg' },
            date_creation: { type: 'string', format: 'date-time' },
            est_bloque: { type: 'boolean', example: false },
            type_user: { type: 'integer', example: 2 }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'manager@.mg' },
            password: { type: 'string', example: 'admin123' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['nom', 'email', 'password'],
          properties: {
            nom: { type: 'string', example: 'Rakoto' },
            prenom: { type: 'string', example: 'Jean' },
            email: { type: 'string', format: 'email', example: 'jean@email.mg' },
            password: { type: 'string', minLength: 6, example: 'motdepasse123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Connexion réussie' },
            user: { $ref: '#/components/schemas/User' },
            session: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'abc123...' },
                expires_at: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Message d\'erreur' },
            code: { type: 'string', example: 'ERROR_CODE' }
          }
        },
        Parameter: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nom: { type: 'string', example: 'Paramètres Utilisateur' },
            limite_tentatives: { type: 'integer', example: 3 },
            duree_session: { type: 'integer', description: 'Durée en secondes', example: 7200 },
            duree_session_minutes: { type: 'integer', example: 120 },
            type_user: { type: 'integer', example: 2 }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token manquant ou invalide',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ForbiddenError: {
          description: 'Accès refusé',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentification',
        description: 'Endpoints pour la connexion, inscription et gestion de session'
      },
      {
        name: 'Administration',
        description: 'Endpoints réservés aux managers pour la gestion des utilisateurs'
      },
      {
        name: 'Firebase',
        description: 'Endpoints pour la synchronisation Firebase'
      }
    ]
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js']
};

const specs = swaggerJsdoc(options) as any;

/**
 * Configure Swagger UI pour l'application Express
 */
export function setupSwagger(app: Express, port: number = 3001): void {
  // Mettre à jour les URLs des serveurs avec le port dynamique
  specs.servers = [
    {
      url: `http://localhost:${port}`,
      description: 'Serveur de développement'
    },
    {
      url: `http://api:${port}`,
      description: 'Serveur Docker'
    }
  ];

  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Travaux Routiers - Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true
    }
  }));

  // Endpoint JSON pour la spec OpenAPI
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📚 Documentation Swagger disponible sur http://localhost:${port}/api/docs`);
}

export default specs;
