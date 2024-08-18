# Taskgen app

- https://taskgen.vercel.app
- https://vercel.com/xfr/taskgen/settings/git

- `npm i`
- `npm i -g vercel`
- `vercel pull`
- `vercel dev`

## db

- for prod: `ln -s .vercel/.env.development.local .env.local`
- otherwise add `.env.local` and set env vars below
- `npm run db [create|...]`

## env vars:

- OPENAI_API_KEY
- GROQ_API_KEY
- KV_URL
- POSTGRES_URL
