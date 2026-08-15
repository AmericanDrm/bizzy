/*
  # Migrate existing client addresses into client_addresses table

  ## Problem
  All existing client addresses are stored only on the `clients` table (address, latitude, longitude).
  The `client_addresses` table is empty because inserts were silently failing due to the
  `address_type_check` constraint requiring type to be one of: business, home, billing, shipping,
  job_site, other — but the app code never set this field (it defaulted to empty string '').

  ## Fix
  1. Change the `type` column default from '' to 'home' so new inserts work without specifying type
  2. Migrate all existing client addresses from the clients table into client_addresses
*/

ALTER TABLE client_addresses ALTER COLUMN type SET DEFAULT 'home';

INSERT INTO client_addresses (
  client_id,
  user_id,
  organization_id,
  label,
  address,
  street,
  city,
  state,
  postal_code,
  country,
  latitude,
  longitude,
  is_primary,
  normalized,
  type
)
SELECT
  c.id,
  c.user_id,
  c.organization_id,
  'Primary',
  c.address,
  c.address,
  '',
  '',
  '',
  'United States',
  c.latitude::numeric,
  c.longitude::numeric,
  true,
  (c.latitude IS NOT NULL AND c.longitude IS NOT NULL),
  'home'
FROM clients c
WHERE
  c.address IS NOT NULL
  AND trim(c.address) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM client_addresses ca WHERE ca.client_id = c.id
  );
