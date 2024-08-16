import { v4 as uuid } from "uuid";
import { kv } from "@vercel/kv";
import { User } from "@/types";
import { NextApiRequest } from "next";

export async function getUser(req: NextApiRequest): Promise<User | null> {
  const tok = req.headers.authorization;
  if (!tok || !tok.startsWith("Bearer ")) return null;
  const token = tok.slice(7);
  const user = await kv.get<User>(`user:${token}`);
  if (!user) {
    return await createUser(token);
  }
  return { ...user, curTask: user.tasks.slice(-1)[0] };
}

export async function createUser(token: string) {
  // fixme: hacky
  const curTask = {
    uid: uuid(),
    description: "N/A",
    chatHistory: [],
    tags: [],
    created: new Date().toISOString(),
  };

  const user: User = {
    uid: token,
    doc: {
      uid: uuid(),
      content: `
      # This year
      - Write a book
      - Build a rocket ship
      - Learn to play the tuba
      - Learn to cook gourmet meals

      # Daily
      - Meditate 5 minutes
      - Exercise
      `.trim(),
      created: new Date().toISOString(),
    },
    tasks: [curTask],
    curTask,
    created: new Date().toISOString(),
  };
  await saveUser(user);
  return user;
}

export async function saveUser(user: User) {
  user.updated = new Date().toISOString();
  return await kv.set(`user:${user.uid}`, user);
}
