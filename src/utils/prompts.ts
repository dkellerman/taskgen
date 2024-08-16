import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

export const taskGenPrompt = PromptTemplate.fromTemplate(
  `
    Generate a quick 5-10 minute task for the user to complete towards
    the following goal:
    <goal>{goal}</goal>

    For reference the goal is organized into the following categories:
    <goal_category>{category}</goal_category>

    You can use very basic markdown to format the tasks, only: bold, italics,
    or a link to an exceedingly good and specific resource.

    Please take into account the user's current local time:
    <time>{now}</time>

    Special note from the user:
    <note>{userMsg}</note>

    Task: ...
  `
);

export const taskGenSchema = z.object({
  description: z
    .string()
    .describe("Short description of the task, using limited markdown"),
  tags: z
    .array(z.string())
    .describe(
      "List of tags to categorize the task. Only lowercase letters and hyphens"
    ),
});

export const chatPrompt = PromptTemplate.fromTemplate(
  `
    You are a friendly and helpful assistant, and you are here to assist the user
    in queries about small tasks they are working on.

    The user's current task is: <task>{task}</task>

    Context:
    <current_goal>{goal}</current_goal>

    <chat_history>
    {history}
    </chat_history>

    Here is the user's message:
    <message>{message}</message>

    Instructions: Reply specifically and succintly to the query, in the context
    of the task at hand. Use markdown for minor formatting only if necessary -
    bold, italics, and links.

    Focus on action, and keep your responses brief.

    Your response: ...
  `.trim()
);

export const rruleSchema = z.object({
  rules: z.array(
    z
      .string()
      .describe("RRULE string representing a time frame for one text item")
  ),
});

// select all items from goals doc that are actionable right now
export const rrulePrompt = PromptTemplate.fromTemplate(
  `
    I have some text that may represent a time frame, either recurring or not.
    Return a string representing the ICal RRULE for this time frame. Assume
    it is not recurring unless specifically indicated (you can return a rule
    with a count of 1 in that case).

    If it is not a timeframe, or you are unsure, then return an empty string.

    You can also return RRULEs for very ambiguous or subjective time frames,
    such as "far future" or "soonish". Just use whatever you think makes sense
    for the average person.

    Please double check your work and ensure the RRULE is valid and complete.

    If needed for reference, the user's current local time is: <time>{now}</time>

    Here are the text items that I need RRULEs or empty strings for -
    please provide one for each:
    <text_items>{items}</text_items>

    Results: ...
  `.trim()
);
