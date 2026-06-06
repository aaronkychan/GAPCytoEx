# Implementation Status

Current implementation boundary: Stage 1 only.

- Preserve original QPA/GAP `<->` Cytoscape translator behavior.
- Establish the new project structure.
- Add orientation state and path conversion helpers.
- Keep monomial-algebra computations staged behind the spec checkpoints.

Useful commands:

```powershell
bun run check
bun run build
bun run dev
```

Specs are split under `spec/`, starting with `spec/MonomialHH-TypeScript-Spec.md`.
