/*
  # Add Stripe Checkout Links to Subscription Plans

  1. Modified Tables
    - `subscription_plans`
      - `stripe_monthly_link` (text, nullable) - Stripe checkout link for monthly billing
      - `stripe_annual_link` (text, nullable) - Stripe checkout link for annual billing
      - `stripe_extra_seat_link` (text, nullable) - Stripe checkout link for additional seats

  2. Data Updates
    - Populates all four plan tiers with their respective Stripe checkout URLs
    - Sets the shared additional seat purchase link

  3. Purpose
    - Enables direct Stripe checkout from landing page and in-app paywall
    - Each plan has separate monthly and annual checkout links
    - All plans share a single additional seat purchase link

  4. Important Notes
    - No data loss - only adding new nullable columns and updating data
    - All four tiers (Lite, Basic, Pro, Corp) get their Stripe links
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'stripe_monthly_link'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN stripe_monthly_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'stripe_annual_link'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN stripe_annual_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'stripe_extra_seat_link'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN stripe_extra_seat_link text;
  END IF;
END $$;

UPDATE subscription_plans SET
  stripe_monthly_link = 'https://buy.stripe.com/7sY5kC9to2Kr1702HXg7e02',
  stripe_annual_link = 'https://buy.stripe.com/6oU8wO8pk0Cj3f8dmBg7e06',
  stripe_extra_seat_link = 'https://buy.stripe.com/cNi7sK9to5WD5ng6Ydg7e01'
WHERE slug = 'lite';

UPDATE subscription_plans SET
  stripe_monthly_link = 'https://buy.stripe.com/14A4gybBw3Ovg1U6Ydg7e03',
  stripe_annual_link = 'https://buy.stripe.com/dRm8wO4945WD6rkcixg7e07',
  stripe_extra_seat_link = 'https://buy.stripe.com/cNi7sK9to5WD5ng6Ydg7e01'
WHERE slug = 'basic';

UPDATE subscription_plans SET
  stripe_monthly_link = 'https://buy.stripe.com/dRm3cubBw0CjbLE82hg7e04',
  stripe_annual_link = 'https://buy.stripe.com/aFa4gyeNI4SzbLE5U9g7e08',
  stripe_extra_seat_link = 'https://buy.stripe.com/cNi7sK9to5WD5ng6Ydg7e01'
WHERE slug = 'pro';

UPDATE subscription_plans SET
  stripe_monthly_link = 'https://buy.stripe.com/3cIfZgbBwacT3f8fuJg7e05',
  stripe_annual_link = 'https://buy.stripe.com/fZu14mgVQ1GneXQ1DTg7e09',
  stripe_extra_seat_link = 'https://buy.stripe.com/cNi7sK9to5WD5ng6Ydg7e01'
WHERE slug = 'corp';
