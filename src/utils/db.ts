import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createClient } from "@vercel/postgres";
import { kv } from "@vercel/kv";
import { Goal, Task } from "@/types";
import { countTokens, openAIEmbedding as model } from "./llm";

const client = createClient({
  connectionString: process.env.POSTGRES_URL_NON_POOLING,
});

export async function createDatabase(): Promise<void> {
  await client.connect();
  try {
    await client.sql`
      BEGIN;
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS user_tasks (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        task JSONB NOT NULL,
        embedding vector(1536) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON user_tasks USING GIN (task);
      COMMIT;
    `;

    // not enough data for this yet:
    /* await client.sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_tasks_embedding
        ON user_tasks USING ivfflat (embedding);
    `; */

    console.log("Database schema created successfully");
  } catch (error) {
    console.error("Error creating database schema:", error);
    throw error;
  } finally {
    await client.end();
  }
}

export async function addTasks(
  tasks: { userId: string; task: Task }[],
  truncate = false
) {
  const docs: Document[] = tasks.map((r) => ({
    pageContent: `
      <goal>
        ${r.task.goal?.text ?? "N/A"}
      </goal>
      <task>
        ${r.task.description}
        ${r.task.tags.map((t) => `#${t}`).join(" ")}
      </task>
      <user_reply_comment>
        ${r.task.reply?.comment ?? "N/A"}
      </user_reply_comment>
    `,
    metadata: {},
  }));

  const tokenCt = await countTokens(docs.map((d) => d.pageContent).join(""));
  console.log("token count:", tokenCt);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 8192,
    chunkOverlap: 0, // try to keep each doc intact
  });
  const chunks = await splitter.splitDocuments(docs);
  console.log("chunks:", chunks.length, chunks);

  const embeddings = await model.embedDocuments(
    chunks.map((c) => c.pageContent)
  );

  const rows = tasks.map((task, index) => ({
    userId: task.userId,
    task: JSON.stringify({
      ...task.task,
      chatHistory: [], // don't store chat history
    }),
    embedding: JSON.stringify(embeddings[index]),
  }));
  const values = rows.flatMap((row) => [row.userId, row.task, row.embedding]);
  const placeholders = rows
    .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}::vector)`)
    .join(", ");

  // probably should do this is in a temporary table to avoid blocking
  try {
    await client.connect();
    await client.query("BEGIN");
    if (truncate) await client.query("TRUNCATE TABLE user_tasks");
    await client.query(
      `INSERT INTO user_tasks (user_id, task, embedding) VALUES ${placeholders}`,
      values
    );
    await client.query("COMMIT");
  } finally {
    await client.end();
  }
}

export async function findSimilarTasksForGoal(
  userId: string | null,
  goal: Goal
): Promise<Task[]> {
  return findSimilarTasks(userId, goal.text);
}

export async function findSimilarTasks(
  userId: string | null,
  query: string,
  limit = 5
): Promise<Task[]> {
  const queryEmbedding = JSON.stringify(
    (await model.embedDocuments([query]))[0]
  );
  try {
    await client.connect();
    const result = await client.query<Task>(
      `
      SELECT task, 1 - (embedding <=> $1)
        AS similarity FROM user_tasks
        WHERE ($2 = 'all' OR user_id = $2)
        ORDER BY similarity DESC LIMIT $3;
    `,
      [queryEmbedding, userId, limit]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function getKVData(pattern: string) {
  const keys = await kv.keys(pattern);
  const data = {} as any;
  for (const key of keys) {
    data[key] = await kv.get(key);
  }
  return data;
}
