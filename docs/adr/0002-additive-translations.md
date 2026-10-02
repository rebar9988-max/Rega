# ADR 0002 — Translations are added, not migrated

Status: accepted · 2026-10-02

## Context
Records store texts in suffixed columns (`nameCkb`, `nameDe`, …) for the seven launch locales. Rewriting them into a
translation table would be a risky data migration on production for no user benefit.

## Decision
Legacy columns stay authoritative for `ckb, kmr, de, en, ar, fa, tr`. New `*Translation` tables (Category, City, Country,
Region, Business, Page, Listing) carry every other language and the newer entities. Reads go through `localize()` /
`pickTranslation()` with the fallback chain of the locale config; a text shown in another language is marked with its own
`lang`/`dir`.

## Consequences
Adding a language needs no change to existing rows. Two places hold texts for the launch locales (legacy columns and, for
newer entities, translation rows); the code that reads them is centralised so callers do not care.
