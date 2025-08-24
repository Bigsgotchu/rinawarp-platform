-- Add email preferences to User model
ALTER TABLE "User" ADD COLUMN "emailPreferences" JSONB NOT NULL DEFAULT '{"dailyAnalytics": false, "weeklyAnalytics": false, "monthlyAnalytics": false}';

-- Create analytics report history table
CREATE TABLE "AnalyticsReport" (
    "id" SERIAL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
