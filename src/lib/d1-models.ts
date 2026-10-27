import metadata from "./d1-models.json";
export type D1Field = {
  name: string; type: string; kind: string; isList: boolean; isRequired: boolean; isId: boolean; isUpdatedAt: boolean;
  hasDefaultValue: boolean; default?: unknown; relationName?: string; relationFromFields: string[]; relationToFields: string[];
  isDateOnly?: boolean;
};
export type D1Model = { name: string; fields: D1Field[]; primaryKey: { fields: string[] } | null };
export const d1Models = new Map((metadata.models as D1Model[]).map(m => [m.name, m]));
