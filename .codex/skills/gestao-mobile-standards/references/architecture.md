# Architecture Reference

- New features belong in `src/features/<domain>`.
- Shared UI stays in `src/components`.
- Public route entrypoints belong in `src/features/<domain>/screens`.
- Internal or diagnostic flows may live in `src/internal/*`, but they should not sit in the public product path by default.
- Services encapsulate persistence and side effects.
- Storage helpers encapsulate local cache and keep raw `AsyncStorage` out of migrated screens.
- `ScreenLayout` and shared header template helpers are the default shell for canonical screens.
