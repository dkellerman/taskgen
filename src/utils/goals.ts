import { marked, Token, Tokens } from "marked";
import { Goal, User } from "@/types";
import { countTokens, openAI as llm } from "./llm";
import { rrulePrompt } from "./prompts";
import { toZonedTime } from "date-fns-tz";

export function indexGoals(markdown: string): Record<string, Goal> {
  const tokens = marked.lexer(markdown);
  const index: Record<string, Goal> = {};
  let currentPath: string[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      currentPath = currentPath.slice(0, token.depth - 1);
      currentPath.push(token.text);
      const path = currentPath.join("|");
      index[path] = {
        path,
        text: token.text,
        categoryDepth: token.depth,
        created: new Date().toISOString(),
      };
    } else if (token.type === "list") {
      parseList(
        currentPath.join("|"),
        token as Tokens.List,
        index,
        currentPath.length
      );
    }
  }

  return index;
}

function parseList(
  curPath: string,
  listToken: Tokens.List,
  index: Record<string, Goal>,
  categoryDepth: number,
  listDepth = 1
) {
  for (const listItem of listToken.items) {
    const text = listItem.text.split("\n")[0].trim();
    const path = [curPath, text].filter(Boolean).join("|");
    index[path] = {
      path,
      text,
      categoryDepth,
      listDepth,
      created: new Date().toISOString(),
    };

    if (listItem.tokens) {
      const sublist = listItem.tokens.find(
        (token: Token) => token.type === "list"
      );
      if (sublist) {
        parseList(
          path,
          sublist as Tokens.List,
          index,
          categoryDepth,
          listDepth + 1
        );
      }
    }
  }
}

export function chooseGoal(goals: Record<string, Goal>): Goal | null {
  // filter goals that are not done and not categories
  const eligibleGoals = Object.values(goals).filter(
    (g) => !g.doneAt && !!g.listDepth
  );
  if (eligibleGoals.length === 0) return null;

  // pick a random goal sometimes
  if (Math.random() > 0.7) {
    console.debug("random goal");
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

export async function getRRules(user: User, texts: string[]): Promise<string> {
  const items = texts.map((text) => `<text>${text}</text>`).join("\n");
  const prompt = await rrulePrompt.format({
    items,
    now: toZonedTime(new Date(), user.timezone ?? "UTC"),
  });
  console.debug(prompt, countTokens(prompt));

  const response = await llm.invoke(prompt);
  console.debug("rrule resp", response);
  return response.content as string;
}

export const EXAMPLE_GOALS_DOC =
  `
This is your goals document. You can use “#” to make a category and “-”
for an item. Categories can be groupings (e.g. “# Health”), or time frames
(e.g. “# Daily”). You can also nest categories by using multiple “#”s
(e.g. “## Later this year”).

You can use some [markdown](https://www.markdownguide.org/basic-syntax/)
to style things. (Not well-tested yet)

Here is an example - click “Randomize my life” above to generate a random one!
`
    .split("\n\n")
    .map((l) => l.replace(/\n/g, " "))
    .join("\n\n")
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
