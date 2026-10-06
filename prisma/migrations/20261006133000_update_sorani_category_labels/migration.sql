-- Keep stable category keys/slugs while updating the approved Sorani display labels.
UPDATE "Category"
SET "nameCkb" = CASE "key"
  WHEN 'beauty-barber' THEN 'جوانکاری و سەرتاشین'
  WHEN 'auto-garage' THEN 'خزمەتگوزاری ئۆتۆمبێل'
  WHEN 'construction-crafts' THEN 'بیناسازی و نۆژەنکردنەوە'
  WHEN 'education' THEN 'پەروەردە و فێرکاری'
  WHEN 'real-estate' THEN 'خانووبەرە'
  WHEN 'travel-tickets' THEN 'گەشتیاری و فڕۆکەوانی'
  WHEN 'groceries-markets' THEN 'کەلوپەل و پێداویستی'
  WHEN 'it-phones' THEN 'تەکنەلۆژیا و دیجیتاڵ'
  WHEN 'tax-accounting' THEN 'ژمێریاری و دارایی'
  WHEN 'driving-schools' THEN 'فێرگەی شۆفێری'
  WHEN 'cleaning' THEN 'خزمەتگوزاری پاککردنەوە'
  WHEN 'transport-moving' THEN 'گواستنەوە و لۆجستیک'
  WHEN 'insurance' THEN 'بیمە و دڵنیایی'
  WHEN 'community-associations' THEN 'ڕێکخراو و کۆمەڵگە'
  ELSE "nameCkb"
END
WHERE "key" IN (
  'beauty-barber','auto-garage','construction-crafts','education','real-estate',
  'travel-tickets','groceries-markets','it-phones','tax-accounting','driving-schools',
  'cleaning','transport-moving','insurance','community-associations'
);

-- Defensive cleanup in case an older production database still contains this removed category.
DELETE FROM "Category" WHERE "key" = 'events-weddings';
