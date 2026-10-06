-- Keep production category labels aligned with the refined REGA Sorani taxonomy.
-- Stable keys/slugs are intentionally unchanged so links and relationships keep working.

UPDATE "Category" SET "nameCkb" = 'خزمەتگوزاریی یاسایی' WHERE "key" = 'legal';
UPDATE "Category" SET "nameCkb" = 'چێشتخانە و کافێ' WHERE "key" = 'food';
UPDATE "Category" SET "nameCkb" = 'کارگێڕی و بەڵگەنامە' WHERE "key" = 'admin';
UPDATE "Category" SET "nameCkb" = 'سەرتاشخانە و جوانکاری' WHERE "key" = 'beauty-barber';
UPDATE "Category" SET "nameCkb" = 'ئۆتۆمبێل و چاکسازی' WHERE "key" = 'auto-garage';
UPDATE "Category" SET "nameCkb" = 'بیناسازی و پیشەکان' WHERE "key" = 'construction-crafts';
UPDATE "Category" SET "nameCkb" = 'فێرکردن و وانەی تایبەت' WHERE "key" = 'education';
UPDATE "Category" SET "nameCkb" = 'خواروبار و بازاڕ' WHERE "key" = 'groceries-markets';
UPDATE "Category" SET "nameCkb" = 'فێرگەی شۆفێری' WHERE "key" = 'driving-schools';
UPDATE "Category" SET "nameCkb" = 'خزمەتگوزاریی پاککردنەوە' WHERE "key" = 'cleaning';
UPDATE "Category" SET "nameCkb" = 'گواستنەوە و بارگواستنەوە' WHERE "key" = 'transport-moving';
