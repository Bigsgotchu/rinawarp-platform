-- Create necessary indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_subscription_user_id ON "UserSubscription"(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_record_user_id ON "UsageRecord"(user_id);

-- Add necessary constraints
ALTER TABLE "UserSubscription" 
ADD CONSTRAINT IF NOT EXISTS fk_subscription_user 
FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add timestamps to all tables that need them
ALTER TABLE "UsageRecord" 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_status ON "UserSubscription"(status);
CREATE INDEX IF NOT EXISTS idx_usage_record_type ON "UsageRecord"(type);
CREATE INDEX IF NOT EXISTS idx_usage_record_created_at ON "UsageRecord"(created_at);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subscription_user_status ON "UserSubscription"(user_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_record_user_type ON "UsageRecord"(user_id, type);

-- Add database-level validations
ALTER TABLE "User" ADD CONSTRAINT email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE "SubscriptionTier" ADD CONSTRAINT price_check 
CHECK (price IS NULL OR price >= 0);

-- Add audit timestamps to critical tables
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SubscriptionTier" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for timestamp updates
CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_tier_updated_at
    BEFORE UPDATE ON "SubscriptionTier"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
