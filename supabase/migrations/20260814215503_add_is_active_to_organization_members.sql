/*
# Add is_active column to organization_members

1. Changes
- Adds `is_active` boolean column to `organization_members` table, defaulting to `true`.
- This allows marking employees as inactive (on a break) without removing them from the organization.
- Inactive members remain in the org but can be filtered out of active lists.

2. Security
- No RLS policy changes needed. Existing policies already scope by organization membership.
- The `is_active` column is readable by any org member and writable by admins/owners/managers
  via the existing update policies on `organization_members`.
*/

ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill: ensure all existing members are active
UPDATE organization_members SET is_active = true WHERE is_active IS NULL;
