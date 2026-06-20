-- Removes the legacy users.plan_type column re-added by connection.js after migration 002
-- moved plan_type into user_billing. Rescues any values written to the wrong column first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'plan_type'
  ) THEN
    -- Rescue upgrades written to the wrong column: copy users.plan_type → user_billing.plan_type
    -- only when users has a non-default value and user_billing is still at 'free'.
    UPDATE user_billing ub
       SET plan_type = u.plan_type
      FROM users u
     WHERE ub.user_id = u.id
       AND u.plan_type IS DISTINCT FROM 'free'
       AND ub.plan_type = 'free';

    ALTER TABLE users DROP COLUMN plan_type;
  END IF;
END $$;
