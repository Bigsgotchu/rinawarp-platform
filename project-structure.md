src/
  ├── api/                    # API client and related code
  │   ├── client.ts          # Base API client
  │   ├── terminal.ts        # Terminal-specific API client
  │   └── types.ts           # API types
  │
  ├── auth/                  # Authentication code
  │   ├── middleware/        # Auth middleware
  │   │   ├── authenticate.ts
  │   │   └── authorize.ts
  │   ├── services/         # Auth services
  │   │   └── auth.ts
  │   └── types.ts         # Auth types
  │
  ├── services/             # Core services
  │   ├── cache.ts         # Caching service
  │   ├── terminal.ts      # Terminal service
  │   └── usage.ts         # Usage tracking
  │
  ├── config/              # Configuration
  │   ├── index.ts        # Config exports
  │   ├── env.ts          # Environment config
  │   └── constants.ts    # Constants
  │
  ├── utils/              # Utilities
  │   ├── logger.ts
  │   └── errors.ts
  │
  └── types/              # Global types
      └── index.ts

