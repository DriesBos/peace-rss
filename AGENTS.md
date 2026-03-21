# AGENTS

## Standard workflow

- After each completed task that changes app behavior, styles, build output, or runtime configuration, recompose the app with Docker from the repo root.
- Standard command: `docker compose up -d --build`
- Use `docker compose down` first only when a clean restart is specifically needed or `up -d --build` is not enough.

## Notes

- The local app runs through Docker Compose, and the `frontend` service uses a production Next.js build.
- Host-side file edits do not hot-reload into the running container, so rebuilding is required to verify changes in the app.
