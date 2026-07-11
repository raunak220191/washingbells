# DEPLOY_NOTES — upgrade_last.md execution (2026-07-11)

## Baseline (recorded before TASK 1)

Verified repo layout (differs from task-file placeholders):

| Surface | Actual path |
|---|---|
| Customer app (Expo Router, JS) | repo root: `app/`, `components/`, `lib/`, `stores/` |
| Store partner app (Expo, JS) | `store/` |
| Rider app (Expo, JS) | `rider/` |
| Super-admin (Next.js 16, TS) | `admin/` |
| Backend (FastAPI + Motor) | `backend/` |

Baseline check results:

| Check | Command | Baseline |
|---|---|---|
| Backend tests | `cd backend && ./venv/bin/python -m pytest tests -q` (needs local stack: mongo + uvicorn :8000) | **46 passed** |
| Backend lint | — | **ruff NOT configured** (no pyproject/ruff.toml, not installed). New/changed backend files will be kept ruff-clean via ad-hoc `ruff check`; adding repo-wide ruff config is out of scope (would force a refactor). |
| Admin typecheck | `cd admin && npx tsc --noEmit` | **clean** |
| Admin lint | `cd admin && npm run lint` | **153 pre-existing problems (137 errors, 16 warnings)** — must not increase |
| Customer/store/rider | — | Plain JavaScript; **no lint/typecheck/test tooling exists**. Fallback: `node --check` syntax pass on every changed file + Metro bundle sanity. |

Backend tests are live-stack integration tests (see `backend/tests/conftest.py`) against seeded data (`scripts/seed_dummy_data.py`).

## BLOCKERS

(none yet)

## Deviations / fallbacks used

(recorded per task below)
