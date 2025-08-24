import { Pool } from 'pg';
import { config } from '../src/main/config';
import { logger } from '../src/main/utils/logger';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

async function setup(): Promise<void> {
  try {
    // Create extensions
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "citext";
    `);

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email CITEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        stripe_customer_id TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id),
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        seats INTEGER,
        trial_end TIMESTAMP WITH TIME ZONE,
        current_period_end TIMESTAMP WITH TIME ZONE,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        stripe_subscription_id TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id),
        token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create user_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id),
        theme TEXT DEFAULT 'light',
        keyboard_shortcuts JSONB DEFAULT '{}',
        terminal_config JSONB DEFAULT '{}',
        notifications_enabled BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create analytics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create command_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS command_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id),
        command TEXT NOT NULL,
        directory TEXT NOT NULL,
        exit_code INTEGER,
        duration INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(type);
      CREATE INDEX IF NOT EXISTS idx_command_history_user_id ON command_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_command_history_command ON command_history USING gin(to_tsvector('english', command));
    `);

    // Create triggers for updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at'
        ) THEN
          CREATE TRIGGER users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at'
        ) THEN
          CREATE TRIGGER subscriptions_updated_at
            BEFORE UPDATE ON subscriptions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'user_preferences_updated_at'
        ) THEN
          CREATE TRIGGER user_preferences_updated_at
            BEFORE UPDATE ON user_preferences
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at();
        END IF;
      END;
      $$;
    `);

    logger.info('Database setup completed successfully');
  } catch (error) {
    logger.error('Failed to setup database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setup().catch(error => {
  logger.error('Database setup failed:', error);
  process.exit(1);
});
