import type { NextApiRequest, NextApiResponse } from "next";
import { indexGoals, updateRRules } from "@/utils/goals";
import { getUser, saveUser } from "@/utils/users";
import { countTokens, openAI as llm } from "@/utils/llm";
import { genGoalsDocPrompt, GOAL_PERSONAS } from "@/utils/prompts";
import { findSimilarTasks } from "@/utils/db";
import { TaskVector, User } from "@/types";

// PUT document content
// POST generate sample goals doc
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (req.method === "POST") {
    genGoals(req, res, user);
    return;
  }

  const { uid, content } = req.body;
  if (!content || !uid || uid !== user.doc.uid) {
    res.status(400).json({ error: "Content and valid uid required" });
    return;
  }

  user.doc.content = content;
  user.doc.index = indexGoals(content);
  await updateRRules(user, user.doc.index);
  user.doc.updated = new Date().toISOString();
  await saveUser(user);

  res.status(200).json(user.doc);
}

async function genGoals(req: NextApiRequest, res: NextApiResponse, user: User) {
  const persona =
    GOAL_PERSONAS[Math.floor(Math.random() * GOAL_PERSONAS.length)];
  console.log("*** persona", persona);

  const examples = (await findSimilarTasks(user.uid, persona, 5))
    .filter((ex) => ex.task.reply?.type === "accept" || ex.similarity >= 0.7)
    .slice(0, 3);

  const prompt = await genGoalsDocPrompt.format({
    persona,
    examples: makeExamplesStr(examples),
  });
  console.debug(prompt, countTokens(prompt));

  const response = await llm.invoke(prompt);
  const content = (response.content as string)?.trim();
  if (!content) {
    res.status(500).json({ error: "Failed to generate goals." });
    return;
  }

  res.status(200).json({ content });
}

function makeExamplesStr(examples: TaskVector[]) {
  return examples.length
    ? examples
        .map((ex) =>
          `
            <example>
              <goal>${ex.task.goal?.path ?? "N/A"}</goal>
              <task>${ex.task.description}</task>
            </example>
          `.trim()
        )
        .join("\n")
    : "N/A";
}
