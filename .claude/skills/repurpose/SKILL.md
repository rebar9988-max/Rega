---
name: repurpose
description: Repurpose existing content into other formats or channels — post, announcement, FAQ, changelog, SEO snippet, other locales. Use for "repurpose", "turn this into", "بیگۆڕە بۆ".
argument-hint: "<source text|file> --to post|faq|changelog|seo|email [--lang ckb|en|ar|sv]"
allowed-tools: Read, Grep, Glob, Write
---
Repurpose `$ARGUMENTS`.

1. Read the source; keep every fact, name and link accurate. Add nothing that is not in the source.
2. Adapt length and structure to the target format (e.g. post ≤ 280 chars, FAQ as Q/A pairs, SEO title ≤ 60 / description ≤ 155 chars).
3. Default language Kurdish Sorani; produce other locales only if requested.
4. Output the new content ready to paste. Write a file only if a path is given. Brand name: REGA24, domain www.rega24.com.
