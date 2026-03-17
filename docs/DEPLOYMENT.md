# Deployment

## GitHub Actions Deploy

This repo includes a production deploy workflow at `.github/workflows/deploy.yml`.

It triggers on:

- pushes to `main`
- manual runs from the GitHub Actions UI

The workflow SSHes into the server, fetches the pushed commit, checks out that exact SHA, and runs:

```bash
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

The remote commands are implemented in `scripts/deploy.sh`.

## Required GitHub Secrets

Add these repository or environment secrets in GitHub:

- `DEPLOY_HOST`: server hostname or IP
- `DEPLOY_USER`: SSH user
- `DEPLOY_SSH_KEY`: private key content for the deploy user

Optional secrets:

- `DEPLOY_PORT`: SSH port, defaults to `22`
- `DEPLOY_PATH`: repo path on server, defaults to `/opt/peace-rss`
- `DEPLOY_COMPOSE_FILE`: defaults to `docker-compose.prod.yml`
- `DEPLOY_HOST_KEY`: pinned SSH host key entry for `known_hosts`
- `DEPLOY_HEALTHCHECK_URL`: public health endpoint, for example `https://komorebi-reader.com/api/health`

## Server Prerequisites

Before the workflow can succeed, the server needs:

- this repo already cloned at `/opt/peace-rss` or your chosen `DEPLOY_PATH`
- Docker and Docker Compose plugin installed
- a valid production `.env` file in the project root
- the deploy public key added to `~/.ssh/authorized_keys` for `DEPLOY_USER`

## Notes

- The deploy checks out the exact pushed commit, not a floating `git pull`.
- The server checkout will be in detached `HEAD` state after deploy. That is intentional for deterministic releases.
- If you prefer a pinned SSH host key instead of `ssh-keyscan`, set `DEPLOY_HOST_KEY`.
