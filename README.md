# Taskgen app

Type in goals in a pseudo-markdown format. Generate quick tasks via an LLM.

My first RAG app.

https://taskgen.vercel.app

---

## Tech

- NextJS / React / NodeJS server
- Typescript
- Vercel deployment
- Vercel KV store
- Postgresql with PGVector for vector lookups
- Langchain JS -> OpenAI & Groq w/ llama3.1
- Tailwind CSS

## Setup

- `npm i`
- `npm i -g vercel`
- `vercel pull` (for db setup)
  - for prod: `ln -s .vercel/.env.development.local .env.local`
  - otherwise add `.env.local` and set env vars below
- `vercel dev`

## DB management

- `npm run db [create|makevectors|etc...]` - see src/scripts/db.ts

## Env vars

- OPENAI_API_KEY
- GROQ_API_KEY
- KV_URL
- POSTGRES_URL
