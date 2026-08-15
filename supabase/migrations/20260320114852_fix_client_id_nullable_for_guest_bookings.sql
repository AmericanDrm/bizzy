/*
  # Fix client_id nullable for guest bookings

  ## Overview
  Makes `client_id` nullable on `client_work_requests` so that unauthenticated
  guest bookings (which have no existing client record) can be stored.

  ## Changes
  - `client_work_requests.client_id` - DROP NOT NULL constraint
  - Add RLS policy allowing anonymous/public inserts through edge function
    (edge function uses service role, so this is handled server-side)

  ## Notes
  - Guest bookings are inserted via the portal-public-api edge function
    using the service role key, bypassing RLS
  - When a guest request is approved, the admin converts the guest to a
    client and the converted_client_id column is populated
*/

ALTER TABLE client_work_requests ALTER COLUMN client_id DROP NOT NULL;
