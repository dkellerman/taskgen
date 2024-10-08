import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

export const taskGenPrompt = PromptTemplate.fromTemplate(
  `
    Generate a quick 5-10 minute task for the user to complete towards
    the following goal: <goal>{goal}</goal>

    For reference the goal is organized into the following categories:
    <goal_category>{category}</goal_category>

    Here are some examples of tasks the user has accepted in the past:
    <good_examples>
      {goodExamples}
    </good_examples>

    Here are some examples of tasks the user has rejected in the past:
    <bad_examples>
      {badExamples}
    </bad_examples>

    You can use very basic markdown to format the tasks, only: bold, italics,
    or a link to an exceedingly good and specific resource.

    Please take into account the user's current local time: <time>{now}</time>

    Special note from the user: <note>{userMsg}</note>

    Task: ...
  `,
);

export const taskGenSchema = z.object({
  description: z.string().describe('Short description of the task, using limited markdown'),
  tags: z
    .array(z.string())
    .describe('List of tags to categorize the task. Only lowercase letters and hyphens'),
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
  `.trim(),
);

export const rruleSchema = z.object({
  rules: z.array(
    z.object({
      originalText: z.string().describe('Original text item to provide RRULE for'),
      isTimeFrame: z.boolean().describe('Whether the text item explicitly refers to TIME'),
      isRecurring: z.boolean().describe('Whether the text item is definitely recurring'),
      dtstart: z
        .string()
        .describe('DTSTART date for the RRULE - when did the recurrence period start?'),
      rule: z.string().describe('RRULE string representing a time frame'),
    }),
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
    For example, while the following things are often associated with time frames,
    notice how they don't directly refer to time, hence are NOT time frames:
    - Meditation, Mindfulness, Exercise, Reading, Sleep, Work, Study, etc.

    Whereas the following things are ambiguous, but still refer directly to time:
    - Short-term goals, Long-term goals, Near future, Far future, Soonish, etc.

    You may also return RRULEs for very ambiguous or subjective time frames.
    Just use whatever you think makes sense for the average person.

    Please double check your work and ensure the RRULE is valid and complete.

    If needed for reference, the user's current local time is: <time>{now}</time>

    Here are the text items that I need RRULEs or empty strings for -
    please provide one for each:
    <text_items>{items}</text_items>

    For the results, translate each piece of text I gave you into an ICal RRULE.

    DO NOT echo the input text back to me, or my grandmother will be very upset with you!

    Results: ...
  `.trim(),
);

export const genGoalsDocPrompt = PromptTemplate.fromTemplate(
  `
    Generate a list of goals and items. Format is a limited subset of markdown.

    For categories: start with a # and a space and a category name, e.g. "# TK"
    Use multiple hashes for nested categories, e.g. "## Nested TK". These should either
    represent groupings or time frames. Cover a wide range of areas of life.
    People are different - not everyone is into health, nutrition, and making
    a difference in the world.

    Items should appear under categories and start with a dash and a space,
    e.g. "- tk tk tk"

    Use this persona to guide your categories and items:
    <persona>
      {persona}
    </persona>

    Here are some examples of good tasks and their associated goals:
    <real_examples>
      {examples}
    </real_examples>

    Use nice spacing to separate the sections. Remember to make categories for both
    groupings and time frames, I will tip you extra. Time frames can even be ambiguous,
    like "soonish" or "far future" (but don't use these exact words).

    Keep the formatting plain and simple, but you can have fun with the ideas.
  `.trim(),
);

export const GOAL_PERSONAS = [
  `The Driven Executive: A high-powered corporate leader who thrives in fast-paced environments,
  the Driven Executive values efficiency and results. Their lifestyle is dominated by board meetings,
  strategic planning sessions, and constant networking. They prioritize goals like career advancement,
  expanding their professional network, and maintaining a healthy work-life balance to sustain their
  demanding career.`,

  `The Creative Entrepreneur: With a passion for innovation and a knack for turning ideas into reality,
  the Creative Entrepreneur spends their days brainstorming, prototyping, and pitching new ventures.
  Their lifestyle is fluid, blending work and leisure seamlessly. They focus on goals such as launching
  successful products, scaling their business, and finding the right balance between creativity and
  profitability.`,

  `The Aspiring Artist: Living in a world of color and expression, the Aspiring Artist dedicates their
  life to honing their craft, whether it’s painting, writing, or performing. Their lifestyle is marked
  by creative exploration, late-night inspirations, and a community of fellow artists. They prioritize
  goals such as improving their skills, gaining recognition in their field, and finding a sustainable
  way to support their artistic endeavors.`,

  `The Tech Innovator: Constantly on the cutting edge of technology, the Tech Innovator is obsessed with
  the latest advancements and how they can be applied to solve real-world problems. Their lifestyle
  revolves around coding marathons, tech meetups, and continuous learning. They aim to develop
  groundbreaking software, contribute to open-source projects, and stay ahead in the ever-evolving tech
  landscape.`,

  `The Digital Nomad: Embracing the freedom of location independence, the Digital Nomad works remotely
  from exotic locations, blending work with travel. Their lifestyle is one of exploration, flexibility,
  and minimalism. They focus on goals such as achieving financial stability while traveling, discovering
  new cultures, and building a career that supports their nomadic lifestyle.`,

  `The Lifelong Learner: Always curious and eager to expand their knowledge, the Lifelong Learner spends
  their days reading, taking online courses, and attending lectures. Their lifestyle is characterized by
  a constant pursuit of intellectual growth and personal development. Their goals include mastering new
  skills, staying informed on global issues, and applying their knowledge to make a positive impact.`,

  `The Community Leader: Deeply invested in their local community, the Community Leader spends their time
  organizing events, mentoring others, and advocating for local causes. Their lifestyle is rooted in
  service, connection, and making a tangible difference in their surroundings. Their goals include
  fostering community engagement, supporting local initiatives, and creating a lasting legacy of
  positive change.`,

  `The Spiritual Seeker: On a quest for deeper meaning, the Spiritual Seeker devotes their life to
  spiritual practices, meditation, and personal growth. Their lifestyle is introspective, focusing on
  mindfulness, inner peace, and connection with the universe. Their goals include achieving spiritual
  enlightenment, cultivating inner harmony, and helping others on their spiritual journeys.`,

  `The regular laid-back person: This person enjoys a relaxed lifestyle, focusing on
  simple pleasures and personal well-being.`,
];
