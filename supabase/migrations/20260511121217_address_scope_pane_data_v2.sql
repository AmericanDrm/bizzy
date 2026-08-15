/*
  # Address-scope pane quantities and pane-type prices (v2)

  1. Goal
    Move legacy null-address rows in `client_unit_quantities` and
    `client_pane_type_prices` onto each client's primary address so
    every pane row is strictly scoped to an address.

  2. Changes
    - Use DISTINCT ON to select one representative null-address row
      per (client_id, job_type_id) — preferring the most recent
      non-empty breakdown — then copy onto the primary address when
      no address row exists.
    - Delete the now-redundant null-address rows.

  3. Safety
    Existing address-scoped rows are never overwritten.
*/

-- Migrate client_unit_quantities
DO $$
BEGIN
  INSERT INTO client_unit_quantities (
    client_id, job_type_id, quantity, pane_details, address_id, organization_id
  )
  SELECT
    src.client_id,
    src.job_type_id,
    src.quantity,
    src.pane_details,
    primary_addr.id,
    src.organization_id
  FROM (
    SELECT DISTINCT ON (cuq.client_id, cuq.job_type_id)
      cuq.client_id, cuq.job_type_id, cuq.quantity, cuq.pane_details, cuq.organization_id
    FROM client_unit_quantities cuq
    WHERE cuq.address_id IS NULL
      AND EXISTS (SELECT 1 FROM client_addresses ca WHERE ca.client_id = cuq.client_id)
    ORDER BY
      cuq.client_id,
      cuq.job_type_id,
      (cuq.pane_details IS NOT NULL) DESC,
      cuq.quantity DESC,
      cuq.updated_at DESC NULLS LAST
  ) src
  JOIN LATERAL (
    SELECT ca.id
    FROM client_addresses ca
    WHERE ca.client_id = src.client_id
    ORDER BY ca.is_primary DESC NULLS LAST, ca.created_at ASC
    LIMIT 1
  ) primary_addr ON TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM client_unit_quantities existing
    WHERE existing.client_id = src.client_id
      AND existing.job_type_id = src.job_type_id
      AND existing.address_id = primary_addr.id
  );

  DELETE FROM client_unit_quantities cuq
  WHERE cuq.address_id IS NULL
    AND EXISTS (SELECT 1 FROM client_addresses ca WHERE ca.client_id = cuq.client_id);
END $$;

-- Migrate client_pane_type_prices
DO $$
BEGIN
  INSERT INTO client_pane_type_prices (
    client_id, job_type_id, pane_type_key, price_mode, price_per_pane,
    flat_rate_amount, address_id, organization_id
  )
  SELECT
    src.client_id,
    src.job_type_id,
    src.pane_type_key,
    src.price_mode,
    src.price_per_pane,
    src.flat_rate_amount,
    primary_addr.id,
    src.organization_id
  FROM (
    SELECT DISTINCT ON (cptp.client_id, cptp.job_type_id, cptp.pane_type_key)
      cptp.client_id, cptp.job_type_id, cptp.pane_type_key, cptp.price_mode,
      cptp.price_per_pane, cptp.flat_rate_amount, cptp.organization_id
    FROM client_pane_type_prices cptp
    WHERE cptp.address_id IS NULL
      AND EXISTS (SELECT 1 FROM client_addresses ca WHERE ca.client_id = cptp.client_id)
    ORDER BY cptp.client_id, cptp.job_type_id, cptp.pane_type_key, cptp.updated_at DESC NULLS LAST
  ) src
  JOIN LATERAL (
    SELECT ca.id
    FROM client_addresses ca
    WHERE ca.client_id = src.client_id
    ORDER BY ca.is_primary DESC NULLS LAST, ca.created_at ASC
    LIMIT 1
  ) primary_addr ON TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM client_pane_type_prices existing
    WHERE existing.client_id = src.client_id
      AND existing.job_type_id = src.job_type_id
      AND existing.pane_type_key = src.pane_type_key
      AND existing.address_id = primary_addr.id
  );

  DELETE FROM client_pane_type_prices cptp
  WHERE cptp.address_id IS NULL
    AND EXISTS (SELECT 1 FROM client_addresses ca WHERE ca.client_id = cptp.client_id);
END $$;
