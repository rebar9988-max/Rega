/** Columns needed by the directory and CMS reads that failed in production. No application records are read. */
export const REQUIRED_CONTENT_COLUMNS: Record<string, readonly string[]> = {
  City: ["id", "countryId", "regionId", "slug", "nameEn", "nameCkb", "nameKmr", "nameDe", "nameFa", "nameAr", "nameTr", "sortOrder", "latitude", "longitude", "isActive", "inDirectory", "createdAt", "updatedAt"],
  Page: ["id", "slug", "status", "sortOrder", "createdAt", "updatedAt"],
  PageTranslation: ["id", "pageId", "locale", "title", "body", "metaDescription"],
  Listing: ["id", "sectionKey", "slug", "status", "verified", "businessId", "createdById", "cityId", "categoryId", "publishedAt", "expiresAt", "searchText", "deletedAt", "createdAt", "updatedAt"],
  ListingTranslation: ["id", "listingId", "locale", "title", "summary", "body"],
};

export function contentColumnsReady(rows: readonly { table_name: string; column_name: string }[]): boolean {
  const found = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  return Object.entries(REQUIRED_CONTENT_COLUMNS).every(([table, columns]) => columns.every((column) => found.has(`${table}.${column}`)));
}
