# Document Rendering Reference

- HTML/PDF output uses normalized entities, not ad hoc screen state.
- The native screen and the PDF should share the same sections and labels whenever possible.
- Branding follows Gestão Hub unless a task explicitly asks for another tenant/brand.
- When a document depends on operational history, prefer persisted snapshots over live product joins.
- Canonical templates live in `src/assets/templates/*`; native platform folders should only consume generated artifacts or shared source.
