import { indexGoals } from "@/utils/goals";
import { getUser, saveUser } from "@/utils/users";
import type { NextApiRequest, NextApiResponse } from "next";

// PUT document content
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    res.status(405).end();
    return;
  }

  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const { uid, content } = req.body;
  if (!content || !uid || uid !== user.doc.uid) {
    res.status(400).json({ error: "Content and valid uid required" });
    return;
  }

  user.doc.content = content;
  user.doc.index = indexGoals(content);
  user.doc.updated = new Date().toISOString();
  await saveUser(user);

  res.status(200).json(user.doc);
}
