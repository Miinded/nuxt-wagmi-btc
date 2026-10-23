# Contributing

Contributions are welcome! This guide will help you get up and running on the project.

## Prerequisites

| Tool    | Version |
| ------- | ------- |
| Node.js | `>= 24` |
| pnpm    | `>= 10` |

> **Tip:** the exact pnpm version is pinned via `packageManager` in `package.json`. Corepack will pick it
> up automatically if enabled (`corepack enable`).

## Getting started

```bash
# 1. Clone the repository
git clone https://github.com/Miinded/nuxt-wagmi-btc.git
cd nuxt-wagmi-btc

# 2. Install dependencies
pnpm install

# 3. Generate the module stub and the Nuxt types of the playground
pnpm dev:prepare

# 4. Run the test suite to verify everything works
pnpm test
```

The `playground/` directory is a Nuxt app wired to the module sources: `pnpm dev` starts it with hot reload.

## Available scripts

| Script               | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `pnpm dev`           | Start the playground with the module sources                          |
| `pnpm dev:prepare`   | Build the module stub and prepare the playground types                |
| `pnpm build`         | Build the module to `dist/` with `@nuxt/module-builder`               |
| `pnpm test`          | Run the test suite (Vitest)                                           |
| `pnpm test:coverage` | Run the tests with a coverage report (thresholds enforced)            |
| `pnpm test:types`    | Type-check the module and the playground with `vue-tsc`               |
| `pnpm lint`          | Lint the sources with ESLint                                          |
| `pnpm format`        | Format all files with Prettier                                        |
| `pnpm format:check`  | Check formatting without writing                                      |
| `pnpm deps:check`    | Enforce the dependency policy (nuxt, vue, vue-router, pinia as peers) |
| `pnpm ci:quality`    | Full CI gate: deps + prepare + lint + types + test:coverage + build   |

## Git hooks

[Husky](https://typicode.github.io/husky/) runs the following hooks automatically:

| Hook         | Action                                               |
| ------------ | ---------------------------------------------------- |
| `pre-commit` | `lint-staged` — formats staged files with Prettier   |
| `commit-msg` | `commitlint` — validates Conventional Commits format |
| `pre-push`   | `deps:check` + `test` — prevents pushing broken code |

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Common prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — adding or updating tests
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — maintenance (deps, CI, tooling)

## Releasing

Versioning and publishing are handled by [Changesets](https://github.com/changesets/changesets).
When you make a user-facing change, add a changeset:

```bash
pnpm changeset
```

On merge to `main`, the Release workflow opens (or updates) a "release" pull request. Merging that PR
publishes the new version to npm.

## Pull request checklist

- [ ] Changes are scoped and focused on a single concern
- [ ] New or updated tests cover the changes
- [ ] `pnpm ci:quality` passes locally
- [ ] Commit messages follow Conventional Commits
- [ ] A [changeset](https://github.com/changesets/changesets) is added if the change affects the public API (`pnpm changeset`)
