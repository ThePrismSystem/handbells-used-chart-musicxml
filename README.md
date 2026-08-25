# handbells-used-chart-musicxml

A new typescript-react project

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `pnpm dev`           | Start Vite dev server          |
| `pnpm build`         | Build for production           |
| `pnpm preview`       | Preview production build       |
| `pnpm lint`          | Run ESLint                     |
| `pnpm lint:fix`      | Run ESLint with auto-fix       |
| `pnpm typecheck`     | Run TypeScript type checking   |
| `pnpm format`        | Check formatting with Prettier |
| `pnpm format:fix`    | Fix formatting with Prettier   |
| `pnpm test`          | Run all tests                  |
| `pnpm test:coverage` | Run tests with coverage        |
| `pnpm test:watch`    | Run tests in watch mode        |

## Pinned dependencies

Two packages are deliberately held below their latest release.

- **`typescript` is pinned `~6.0.3`.** The tilde is load-bearing:
  `typescript-eslint` declares a peer of `>=4.8.4 <6.1.0` and has no newer
  major line, so `^6.0.3` would admit 6.1.0 and break the peer.
- **`@types/node` tracks `.nvmrc`** (Node 24 Active LTS), not its own latest.
  Typing against Node 26 APIs while running Node 24 produces code that compiles
  and then fails at runtime.

`renovate.json` enforces both.

## Contributing

This repository is published for transparency and is not accepting contributions.

## License

Proprietary — see [LICENSE](LICENSE). All rights reserved.
