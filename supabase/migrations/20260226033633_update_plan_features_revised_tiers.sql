/*
  # Revise Subscription Plan Feature Flags

  ## Summary
  Updates all four subscription plan tiers to match the revised feature set:

  ## Changes

  ### Bizzy Lite
  - REMOVED: expense_tracking (was incorrectly enabled)
  - REMOVED: camera (was incorrectly enabled)
  - REMOVED: notes_checklists (was incorrectly enabled)
  - REMOVED: finances (was incorrectly enabled)
  - KEPT: scheduling, invoicing, job_notes_photos, client_management

  ### Bizzy Basic
  - REMOVED: sms (moved to Pro only)
  - REMOVED: messaging (moved to Pro only)
  - REMOVED: client_portal (moved to Pro only)
  - KEPT: time_clock, recurring_jobs, estimates, receipt_scanning, camera,
           notes_checklists, finances, message templates (notes_checklists covers this)

  ### Bizzy Pro
  - ADDED: client_portal (moved up from Basic)
  - ADDED: sms (moved up from Basic)
  - ADDED: messaging (moved up from Basic)
  - ADDED: automations (new Pro-only feature)
  - KEPT: all existing Pro features (GPS, routes, analytics, mileage, work_orders,
           broadcast_messaging, custom_branding, ai_assist, productivity_reports)

  ### Bizzy Corp
  - Inherits all Pro features; no changes to flags

  ## New Column
  - Adds `automations` boolean to subscription_plans.features JSON for all tiers

  ## Notes
  - SMS/messaging access now requires Pro or above
  - Client portal now requires Pro or above
  - Automations is a new Pro+ feature flag
*/

-- Add automations feature flag to all plans

-- Lite: minimal feature set only
UPDATE subscription_plans SET
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": false,
    "time_clock": false,
    "recurring_jobs": false,
    "estimates": false,
    "receipt_scanning": false,
    "sms": false,
    "messaging": false,
    "client_portal": false,
    "gps_tracking": false,
    "route_optimization": false,
    "analytics": false,
    "mileage_tracking": false,
    "work_orders": false,
    "broadcast_messaging": false,
    "custom_branding": false,
    "ai_assist": false,
    "camera": false,
    "notes_checklists": false,
    "client_management": true,
    "finances": false,
    "productivity_reports": false,
    "multi_location": false,
    "white_label": false,
    "automations": false
  }'::jsonb
WHERE id = 'lite';

-- Basic: adds camera/notes/finances/time clock/recurring/estimates/receipt scanning; NO sms/messaging/portal
UPDATE subscription_plans SET
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": true,
    "recurring_jobs": true,
    "estimates": true,
    "receipt_scanning": true,
    "sms": false,
    "messaging": false,
    "client_portal": false,
    "gps_tracking": false,
    "route_optimization": false,
    "analytics": false,
    "mileage_tracking": false,
    "work_orders": false,
    "broadcast_messaging": false,
    "custom_branding": false,
    "ai_assist": false,
    "camera": true,
    "notes_checklists": true,
    "client_management": true,
    "finances": true,
    "productivity_reports": false,
    "multi_location": false,
    "white_label": false,
    "automations": false
  }'::jsonb
WHERE id = 'basic';

-- Pro: adds GPS/routes/analytics/mileage/work_orders/broadcast/branding/ai + sms/messaging/portal/automations
UPDATE subscription_plans SET
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": true,
    "recurring_jobs": true,
    "estimates": true,
    "receipt_scanning": true,
    "sms": true,
    "messaging": true,
    "client_portal": true,
    "gps_tracking": true,
    "route_optimization": true,
    "analytics": true,
    "mileage_tracking": true,
    "work_orders": true,
    "broadcast_messaging": true,
    "custom_branding": true,
    "ai_assist": true,
    "camera": true,
    "notes_checklists": true,
    "client_management": true,
    "finances": true,
    "productivity_reports": true,
    "multi_location": false,
    "white_label": false,
    "automations": true
  }'::jsonb
WHERE id = 'pro';

-- Corp: all features including multi_location, white_label, automations
UPDATE subscription_plans SET
  features = '{
    "scheduling": true,
    "invoicing": true,
    "job_notes_photos": true,
    "expense_tracking": true,
    "time_clock": true,
    "recurring_jobs": true,
    "estimates": true,
    "receipt_scanning": true,
    "sms": true,
    "messaging": true,
    "client_portal": true,
    "gps_tracking": true,
    "route_optimization": true,
    "analytics": true,
    "mileage_tracking": true,
    "work_orders": true,
    "broadcast_messaging": true,
    "custom_branding": true,
    "ai_assist": true,
    "camera": true,
    "notes_checklists": true,
    "client_management": true,
    "finances": true,
    "productivity_reports": true,
    "multi_location": true,
    "white_label": true,
    "automations": true
  }'::jsonb
WHERE id = 'corp';
