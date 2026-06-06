# MonomialHH TypeScript Spec Index

This folder contains the TypeScript/Cytoscape extension spec split into smaller files to reduce context cost.

Read in this order for implementation:

1. [Overview and architecture](./01-overview-architecture.md)
2. [Backend data model and API](./02-data-model-api.md)
3. [Implementation stages](./03-implementation-stages.md)
4. [Frontend state architecture](./04-frontend-state.md)
5. [Backend algorithms](./05-backend-algorithms.md)
6. [Frontend UI and workflow](./06-frontend-ui-workflow.md)
7. [Adapter, tests, open questions, non-goals](./07-adapter-testing-open-questions.md)

Important current implementation boundary: Stage 1 only. Preserve original GAPToCyto translation behavior while establishing the Bun/TypeScript scaffold, single-output UI structure, L2R/R2L display switch, relation orientation storage, and maxPathLength control.
