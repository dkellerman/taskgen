import { marked, Token, Tokens } from 'marked';
import { kv } from '@vercel/kv';
import { Goal, User } from '@/types';
import { isNil } from 'lodash-es';
import { RRule } from 'rrule';
import { countTokens, openAI as llm } from './llm';
import { rrulePrompt, rruleSchema } from './prompts';
import { toZonedTime } from 'date-fns-tz';

export function indexGoals(markdown: string): Record<string, Goal> {
  const tokens = marked.lexer(markdown);
  const index: Record<string, Goal> = {};
  let currentPath: string[] = [];

  for (const token of tokens) {
    if (token.type === 'heading') {
      currentPath = currentPath.slice(0, token.depth - 1);
      currentPath.push(token.text);
      const path = currentPath.join('|');
      index[path] = {
        path,
        text: token.text,
        categoryDepth: token.depth,
        created: new Date().toISOString(),
      };
    } else if (token.type === 'list') {
      parseList(currentPath.join('|'), token as Tokens.List, index, currentPath.length);
    }
  }

  return index;
}

function parseList(
  curPath: string,
  listToken: Tokens.List,
  index: Record<string, Goal>,
  categoryDepth: number,
  listDepth = 1,
) {
  for (const listItem of listToken.items) {
    const text = listItem.text.split('\n')[0].trim();
    const path = [curPath, text].filter(Boolean).join('|');
    index[path] = {
      path,
      text,
      categoryDepth,
      listDepth,
      created: new Date().toISOString(),
    };

    if (listItem.tokens) {
      const sublist = listItem.tokens.find((token: Token) => token.type === 'list');
      if (sublist) {
        parseList(path, sublist as Tokens.List, index, categoryDepth, listDepth + 1);
      }
    }
  }
}

export function chooseGoal(goals: Record<string, Goal>): Goal | null {
  // filter goals that are not done and not categories
  const now = new Date();
  now.setMilliseconds(0);
  console.log('NOW', now);
  const eligibleGoals = Object.values(goals).filter(g => {
    // look up the tree for a containing rrule
    const rrule = getNearestRRule(goals, g.path);
    console.log('=> goal', g.text, 'path ->', g.path, 'nearestRR ->', rrule);
    if (!rrule) return true;
    const rr = RRule.fromString(rrule);
    // no occurences before now, and at least one occurence in the future
    const active = !rr.before(now, false) && !!rr.after(now, false) && !g.doneAt;
    console.debug('\t* before', rr.before(now, false));
    console.debug('\t* after', rr.after(now, false));
    console.debug('\t* is active', g.text, active);
    return active;
  });
  if (eligibleGoals.length === 0) return null;

  // pick a random goal sometimes
  if (Math.random() > 0.7) {
    console.debug('random goal');
    return eligibleGoals[Math.floor(Math.random() * eligibleGoals.length)];
  }

  // otherwise pick the least recently used goal
  eligibleGoals.sort((a, b) => {
    if (!a.lastUsedAt && !b.lastUsedAt) return 0;
    if (!a.lastUsedAt) return -1;
    if (!b.lastUsedAt) return 1;
    return new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
  });
  return eligibleGoals[0];
}

export async function updateRRules(user: User, goals: Record<string, Goal>): Promise<void> {
  const toFetch: Goal[] = [];
  for (const goal of Object.values(goals)) {
    if (goal.rrule || !isNil(goal.listDepth)) continue;

    // check cache
    const key = getRRuleKey(goal.text);
    const cached = await kv.get<string>(key);
    if (cached) {
      goal.rrule = cached;
    } else {
      toFetch.push(goal);
    }
  }

  if (toFetch.length === 0) return;

  // fetch new rrules as a batch
  // TODO: the problem is that this overfetches for duplicated rules within the document,
  // it should really maintain an index (by getRRuleKey) rather than an array
  const rrules = await fetchRRules(
    user,
    toFetch.map(g => g.text),
  );
  for (let i = 0; i < toFetch.length; i++) {
    const goal = toFetch[i];
    if (rrules[i]) {
      // invalid rules are returned as null
      goal.rrule = rrules[i]!.toString();
      await kv.set(getRRuleKey(goal.text), goal.rrule);
    }
  }
}

export async function fetchRRules(user: User, texts: string[]): Promise<Array<RRule | null>> {
  const items = texts.map(text => `<text>${text}</text>`).join('\n');

  const prompt = await rrulePrompt.format({
    items,
    now: toZonedTime(new Date(), user.timezone ?? 'UTC'),
  });
  console.debug(prompt, countTokens(prompt));

  const response = await llm.withStructuredOutput(rruleSchema, { name: 'rules' }).invoke(prompt);
  console.debug('rrule resp', response);

  const rrules: Array<RRule | null> = [];
  for (let i = 0; i < response.rules.length; i++) {
    if (!response.rules[i].rule || !response.rules[i].isTimeFrame) {
      rrules.push(null);
      continue;
    }

    let ruleStr = response.rules[i].rule
      .split(';')
      .map(s => s.replace(/BYYEAR=(\d+)/, 'DTSTART=$1-01-01T00:00:00Z;UNTIL=$1-12-31T23:59:59Z'))
      .join(';');
    if (!ruleStr.includes('DTSTART=')) {
      const dtstart = response.rules[i].dtstart
        ? new Date(response.rules[i].dtstart).toISOString()
        : new Date().toISOString().replace(/T.*$/, 'T00:00:00Z');
      ruleStr += ';DTSTART=' + dtstart;
    }
    const text = texts[i];
    try {
      const rule = RRule.fromString(ruleStr);
      rrules.push(rule);
    } catch (e: any) {
      console.error(`Invalid rrule for ${text}: ${ruleStr} ${e.message}`);
      rrules.push(null);
    }
  }
  return rrules;
}

function getRRuleKey(goalStr: string): string {
  return 'rrule:' + goalStr.toLowerCase().trim().replace(/\s/g, '_');
}

function getNearestRRule(index: Record<string, Goal>, path: string) {
  if (index[path]?.rrule) return index[path].rrule;
  const parents = path.split('|').slice(0, -1);
  if (parents.length === 0) return null;
  return getNearestRRule(index, parents.join('|'));
}

export const EXAMPLE_GOALS_DOC =
  `
This is your goals document. You can use “#” to make a category and “-”
for an item. Categories can be groupings (e.g. “# Health”), or time frames
(e.g. “# Daily”). You can also nest categories by using multiple hashes
(e.g. “## Later this year”). You can use some
[markdown](https://www.markdownguide.org/basic-syntax/) to style things.

Here is an example - click “Randomize my life” above to generate a random one!
`
    .split('\n\n')
    .map(l => l.replace(/\n/g, ' '))
    .join('\n\n')
    .trim() +
  `

# This year
- Write a book
- Build a rocket ship
- Learn to play the tuba
- Learn to cook gourmet meals

# Daily
## Morning
- Meditate 5 minutes
- Exercise
## Evening
- Read a book
`;

export const EXAMPLE_GOALS_INDEX = indexGoals(EXAMPLE_GOALS_DOC);
