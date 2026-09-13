## 2024-05-18 - Missing ARIA labels in icon-only buttons
**Learning:** Found multiple icon-only buttons that were lacking ARIA labels which renders them inaccessible for screen reader users. The codebase frequently uses Lucide React icons for controls.
**Action:** Always verify icon-only interactive elements possess descriptive `aria-label`s or visually hidden text.
