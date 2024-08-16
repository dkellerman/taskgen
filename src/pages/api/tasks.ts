import { v4 as uuid } from "uuid";
import type { NextApiRequest, NextApiResponse } from "next";
import { GenTaskResponse, Task } from "@/types";
import { openAI as llm } from "@/utils/llm";
import { getUser, saveUser } from "@/utils/users";
import { taskGenPrompt, taskGenSchema } from "@/utils/prompts";
import { toZonedTime } from "date-fns-tz";

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

  const task: Task = {
    uid: uuid(),
    description: "",
    chatHistory: [],
    tags: [],
    created: new Date().toISOString(),
    // goal: ...
  };

  const prompt = await taskGenPrompt.format({
    goal: task.goal?.text || user.doc.content,
    now: toZonedTime(new Date(), user.timezone ?? "UTC"),
    userMsg: "N/A",
  });
  console.debug(prompt);

  const response = await llm
    .withStructuredOutput<Partial<Task>>(taskGenSchema, { name: "task" })
    .invoke(prompt);

  if (!response.description?.trim()) {
    res.status(500).json({ error: "Failed to generate task" });
    return;
  }

  task.description = response.description;
  task.tags = response.tags || [];
  user.tasks.push(task);
  await saveUser(user);

  res.status(200).json({ task });
}
