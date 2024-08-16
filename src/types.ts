export type MessageFrom = "user" | "bot" | "error" | "welcome";

export interface User {
  uid: string;
  doc: GoalsDoc;
  tasks: Task[];
  curTask: Task;
  timezone?: string;
  created: string;
  updated?: string;
}

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
  reply?: TaskReply;
  created: string;
}

export type TaskReplyType = "accept" | "reject" | "later";
export interface TaskReply {
  type: TaskReplyType;
  comment?: string;
  created: string;
}

export interface GoalsDoc {
  uid: string;
  content: string;
  index: Record<string, Goal>;
  created: string;
  updated?: string;
}

export interface Goal {
  path: string;
  text: string;
  categoryDepth?: number;
  listDepth?: number;
  doneAt?: string;
  lastUsedAt?: string;
  created: string;
}

export type GenTaskResponse = { task: Task } | { error: string };
