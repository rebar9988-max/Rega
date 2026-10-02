/** Zod schemas shared by API routes and forms. One source of truth per entity. */
import { z } from "zod";
import { LOCALES } from "@/i18n/locales";

export const idSchema = z.string().min(1).max(64);

export const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "published", "archived", "active", "suspended", "pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(64).optional(),
});

export const translationFields = {
  nameCkb: z.string().trim().max(200).optional(),
  nameKmr: z.string().trim().max(200).optional(),
  nameDe: z.string().trim().max(200).optional(),
  nameAr: z.string().trim().max(200).optional(),
  nameTr: z.string().trim().max(200).optional(),
};

export const localisedTextSchema = {
  description: z.string().trim().max(8000).optional(),
  descriptionCkb: z.string().trim().max(8000).optional(),
  descriptionKmr: z.string().trim().max(8000).optional(),
  descriptionDe: z.string().trim().max(8000).optional(),
  descriptionAr: z.string().trim().max(8000).optional(),
  descriptionTr: z.string().trim().max(8000).optional(),
};

export const businessCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  ...translationFields,
  ...localisedTextSchema,
  slug: z.string().trim().max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  website: z.string().url().max(300).optional().or(z.literal("")),
  logoUrl: z.string().url().max(500).optional(),
  coverUrl: z.string().url().max(500).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  verified: z.boolean().default(false),
  featured: z.boolean().default(false),
  tags: z.array(z.string().trim().max(50)).max(30).default([]),
});

export const businessUpdateSchema = businessCreateSchema.partial();

export const locationCreateSchema = z.object({
  businessId: idSchema,
  label: z.string().trim().max(120).optional(),
  addressLine1: z.string().trim().min(3).max(300),
  addressLine2: z.string().trim().max(300).optional(),
  cityId: idSchema.optional().nullable(),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().length(2).transform((v) => v.toUpperCase()),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  openingHours: z.record(z.string(), z.string()).optional(),
  isPrimary: z.boolean().default(false),
  status: z.enum(["active", "archived"]).default("active"),
});

export const locationUpdateSchema = locationCreateSchema.partial().omit({ businessId: true });

export const serviceCreateSchema = z.object({
  businessId: idSchema,
  categoryId: idSchema.optional().nullable(),
  name: z.string().trim().min(2).max(200),
  ...translationFields,
  ...localisedTextSchema,
  slug: z.string().trim().max(200).optional(),
  priceFrom: z.coerce.number().min(0).max(9_999_999).optional().nullable(),
  priceTo: z.coerce.number().min(0).max(9_999_999).optional().nullable(),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()).default("EUR"),
  durationMin: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  coverUrl: z.string().url().max(500).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const serviceUpdateSchema = serviceCreateSchema.partial().omit({ businessId: true });

export const categoryCreateSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_.-]+$/, "lowercase letters, digits, dot, dash, underscore"),
  nameCkb: z.string().trim().min(1).max(200),
  nameKmr: z.string().trim().max(200).optional(),
  nameDe: z.string().trim().min(1).max(200),
  nameAr: z.string().trim().max(200).optional(),
  nameTr: z.string().trim().max(200).optional(),
  descriptionCkb: z.string().trim().max(4000).optional(),
  descriptionDe: z.string().trim().max(4000).optional(),
  descriptionAr: z.string().trim().max(4000).optional(),
  parentId: idSchema.optional().nullable(),
  slug: z.string().trim().max(200).optional(),
  iconUrl: z.string().url().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const userCreateSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().min(2).max(200),
  password: z.string().min(10).max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "USER"]).default("USER"),
  phone: z.string().trim().max(50).optional(),
  locale: z.enum(LOCALES).default("ckb"),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "USER"]).optional(),
  status: z.enum(["active", "suspended", "invited"]).optional(),
  phone: z.string().trim().max(50).optional(),
  locale: z.enum(LOCALES).optional(),
});

export const bulkActionSchema = z.object({
  ids: z.array(idSchema).min(1).max(500),
  action: z.enum(["publish", "unpublish", "archive", "restore", "delete"]),
});

export const UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "video/mp4", "video/webm", "application/pdf"] as const;

export const mediaUploadRequestSchema = z.object({
  filename: z.string().min(1).max(300),
  // Allow-list: only formats the site renders. No HTML/SVG/scripts/executables/archives (stored XSS, malware hosting).
  mimeType: z.enum(UPLOAD_MIME_TYPES, { message: "unsupported media type" }),
  sizeBytes: z.coerce.number().int().min(1).max(25 * 1024 * 1024),
  businessId: idSchema.optional(),
  serviceId: idSchema.optional(),
});

export const aiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  locale: z.enum(LOCALES).default("ckb"),
  sessionId: z.string().min(8).max(64),
});
