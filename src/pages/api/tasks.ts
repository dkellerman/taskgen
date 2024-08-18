import { v4 as uuid } from "uuid";
import type { NextApiRequest, NextApiResponse } from "next";
import { GenTaskResponse, Task, TaskVector } from "@/types";
import { countTokens, openAI as llm } from "@/utils/llm";
import { getUser, saveUser } from "@/utils/users";
import { taskGenPrompt, taskGenSchema } from "@/utils/prompts";
import { toZonedTime } from "date-fns-tz";
import { chooseGoal } from "@/utils/goals";
import { addTaskVectors, findSimilarTasksForGoal } from "@/utils/db";

// POST: generate task
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenTaskResponse>
) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  // pick goal
  const goal = chooseGoal(user.doc.index) ?? undefined;

  // find similar tasks via embeddings
  const examples = goal ? await findSimilarTasksForGoal(user.uid, goal) : [];
  let goodExamples = examples
    .filter((ex) => ex.similarity >= 0.8 || ex.task.reply?.type === "accept")
    .slice(0, 3);
  let badExamples = examples
    .filter((ex) => ex.similarity <= 0.5 || ex.task.reply?.type === "reject")
    .slice(0, 3);

  // generate prompt
  const prompt = await taskGenPrompt.format({
    goal: goal?.text || user.doc.content,
    category: goal?.path.split("|").slice(0, -1).join(" -> ") || "N/A",
    now: toZonedTime(new Date(), user.timezone ?? "UTC"),
    userMsg: req.body?.userMsg ?? "N/A",
    goodExamples: makeExamplesStr(goodExamples, "good"),
    badExamples: makeExamplesStr(badExamples, "bad"),
  });
  console.debug(prompt, countTokens(prompt));

  const response = await llm
    .withStructuredOutput<Partial<Task>>(taskGenSchema, { name: "task" })
    .invoke(prompt);

  if (!response.description?.trim()) {
    res.status(500).json({ error: "Failed to generate task" });
    return;
  }

  // add task
  const task: Task = {
    uid: uuid(),
    description: response.description,
    chatHistory: [],
    tags: response.tags || [],
    created: new Date().toISOString(),
    goal,
  };
  user.tasks.push(task);
  if (goal) goal.lastUsedAt = new Date().toISOString();

  await saveUser(user);
  await addTaskVectors([{ userId: user.uid, task }]);

  res.status(200).json({ task });
}

function makeExamplesStr(examples: TaskVector[], type: "good" | "bad") {
  return examples.length
    ? examples
        .map((ex) =>
          `
            <${type}_example>
              <task>${ex.task.description}</task>
              <comment>${ex.task.reply?.comment ?? "N/A"}</comment>
            </${type}_example>
          `.trim()
        )
        .join("\n")
    : "N/A";
}
