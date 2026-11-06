const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const json = (schema, description) => ({
  description,
  content: {
    'application/json': {
      schema,
    },
  },
});

const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Record Over Rhetoric API',
    version: '1.0.0',
    description:
      'Compare two candidates for the same office using only their recorded roll-call votes on bills. Public visitors can browse offices, candidates, and vote histories. Verified users can run and save AI-assisted comparisons.',
    contact: {
      name: 'Record Over Rhetoric',
      url: 'https://recordoverrhetoric.app',
    },
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/', description: 'Current host' },
    { url: 'http://localhost:8080', description: 'Local development' },
  ],
  tags: [
    { name: 'Health', description: 'Service health checks.' },
    { name: 'Auth', description: 'Registration, sign-in and account recovery.' },
    { name: 'Offices', description: 'Public offices that candidates run for.' },
    { name: 'Candidates', description: 'Public candidate profiles and voting records.' },
    { name: 'Comparisons', description: 'AI-assisted voting-record comparisons (authenticated).' },
    { name: 'Docs', description: 'OpenAPI document and Swagger UI.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Mobile/API clients send the token returned by POST /api/auth/login.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ror_token',
        description: 'The web app uses the httpOnly session cookie set at login.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['message'],
            properties: {
              message: { type: 'string', example: 'Invalid e-mail or password.' },
              details: {
                nullable: true,
                description: 'Optional validation or diagnostic detail.',
                oneOf: [
                  { type: 'object' },
                  { type: 'array', items: { type: 'object' } },
                  { type: 'string' },
                ],
              },
              code: {
                type: 'string',
                nullable: true,
                description: 'Machine-readable error code when one is defined.',
                example: 'EMAIL_NOT_VERIFIED',
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'displayName', 'isVerified'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c10' },
          email: { type: 'string', format: 'email', example: 'voter@example.com' },
          displayName: { type: 'string', example: 'Jordan Voter' },
          isVerified: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time', nullable: true },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Office: {
        type: 'object',
        required: ['id', 'slug', 'name', 'level'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c11' },
          slug: { type: 'string', example: 'us-senate-ga' },
          name: { type: 'string', example: 'U.S. Senate — Georgia' },
          level: {
            type: 'string',
            enum: ['federal', 'state', 'local'],
            example: 'federal',
          },
          state: { type: 'string', nullable: true, example: 'GA' },
          district: { type: 'string', nullable: true, example: null },
          description: { type: 'string', example: 'Sample federal office.' },
        },
      },
      Bill: {
        type: 'object',
        required: ['id', 'number', 'title'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c30' },
          congress: { type: 'integer', example: 119 },
          chamber: { type: 'string', enum: ['house', 'senate'], example: 'house' },
          number: { type: 'string', example: 'H.R. 1234' },
          title: { type: 'string', example: 'Sample Workforce Training Act' },
          summary: {
            type: 'string',
            example: 'Appropriates funds for short-term workforce training grants.',
          },
          topics: {
            type: 'array',
            items: { type: 'string' },
            example: ['labor', 'education'],
          },
          introducedAt: { type: 'string', format: 'date-time', nullable: true },
          sponsor: { type: 'string', nullable: true, example: 'Rep. Sample' },
          sourceUrl: { type: 'string', nullable: true, example: 'https://example.gov/hr1234' },
          isSample: { type: 'boolean', example: true },
        },
      },
      Vote: {
        type: 'object',
        required: ['id', 'position'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c40' },
          position: {
            type: 'string',
            enum: ['yes', 'no', 'abstain', 'absent'],
            example: 'yes',
          },
          castAt: { type: 'string', format: 'date-time', nullable: true },
          note: { type: 'string', nullable: true, example: '' },
          bill: { $ref: '#/components/schemas/Bill' },
        },
      },
      Race: {
        type: 'object',
        required: ['id', 'slug', 'name', 'electionYear', 'office'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c50' },
          slug: { type: 'string', example: 'ohio-us-senate-2026' },
          name: { type: 'string', example: 'Ohio U.S. Senate 2026' },
          electionYear: { type: 'integer', example: 2026 },
          electionDate: { type: 'string', format: 'date-time', nullable: true },
          office: { $ref: '#/components/schemas/Office' },
          state: { type: 'string', nullable: true, example: 'OH' },
          district: { type: 'string', nullable: true },
          description: { type: 'string' },
          sourceUrl: { type: 'string', nullable: true },
          isSample: { type: 'boolean', example: false },
          candidates: {
            type: 'array',
            items: { $ref: '#/components/schemas/Candidate' },
          },
          missingNominees: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Angie Nixon' },
                party: { type: 'string', example: 'Democratic' },
                reason: { type: 'string' },
              },
            },
          },
          comparable: {
            type: 'boolean',
            description: 'True when two candidates and both vote counts are present.',
            example: true,
          },
        },
      },
      Candidate: {
        type: 'object',
        required: ['id', 'slug', 'name', 'party'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c20' },
          slug: { type: 'string', example: 'alex-rivera' },
          name: { type: 'string', example: 'Alex Rivera' },
          party: { type: 'string', example: 'Independent' },
          state: { type: 'string', nullable: true, example: 'GA' },
          district: { type: 'string', nullable: true, example: null },
          photoUrl: { type: 'string', nullable: true, example: null },
          officialUrl: { type: 'string', nullable: true, description: 'Identification only; never sent to the AI panel.' },
          bio: { type: 'string', nullable: true, description: 'Identification only; never sent to the AI panel.' },
          isSample: { type: 'boolean', example: true },
          office: { $ref: '#/components/schemas/Office' },
          voteCount: { type: 'integer', example: 9 },
          votes: {
            type: 'array',
            items: { $ref: '#/components/schemas/Vote' },
          },
          createdAt: { type: 'string', format: 'date-time', nullable: true },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Analysis: {
        type: 'object',
        description:
          'Structured, citation-constrained interpretation of voting records produced by one model.',
        properties: {
          summary: {
            type: 'string',
            example:
              'The two records diverge most on labor and energy votes, while agreeing on two defense measures.',
          },
          dimensions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string', example: 'Taxes' },
                candidateA: { type: 'string', example: 'Supported H.R. 1234.' },
                candidateB: { type: 'string', example: 'Opposed H.R. 1234.' },
                difference: { type: 'string', example: 'Opposite votes on one tax bill.' },
              },
            },
          },
          candidateA: {
            type: 'object',
            properties: {
              label: { type: 'string', example: 'Alex Rivera' },
              strengths: { type: 'array', items: { type: 'string' } },
              concerns: { type: 'array', items: { type: 'string' } },
            },
          },
          candidateB: {
            type: 'object',
            properties: {
              label: { type: 'string', example: 'Morgan Lee' },
              strengths: { type: 'array', items: { type: 'string' } },
              concerns: { type: 'array', items: { type: 'string' } },
            },
          },
          sharedVotes: {
            type: 'array',
            items: { type: 'string' },
            example: ['H.R. 1234 — both voted yes'],
          },
          notableVotes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bill: { type: 'string', example: 'H.R. 1234' },
                why: { type: 'string', example: 'Rare split on a major labor bill.' },
              },
            },
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            example: 'medium',
          },
          disclaimer: {
            type: 'string',
            example: 'AI interpretation of voting records only; not an endorsement.',
          },
        },
      },
      ModelResult: {
        type: 'object',
        required: ['key', 'ok', 'latencyMs'],
        properties: {
          key: {
            type: 'string',
            enum: ['minimax', 'deepseek', 'grok'],
            example: 'minimax',
          },
          modelId: { type: 'string', example: 'minimax/minimax-m3.1-flash' },
          ok: { type: 'boolean', example: true },
          latencyMs: { type: 'number', example: 1840 },
          analysis: {
            allOf: [{ $ref: '#/components/schemas/Analysis' }],
            nullable: true,
          },
          error: { type: 'string', nullable: true, example: null },
        },
      },
      Comparison: {
        type: 'object',
        required: ['id', 'candidateA', 'candidateB', 'models'],
        properties: {
          id: { type: 'string', example: '6720f2b8c1a4e9f13a2b7c50' },
          createdAt: { type: 'string', format: 'date-time', nullable: true },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
          candidateA: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string', example: 'alex-rivera' },
              name: { type: 'string', example: 'Alex Rivera' },
              party: { type: 'string', example: 'Independent' },
              photoUrl: { type: 'string', nullable: true },
              office: { $ref: '#/components/schemas/Office' },
            },
          },
          candidateB: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string', example: 'morgan-lee' },
              name: { type: 'string', example: 'Morgan Lee' },
              party: { type: 'string', example: 'Civic Union' },
              photoUrl: { type: 'string', nullable: true },
              office: { $ref: '#/components/schemas/Office' },
            },
          },
          office: { $ref: '#/components/schemas/Office' },
          race: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              slug: { type: 'string', example: 'ohio-us-senate-2026' },
              name: { type: 'string', example: 'Ohio U.S. Senate 2026' },
              electionYear: { type: 'integer', example: 2026 },
            },
          },
          votesSnapshot: {
            type: 'object',
            properties: {
              candidateA: { type: 'integer', example: 9 },
              candidateB: { type: 'integer', example: 8 },
            },
          },
          models: {
            type: 'array',
            items: { $ref: '#/components/schemas/ModelResult' },
          },
          billReferences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                number: { type: 'string', example: 'H.R. 9007' },
                citation: {
                  type: 'string',
                  example: 'H.R. 9007 (119th Congress)',
                },
                congress: { type: 'integer', example: 119 },
                title: {
                  type: 'string',
                  example: 'Community Health Clinic Funding Act',
                },
                summary: { type: 'string' },
                sourceUrl: { type: 'string', nullable: true },
                topics: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 7 },
          pages: { type: 'integer', example: 1 },
        },
      },
      Message: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
    },
    responses: {
      BadRequest: errorResponse,
      Unauthorized: {
        description: 'Authentication required or credentials invalid.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Forbidden: errorResponse,
      NotFound: errorResponse,
      Conflict: errorResponse,
      TooManyRequests: errorResponse,
      ServerError: errorResponse,
    },
  },
  security: [],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health',
        operationId: 'getHealth',
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ok' },
                uptime: { type: 'number', example: 123.45 },
                db: { type: 'string', enum: ['connected', 'disconnected'] },
              },
            },
            'Service status',
          ),
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        description:
          'Creates an unverified account and e-mails a verification link. Never reveals whether the e-mail was already registered beyond a generic 409.',
        operationId: 'register',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'displayName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 8,
                    maxLength: 128,
                    description: 'At least one letter and one number.',
                  },
                  displayName: { type: 'string', minLength: 2, maxLength: 80 },
                },
              },
              example: {
                email: 'voter@example.com',
                password: 'CompareVotes!2026',
                displayName: 'Jordan Voter',
              },
            },
          },
        },
        responses: {
          201: json(
            {
              type: 'object',
              properties: {
                message: { type: 'string' },
                user: { $ref: '#/components/schemas/User' },
              },
            },
            'Account created',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
          409: { $ref: '#/components/responses/Conflict' },
          429: { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/auth/verify-email': {
      get: {
        tags: ['Auth'],
        summary: 'Verify an e-mail address',
        operationId: 'verifyEmail',
        parameters: [
          {
            name: 'token',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Raw token from the verification e-mail.',
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                message: { type: 'string' },
                user: { $ref: '#/components/schemas/User' },
              },
            },
            'E-mail verified',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend the verification e-mail',
        operationId: 'resendVerification',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: json(
            { $ref: '#/components/schemas/Message' },
            'Generic acknowledgement (never reveals account existence)',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        description:
          'Sets the httpOnly ror_token cookie and also returns the bearer token for mobile clients. Unverified accounts receive 403 EMAIL_NOT_VERIFIED.',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
              example: {
                email: 'demo@recordoverrhetoric.app',
                password: 'CompareVotes!2026',
              },
            },
          },
        },
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                user: { $ref: '#/components/schemas/User' },
              },
            },
            'Signed in',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: {
            description: 'E-mail address not verified.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    message: 'Please verify your e-mail address before signing in.',
                    code: 'EMAIL_NOT_VERIFIED',
                  },
                },
              },
            },
          },
          429: { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out',
        operationId: 'logout',
        responses: {
          200: json({ $ref: '#/components/schemas/Message' }, 'Cookie cleared'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        operationId: 'getMe',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: json(
            {
              type: 'object',
              properties: { user: { $ref: '#/components/schemas/User' } },
            },
            'Current user',
          ),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        operationId: 'forgotPassword',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: json(
            { $ref: '#/components/schemas/Message' },
            'Generic acknowledgement (never reveals account existence)',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset a password with a token',
        operationId: 'resetPassword',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 8,
                    maxLength: 128,
                    description: 'At least one letter and one number.',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: json({ $ref: '#/components/schemas/Message' }, 'Password updated'),
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/offices': {
      get: {
        tags: ['Offices'],
        summary: 'List offices',
        operationId: 'listOffices',
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                offices: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Office' },
                },
              },
            },
            'Offices sorted by name',
          ),
        },
      },
    },
    '/api/races': {
      get: {
        tags: ['Races'],
        summary: 'List registered races',
        operationId: 'listRaces',
        parameters: [
          {
            name: 'year',
            in: 'query',
            required: false,
            schema: { type: 'integer', example: 2026 },
          },
          {
            name: 'state',
            in: 'query',
            required: false,
            schema: { type: 'string', example: 'OH' },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                races: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Race' },
                },
              },
            },
            'Races with candidates and vote counts',
          ),
        },
      },
    },
    '/api/races/{idOrSlug}': {
      get: {
        tags: ['Races'],
        summary: 'Get a race by id or slug',
        operationId: 'getRace',
        parameters: [
          {
            name: 'idOrSlug',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'ohio-us-senate-2026' },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                race: { $ref: '#/components/schemas/Race' },
              },
            },
            'Race with candidates and vote counts',
          ),
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/candidates': {
      get: {
        tags: ['Candidates'],
        summary: 'List candidates',
        operationId: 'listCandidates',
        parameters: [
          {
            name: 'office',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Office slug.',
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: { type: 'string', maxLength: 100 },
            description: 'Case-insensitive name search.',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                candidates: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Candidate' },
                },
              },
            },
            'Candidate summaries with vote counts',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/candidates/{id}': {
      get: {
        tags: ['Candidates'],
        summary: 'Candidate profile and full voting record',
        operationId: 'getCandidate',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                candidate: { $ref: '#/components/schemas/Candidate' },
              },
            },
            'Candidate with votes, newest first',
          ),
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/candidates/{id}/votes': {
      get: {
        tags: ['Candidates'],
        summary: 'Candidate voting record',
        operationId: 'getCandidateVotes',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                votes: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Vote' },
                },
              },
            },
            'Votes, newest first, with bills populated',
          ),
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/comparisons': {
      get: {
        tags: ['Comparisons'],
        summary: "List the current user's saved comparisons",
        operationId: 'listComparisons',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                comparisons: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Comparison' },
                },
                pagination: { $ref: '#/components/schemas/Pagination' },
              },
            },
            'Compact comparisons owned by the current user',
          ),
          401: { $ref: '#/components/responses/Unauthorized' },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
      post: {
        tags: ['Comparisons'],
        summary: 'Run and save a comparison',
        description:
          'Sends the same citation-constrained voting-record prompt to three models in parallel, saves the resulting analyses, and returns the comparison.',
        operationId: 'createComparison',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['candidateAId', 'candidateBId'],
                properties: {
                  candidateAId: { type: 'string', minLength: 1 },
                  candidateBId: { type: 'string', minLength: 1 },
                  raceId: {
                    type: 'string',
                    description: 'Optional race id or slug. Both candidates must belong to the race.',
                  },
                },
              },
              example: {
                candidateAId: '6720f2b8c1a4e9f13a2b7c20',
                candidateBId: '6720f2b8c1a4e9f13a2b7c21',
                raceId: 'ohio-us-senate-2026',
              },
            },
          },
        },
        responses: {
          201: json(
            {
              type: 'object',
              properties: {
                comparison: { $ref: '#/components/schemas/Comparison' },
              },
            },
            'Comparison created',
          ),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/comparisons/{id}': {
      get: {
        tags: ['Comparisons'],
        summary: 'Get one saved comparison',
        description:
          'Owner-only. Comparisons belonging to another user return 404 to avoid enumeration.',
        operationId: 'getComparison',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: json(
            {
              type: 'object',
              properties: {
                comparison: { $ref: '#/components/schemas/Comparison' },
              },
            },
            'Full comparison with all model analyses',
          ),
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/openapi.json': {
      get: {
        tags: ['Docs'],
        summary: 'OpenAPI 3.0 document',
        operationId: 'getOpenApiDocument',
        responses: {
          200: {
            description: 'OpenAPI document',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/docs': {
      get: {
        tags: ['Docs'],
        summary: 'Swagger UI',
        operationId: 'getDocs',
        responses: {
          200: {
            description: 'Interactive API documentation HTML.',
            content: { 'text/html': { schema: { type: 'string' } } },
          },
        },
      },
    },
  },
};

export default openapiDocument;
