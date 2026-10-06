-- Remove the disallowed Events & Weddings business-directory category.
-- Existing businesses/services/listings keep their records; their nullable categoryId
-- is set to NULL by the existing foreign-key ON DELETE SET NULL rules.
-- Child categories, if any, are preserved and detached from this parent.

DELETE FROM "Category"
WHERE "key" = 'events-weddings';
