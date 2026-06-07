# PushupClash — Backend (Go)

REST API for PushupClash. Handles users, workouts, daily challenges, battles,
leaderboards and streaks. Auth via Clerk, data in MongoDB, media in Backblaze B2.

## Run locally

```bash
cp .env.example .env     # fill in secrets
docker compose up -d mongo   # from repo root, or use Mongo Atlas
go mod tidy
go run ./cmd/server
```

Server listens on `:8080` by default.

## Layout

```
cmd/server/main.go        entrypoint, wiring
internal/
  config/      env config loading
  db/          mongo connection + index setup
  auth/        Clerk JWT verification middleware
  storage/     Backblaze B2 (S3) client + presigned uploads
  models/      domain types (User, Workout, Challenge, Battle)
  handlers/    HTTP handlers grouped by resource
  router/      route table
```

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/healthz` | liveness |
| POST | `/v1/users/sync` | upsert the authed user from Clerk profile |
| GET  | `/v1/users/me` | current user profile + stats |
| POST | `/v1/workouts` | submit a completed workout (reps, duration) |
| GET  | `/v1/workouts` | list my workouts |
| GET  | `/v1/challenges/today` | today's daily challenge + my progress |
| POST | `/v1/challenges/today/complete` | mark today's challenge done |
| GET  | `/v1/leaderboard` | global leaderboard (by XP) |
| POST | `/v1/battles` | create a battle (challenge a user) |
| GET  | `/v1/battles` | my active/past battles |
| POST | `/v1/battles/{id}/submit` | submit my rep count for a battle |
| POST | `/v1/media/upload-url` | get a presigned B2 URL to upload a clip/avatar |

All `/v1/*` routes require a `Authorization: Bearer <clerk_session_jwt>` header.

## Notes

- Streaks & XP are recomputed on each workout/challenge completion in
  `internal/handlers/workouts.go` and `internal/gamify`.
- Indexes are created on startup in `internal/db/indexes.go`.
