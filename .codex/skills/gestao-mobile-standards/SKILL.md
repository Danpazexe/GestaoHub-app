---
name: gestao-mobile-standards
description: Use when working on this Gestão Hub mobile app to follow the project's canonical React Native architecture, feature folder structure, Supabase/cache rules, and HTML/PDF document patterns.
---

# Gestão Mobile Standards

Use this skill whenever the task touches architecture, new features, storage, Supabase sync, or document rendering in this repository.

## Core workflow
- Read `docs/architecture.md`, `docs/data-model.md`, and `docs/sync-and-export.md` before changing behavior.
- Prefer `src/features/<domain>` for new work.
- Keep business rules in services or mappers, not in screens.
- Use local cache as fallback, but treat Supabase as the remote system of record when available.
- For printable documents, preserve the approved information structure and generate from normalized data.
- When preserving navigation compatibility, route wrappers may live in `src/features/<domain>/screens`, but new behavior still belongs to the feature domain and not back in `src/screens/*`.

## Mandatory rules
- Do not put raw `AsyncStorage` access in newly created screens when a feature service exists.
- When a document must survive later product edits, persist a snapshot in the case entity.
- When a flow applies an operational stock change, record an idempotency marker such as `inventory_applied_at`.
- Prefer `ScreenLayout` plus the shared header template helpers as the default shell for migrated screens.

## References
- `references/architecture.md`
- `references/storage-and-sync.md`
- `references/document-rendering.md`
