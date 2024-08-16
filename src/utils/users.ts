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
  return user;
}

export async function createUser(token: string) {
  const user: User = {
    uid: token,
    doc: {
      uid: uuid(),
      content: `
      # This year
      - Write a book
      - Start a podcast
      - Learn to play the guitar
      - Learn to cook
      `,
      created: new Date().toISOString(),
    },
    curTask: {
      uid: uuid(),
      description: "N/A",
      chatHistory: [],
      tags: [],
      created: new Date().toISOString(),
    },
    created: new Date().toISOString(),
  };
  await saveUser(user);
  return user;
}

export async function saveUser(user: User) {
  return await kv.set(`user:${user.uid}`, user);
}
