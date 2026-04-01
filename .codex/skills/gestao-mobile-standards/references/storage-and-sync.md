# Storage And Sync Reference

- Save local first, sync remote second.
- Remote empty responses are valid and must clear stale cache.
- Cache fallback exists for continuity, not for silent divergence.
- Any irreversible stock mutation needs an explicit persisted marker.
- In migrated flows, screens call feature services/storage rather than `AsyncStorage` directly.
