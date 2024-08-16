import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { marked } from "marked";
import { Loader } from "lucide-react";
import {
  ChatMessage,
  GenTaskResponse,
  MessageFrom,
  Task,
  TaskReplyType,
} from "@/types";
import { apiFetch, apiStream } from "@/utils/api";
import { useAuth } from "./AuthProvider";

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [curTask, setCurTask] = useState<Task>();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLUListElement>(null);
  const curMessageRef = useRef<HTMLDivElement>(null);
  const replyCommentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    if (user.curTask.description !== "N/A") {
      setCurTask(user.curTask);
    } else {
      setWelcomeMessage();
    }
    setMessages(user.curTask.chatHistory);
  }, [user]);

  function addMessage(from: MessageFrom, message: string) {
    const newMsg: ChatMessage = {
      from,
      message,
      sentAt: new Date().toISOString(),
    };
    flushSync(() => {
      setMessages((prev) => [...prev, newMsg]);
    });
    scrollToBottom();
    return newMsg;
  }

  async function sendMessage(message: string) {
    addMessage("user", message);
    setWaiting(true);

    let reply: ChatMessage | undefined;
    try {
      await apiStream(
        "chat",
        {
          method: "POST",
          body: { message },
        },
        {
          async onChunk(chunk: string) {
            if (!reply) {
              reply = addMessage("bot", chunk);
              setWaiting(false);
            } else {
              reply.message += chunk;
              curMessageRef.current!.innerText += chunk;
              curMessageRef.current!.innerHTML = await marked.parse(
                (reply.message as string) + "█"
              );
            }
            scrollToBottom();
          },
        }
      );
    } catch (e) {
      console.error("Failed to send message", e);
      addMessage("error", "Failed to send message");
    } finally {
      curMessageRef.current!.innerHTML =
        curMessageRef.current!.innerHTML.replace("█", "");
      setWaiting(false);
    }
  }

  async function genTask() {
    setCurTask(undefined);
    setMessages([]);
    setWaiting(true);

    try {
      const resp = await apiFetch<GenTaskResponse>("tasks", { method: "POST" });
      console.log("task", resp.task);
      setCurTask(resp.task);
    } catch (e) {
      console.error("Failed to send message", e);
      addMessage("error", "Failed to send message");
    } finally {
      setWaiting(false);
    }
  }

  async function sendReply(type: TaskReplyType) {
    if (!curTask) return;
    setWaiting(true);
    try {
      const resp = await apiFetch("replies", {
        method: "POST",
        body: {
          taskUid: curTask.uid,
          type,
          comment: replyCommentRef.current?.value?.trim(),
        },
      });
      setCurTask({ ...curTask, reply: resp });
    } catch (e) {
      console.error("Failed to send reply", e);
      alert("Failed to send reply");
    } finally {
      setWaiting(false);
    }
  }

  function scrollToBottom() {
    messagesRef.current?.scrollTo({
      top: messagesRef.current!.scrollHeight,
      behavior: "smooth",
    });
  }

  function setWelcomeMessage() {
    setMessages([
      {
        from: "welcome",
        message: `
          Welcome to the Goals app! Edit your goals on the left.
          Generate a task, and chat with me about it here.
        `.trim(),
        sentAt: new Date().toISOString(),
      } as ChatMessage,
    ]);
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const input = inputRef.current?.value;
    if (!input?.trim()) return;
    sendMessage(input);
    inputRef.current!.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e as any);
    }
  }

  return (
    <div className="flex flex-col h-full p-4">
      <header className="flex flex-row justify-center border-b border-gray-300 p-2">
        <button className="primary" onClick={() => genTask()}>
          Generate task
        </button>
      </header>

      <ul
        ref={messagesRef}
        className="flex-1 overflow-auto p-2 flex flex-col gap-2"
      >
        {!!curTask && (
          <li key="task" className="task">
            <div
              className="markdown"
              dangerouslySetInnerHTML={{
                __html: `<strong>Task:</strong> ${curTask.description}`,
              }}
            />

            <div className="flex flex-wrap justify-end gap-2 mt-2">
              {curTask.reply ? (
                <div title={curTask.reply.comment} className="text-sm mr-6">
                  <strong>Replied:</strong> {curTask.reply.type}
                </div>
              ) : (
                <>
                  <textarea
                    ref={replyCommentRef}
                    className="w-full border border-gray-300 p-1 text-sm"
                    placeholder="Add a comment..."
                  ></textarea>
                  <button className="small" onClick={() => sendReply("accept")}>
                    Accept
                  </button>
                  <button className="small" onClick={() => sendReply("reject")}>
                    Reject
                  </button>
                  <button className="small" onClick={() => sendReply("later")}>
                    Later
                  </button>
                </>
              )}
            </div>
          </li>
        )}
        {messages.map((msg, i) => (
          <li key={`msg-${i}`} className={`msg-${msg.from}`}>
            <div
              ref={i === messages.length - 1 ? curMessageRef : null}
              className="prose"
              dangerouslySetInnerHTML={{
                __html: marked.parse(msg.message),
              }}
            />
          </li>
        ))}
        {waiting && (
          <li key="waiting" className="waiting">
            <Loader className="animate-spin" />
          </li>
        )}
      </ul>

      <footer className="p-2">
        <form className="flex flex-row gap-1" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="flex-1 border-gray-300 border p-1"
            type="text"
            onKeyDown={handleKeyDown}
          />
          <button className="primary">Send</button>
        </form>
      </footer>
    </div>
  );
}
