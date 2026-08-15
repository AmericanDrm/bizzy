/*
  # Add Pane Details to Client Unit Quantities

  ## Purpose
  Adds a `pane_details` JSONB column to `client_unit_quantities` so that
  window-cleaning (pane-based) job types can store a structured breakdown
  of the client's pane configuration rather than a single flat number.

  ## Changes

  ### Modified Tables
  - `client_unit_quantities`
    - New column: `pane_details` (jsonb, nullable)
      Stores a structured object describing the client's pane layout:
      {
        standard_exterior: number,
        standard_interior: number,
        standard_divisional: number,
        french_exterior: number,
        french_interior: number,
        french_divisional: number,
        storm_exterior: number,
        storm_interior: number
      }
      Any subset of these keys may be present (unset keys are treated as 0).
      The `quantity` column continues to hold the total computed pane count
      for backward compatibility with existing duration/cost calculations.

  ## Notes
  1. Existing rows are unaffected; pane_details will be NULL for any row
     created before this migration (treated as single-value legacy entries).
  2. No RLS changes needed – existing policies already cover this table.
  3. The `quantity` column will be updated by the application whenever
     pane_details is saved, so all downstream calculations continue to work.
*/

ALTER TABLE client_unit_quantities
  ADD COLUMN IF NOT EXISTS pane_details jsonb DEFAULT NULL;
