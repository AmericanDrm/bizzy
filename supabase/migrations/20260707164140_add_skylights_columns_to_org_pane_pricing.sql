ALTER TABLE organization_pane_pricing ADD COLUMN IF NOT EXISTS price_per_pane_skylights numeric NULL;
ALTER TABLE organization_pane_pricing ADD COLUMN IF NOT EXISTS exterior_split_percent_skylights integer NULL;
ALTER TABLE organization_pane_pricing ADD COLUMN IF NOT EXISTS interior_split_percent_skylights integer NULL;