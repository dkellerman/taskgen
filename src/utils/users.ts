import { v4 as uuid } from 'uuid';
import { kv } from '@vercel/kv';
import { User } from '@/types';
import { NextApiRequest } from 'next';
import { EXAMPLE_GOALS_DOC, EXAMPLE_GOALS_INDEX, updateRRules } from './goals';

export async function getUser(req: NextApiRequest): Promise<User | null> {
  const tok = req.headers.authorization;
  if (!tok || !tok.startsWith('Bearer ')) {
    return null;
  }

  const token = tok.slice(7);
  const timezone = req.headers['x-tz'] as string;

  let user = await kv.get<User>(`user:${token}`);
  if (!user) {
    user = await createUser(token, timezone);
  } else {
    if (user.timezone !== timezone) {
      user.timezone = timezone;
      await saveUser(user);
    }
  }
  return { ...user, curTask: user.tasks.slice(-1)[0] };
}

export async function createUser(token: string, timezone?: string) {
  // fixme: hacky
  const curTask = {
    uid: uuid(),
    description: 'N/A',
    chatHistory: [],
    tags: [],
    created: new Date().toISOString(),
  };

  const user: User = {
    uid: token,
    doc: {
      uid: uuid(),
      content: EXAMPLE_GOALS_DOC,
      index: EXAMPLE_GOALS_INDEX,
      created: new Date().toISOString(),
    },
    tasks: [curTask],
    curTask,
    timezone,
    created: new Date().toISOString(),
  };
  await updateRRules(user, user.doc.index);
  await saveUser(user);
  return user;
}

export async function saveUser(user: User) {
  user.updated = new Date().toISOString();
  return await kv.set(`user:${user.uid}`, user);
}
