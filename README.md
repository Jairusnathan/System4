# FE Multi Template Repo Starter

Starter for a multi-app Next.js monorepo that calls the central FE Multi pipeline.

## Includes
- `.github/workflows/master-pipeline-fe-multi.yml`
- Three sample Next.js apps:
  - `System-1-Web`
  - `System-2-Web`
  - `System-3-Web`
- Per-app ESLint, Jest, Docker, TypeScript, and simple UI test
- Root `sonar-project.properties` for multi-app scan

## Require repository variable

`FE_MULTI_SYSTEMS_JSON`

Example:

```json
[
  {
    "name": "System 1",
    "dir": "System-1-Web",
    "image": "system-1-web",
    "vercel_project_secret": "VERCEL_PROJECT_ID_SYSTEM_1"
  },
  {
    "name": "System 2",
    "dir": "System-2-Web",
    "image": "system-2-web",
    "vercel_project_secret": "VERCEL_PROJECT_ID_SYSTEM_2"
  },
  {
    "name": "System 3",
    "dir": "System-3-Web",
    "image": "system-3-web",
    "vercel_project_secret": "VERCEL_PROJECT_ID_SYSTEM_3"
  }
]
```

## Required repository secrets
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- Vercel project ID secrets referenced in `FE_MULTI_SYSTEMS_JSON`
- `SONAR_TOKEN`
- `SONAR_ORGANIZATION`
- `SONAR_PROJECT_KEY`
- `SLACK_WEBHOOK_URL`
- `DISCORD_WEBHOOK_URL`

## Local check

Run per app:

```bash
cd System-1-Web && npm install && npm run lint && npm run test && npm run build
```


test