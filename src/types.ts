export type MessageFrom = "user" | "bot" | "error" | "welcome";

export interface ChatMessage {
  from: MessageFrom;
  message: string;
  sentAt: string;
}

export interface Task {
  uid: string;
  goal?: Goal;
  description: string;
  tags: string[];
  chatHistory: ChatMessage[];
  created: string;
}

export interface User {
  uid: string;
  doc: GoalsDoc;
  curTask: Task;
  created: string;
}

export interface GoalsDoc {
  uid: string;
  content: string;
  created: string;
  updated?: string;
}

export interface GoalCategory {
  uid: string;
  text: string;
  parent?: GoalCategory;
  rrule?: string;
  created: string;
}

export interface Goal {
  uid: string;
  text: string;
  created: string;
}

export type GenTaskResponse = { task: Task } | { error: string };
