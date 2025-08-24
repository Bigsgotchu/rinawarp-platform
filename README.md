# Rinawarp

A modern, AI-powered terminal that enhances developer productivity.

## Features

- 🤖 AI-powered assistance
- ⚡️ Smart command suggestions
- 🔍 Intelligent code completion
- 🛠 Development workflow automation
- 📊 Performance monitoring
- 🔐 Secure authentication
- 💳 Subscription management
- 📈 Usage analytics

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 13 or higher
- Redis 6 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/rinawarp.git
   cd rinawarp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Initialize the database:
   ```bash
   npm run db:setup
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Development

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run format` - Format code

## Documentation

- [API Documentation](docs/api/README.md)
- [Developer Guide](docs/developer/README.md)
- [Deployment Guide](docs/deployment/README.md)
- [Architecture](docs/architecture/README.md)
- [Monitoring](docs/monitoring/README.md)

## Testing

The project uses Jest for testing. Run tests with:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Deployment

We use GitHub Actions for CI/CD. See our [deployment documentation](docs/deployment/README.md) for detailed information.

### Production Deployment

1. Merge changes to `main` branch
2. GitHub Actions will:
   - Run tests
   - Build assets
   - Deploy to staging
   - Run smoke tests
   - Deploy to production

## Monitoring

We use various tools for monitoring:

- Error tracking via Sentry
- Performance monitoring via OpenTelemetry
- Custom metrics and alerting
- Usage analytics

See [monitoring documentation](docs/monitoring/README.md) for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
