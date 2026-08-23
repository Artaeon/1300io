# Contributing to 1300.io

Thank you for your interest in contributing. This document outlines the development workflow, coding standards, and submission process.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Artaeon/1300io.git
cd 1300io

# Install deterministic dependencies
npm ci --workspaces=false
cd server && npm ci && cd ..
cd client && npm ci && cd ..

# Start isolated development infrastructure
./scripts/local-test-db.sh start
./scripts/local-mailhog.sh start

# Follow the local-development section in README.md for migrations,
# seed data, and the two development servers.
```

## Branching Model

- `main` is the production branch. All releases are tagged from `main`.
- Create feature branches from `main`:
  - `feat/description` for new features
  - `fix/description` for bug fixes
  - `chore/description` for maintenance tasks

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow this format:

```
type(scope): short description

Optional longer description.
```

**Types:**
- `feat` -- new feature
- `fix` -- bug fix
- `chore` -- maintenance, dependencies, CI
- `docs` -- documentation only
- `refactor` -- code change that neither fixes a bug nor adds a feature
- `test` -- adding or updating tests

**Scopes** (examples):
- `backend`, `frontend`, `auth`, `inspection`, `pdf`, `infra`, `legal`

**Examples:**
```
feat(inspection): add photo rotation before upload
fix(pdf): prevent empty pages when no defects found
chore(infra): update node base image to 22-alpine
```

## Code Style

- **Backend (`server/`)**: strict TypeScript; run `npm run lint` and `npm run typecheck`
- **Frontend (`client/`)**: ES modules; run `npm run lint`
- Use clear, descriptive variable and function names
- Keep functions focused and short
- No unused imports or variables

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, conventional commits
3. Ensure all tests pass: `npm test` in both `server/` and `client/`
4. Ensure backend linting, type checking, and builds pass
5. Ensure frontend linting and the production build pass
6. Open a pull request against `main`
7. Describe what your PR does, why it is needed, and how it was verified
8. Link any related issues

Pull requests require at least one review before merging.

## Testing

- Write tests for new features and bug fixes
- Backend tests: `cd server && npm test` (Vitest)
- Frontend tests: `cd client && npm test` (Vitest + Testing Library)
- Backend quality gates: `cd server && npm run lint && npm run typecheck && npm run build`
- Frontend quality gates: `cd client && npm run lint && npm run build`
- Dependency review: run `npm audit` at the root and in both packages
- Aim for meaningful coverage of business logic and API endpoints

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)
- Include steps to reproduce for bug reports
- Include expected vs. actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
