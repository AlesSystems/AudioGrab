# AudioGrab — Contributing

Thank you for contributing to AudioGrab. Please read this guide before opening a PR.

---

## Branch Naming

Create branches off `main` using the following prefixes:

| Prefix | When to use |
|--------|-------------|
| `feat/` | New feature or capability |
| `fix/` | Bug fix |
| `docs/` | Documentation only changes |
| `chore/` | Tooling, dependencies, CI, refactors with no behaviour change |

Examples: `feat/trim-support`, `fix/temp-file-leak`, `docs/api-bitrate-table`.

---

## Commit Conventions

AudioGrab follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

```
<type>(<optional scope>): <short imperative summary>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`.

Examples:
```
feat(api): add trimStart/trimEnd support to /api/extract
fix(upload): reject files larger than MAX_FILE_SIZE_MB before buffering
docs(setup): add Fly.io deployment instructions
chore(deps): upgrade yt-dlp to 2025.04.30
```

- Use the imperative mood in the summary ("add", not "added" or "adds").
- Keep the summary line under 72 characters.
- Reference issues in the footer: `Closes #42`.
- Commits are authored by the contributor (do not alter `user.name` / `user.email`).

---

## Pull Request Workflow

1. Fork (external contributors) or create a branch (team members) off `main`.
2. Make focused, atomic commits.
3. Open a PR against `main` with a clear title and description:
   - What changed and why.
   - Any relevant issue numbers (`Closes #N`, `Related to #N`).
   - Screenshots or `curl` output for UI/API changes.
4. Ensure all CI checks pass before requesting review.
5. Address review comments with new commits; do not force-push after review starts.
6. A maintainer will squash-merge or merge once approved.

---

## Documentation Update Rule

Every implementation PR **must** update the relevant documentation so that the repo stays accurate. Do not merge code changes without updating docs.

Use the checklist below to identify which files need updating:

| Change type | Files to update |
|-------------|----------------|
| New API field, endpoint, or changed request/response shape | `API.md` |
| New prerequisite, env var, install step, or deployment change | `SETUP.md` |
| New error code or changed HTTP status | `API.md` |
| New architecture decision or major dependency | `CLAUDE.md` (or Architecture doc) |
| Security fix or new threat-model consideration | `SECURITY.md` |
| New feature on the roadmap or completion of a planned item | `ROADMAP.md` |
| Any of the above | Update the top-level `CLAUDE.md` if the change affects onboarding or project overview |

Include documentation changes in the same PR as the implementation — do not defer them to a follow-up.
