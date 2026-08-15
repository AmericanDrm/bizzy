/*
  # Fix subscription trigger status value

  The assign_default_subscription_on_org_create trigger was inserting 'trialing'
  but the organization_subscriptions_status_check constraint only allows 'trial'.
  This fixes the function to use the correct value.
*/

CREATE OR REPLACE FUNCTION assign_default_subscription_on_org_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_subscriptions (
    organization_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'lite',
    'trial',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;
