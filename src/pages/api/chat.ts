import { chatPrompt } from "@/utils/prompts";
import { countTokens, openAI as llm } from "@/utils/llm";
import type { NextApiRequest, NextApiResponse } from "next";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { getUser, saveUser } from "@/utils/users";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const { message } = req.body;

  const historyCt = 5;
  const history = user.curTask.chatHistory
    .slice(-historyCt)
    .map((msg) => `<${msg.from}>${msg.message}</${msg.from}>`)
    .join("\n");

  const prompt = await chatPrompt.format({
    task: user.curTask.description,
    goal: user.curTask.goal?.text || "N/A",
    history,
    message,
  });
  console.debug(prompt, countTokens(prompt));

  const stream = await llm.pipe(new HttpResponseOutputParser()).stream(prompt);
  const decoder = new TextDecoder();
  let reply = "";

  for await (const chunk of stream) {
    reply += decoder.decode(chunk, { stream: true });
    res.write(chunk);
  }

  user.curTask.chatHistory.push({ from: "user", message, sentAt: new Date().toISOString() });
  user.curTask.chatHistory.push({ from: "bot", message: reply, sentAt: new Date().toISOString() });
  await saveUser(user);

  res.end();
}
