-- This is an empty migration.

-- 1) Mutual exclusion per row
ALTER TABLE "RoleFormPermission"
ADD CONSTRAINT "role_form_perm_final_xor_confirm"
CHECK (NOT ( "canConfirm" = TRUE AND "canFinalConfirm" = TRUE ));

-- 2) Only one final confirmer per form (partial unique index)
CREATE UNIQUE INDEX "uniq_one_final_per_form"
ON "RoleFormPermission" ("formId")
WHERE "canFinalConfirm" = TRUE;
