/*
  # Enable RLS on subscription_plans Table

  1. Security
    - Enable RLS on `subscription_plans` table (was previously unprotected)
    - Add SELECT policy for authenticated users to read plans
    - Plans are read-only reference data; only admins should modify via service role

  2. Important Notes
    - All authenticated users can view available plans (needed for pricing pages)
    - No INSERT/UPDATE/DELETE policies are created; modifications require service role
*/

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subscription plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (true);
