/*
  # Link Equipment Inventory to Job Type Categories

  ## Purpose
  Allow equipment items to be associated with job type categories (e.g., "Window Cleaning", "Pressure Washing").
  When a client is tagged with a job type category, equipment linked to that category automatically appears
  on their profile and scheduled jobs.

  ## Changes
  1. Adds `category_id` column to `equipment_inventory`
     - FK to `job_type_categories`, nullable (equipment can exist without a category)
     - ON DELETE SET NULL so deleting a category doesn't delete equipment
  2. Adds index on `category_id` for efficient lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_inventory' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE equipment_inventory
      ADD COLUMN category_id uuid REFERENCES job_type_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipment_inventory_category ON equipment_inventory(category_id);
