import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import {
  db,
  createClient,
  VercelPoolClient,
  VercelClient,
} from "@vercel/postgres";
import { kv } from "@vercel/kv";
import { Goal, Task } from "@/types";
import { countTokens, openAIEmbedding as model } from "./llm";

export let client: VercelClient | VercelPoolClient | null = null;

export async function getClient() {
  if (!client) {
    client = await db.connect();
    console.debug("Database connected (pooled)");
  }
  return client;
}

// for CLI scripts, call this and then close the client after use
export async function useNonPooledClient() {
  client = createClient();
  await client.connect();
  console.debug("Database connected (non-pooled, must close)");
  return client;
}

export async function createVectorDatabase(): Promise<void> {
  const client = await getClient();
  await client.query(`
    BEGIN;
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS user_tasks (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50),
      task_uid VARCHAR(50) NOT NULL,
      task JSONB NOT NULL,
      embedding vector(1536) NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tasks_user_id_task_uid
      ON user_tasks(user_id, task_uid);
    CREATE INDEX IF NOT EXISTS idx_user_tasks_task
      ON user_tasks USING GIN (task);
    COMMIT;
  `);

  // not enough data for this yet:
  /* await client.sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_tasks_embedding
      ON user_tasks USING ivfflat (embedding);
  `; */

  console.info("Database schema created successfully");
}

export async function addTaskVectors(
  tasks: { userId: string; task: Task }[],
  options: { truncate?: boolean; update?: boolean } = {}
) {
  const { truncate = false, update = false } = options;

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
  console.debug("token count:", tokenCt);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 8192,
    chunkOverlap: 0, // try to keep each doc intact
  });
  const chunks = await splitter.splitDocuments(docs);
  // console.debug("chunks:", chunks.length, chunks);

  const embeddings = await model.embedDocuments(
    chunks.map((c) => c.pageContent)
  );
  console.debug("fetched embeddings");

  const rows = tasks.map((task, index) => ({
    userId: task.userId,
    taskUid: task.task.uid,
    task: JSON.stringify({
      ...task.task,
      chatHistory: [], // don't store chat history
    }),
    embedding: JSON.stringify(embeddings[index]),
  }));

  console.debug("adding vectors", options);
  const client = await getClient();
  await client.query("BEGIN");

  if (truncate) {
    await client.query("TRUNCATE TABLE user_tasks");
  }

  if (update) {
    if (truncate) throw new Error("Cannot use update with truncate");
    const values: string[] = [];
    const queryParams: string[] = [];

    rows.forEach((row, index) => {
      const i = index * 4;
      values.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}::vector)`);
      queryParams.push(row.userId, row.taskUid, row.task, row.embedding);
    });

    const query = `
      INSERT INTO user_tasks (user_id, task_uid, task, embedding)
      VALUES ${values.join(", ")}
      ON CONFLICT (task_uid, user_id)
      DO UPDATE SET task = EXCLUDED.task, embedding = EXCLUDED.embedding
    `;

    await client.query(query, queryParams);
  } else {
    const values = rows.flatMap((row) => [
      row.userId,
      row.taskUid,
      row.task,
      row.embedding,
    ]);
    const placeholders = rows
      .map(
        (_, i) =>
          `($${i * 4 + 1}, ` +
          `$${i * 4 + 2}, ` +
          `$${i * 4 + 3}, ` +
          `$${i * 4 + 4}::vector)`
      )
      .join(", ");
    await client.query(
      `INSERT INTO user_tasks (user_id, task_uid, task, embedding) VALUES ${placeholders}`,
      values
    );
  }

  console.debug("committing...");
  await client.query("COMMIT");
}

type TaskVector = { task: Task; similarity: number };

export async function findSimilarTasksForGoal(
  userId: string | null,
  goal: Goal
): Promise<TaskVector[]> {
  return findSimilarTasks(userId, goal.text);
}

export async function findSimilarTasks(
  userId: string | null,
  query: string,
  limit = 5
): Promise<TaskVector[]> {
  const queryEmbedding = JSON.stringify(
    (await model.embedDocuments([query]))[0]
  );
  const client = await getClient();
  const result = await client.sql<TaskVector>`
    SELECT task, 1 - (embedding <=> ${queryEmbedding})
      AS similarity FROM user_tasks
      WHERE (${userId} = 'all' OR user_id = ${userId})
      ORDER BY similarity DESC LIMIT ${limit};
  `;
  return result.rows;
}

export async function getKVData(pattern: string) {
  const keys = await kv.keys(pattern);
  const data = {} as any;
  for (const key of keys) {
    data[key] = await kv.get(key);
  }
  return data;
}
