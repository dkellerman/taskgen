import { addTaskVectors } from "@/utils/db";
import { getUser, saveUser } from "@/utils/users";
import type { NextApiRequest, NextApiResponse } from "next";

// POST reply to task
export default async function handlerWithUser(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const { taskUid, type, comment } = req.body;
  const task = user.tasks.find((t) => t.uid === taskUid);

  if (!["accept", "reject", "later"].includes(type) || !task) {
    res.status(400).json({ error: "Content and valid taskUid required" });
    return;
  }

  task.reply = {
    type,
    comment,
    created: new Date().toISOString(),
  };
  await saveUser(user);
  await addTaskVectors([{ userId: user.uid, task }], { update: true });

  res.status(200).json(task.reply);
}
