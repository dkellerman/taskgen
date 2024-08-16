import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { IBM_Plex_Sans } from "next/font/google";
import { marked } from "marked";
import { Loader } from "lucide-react";
import { ChatMessage, GenTaskResponse, Task } from "@/types";
import { apiFetch, apiStream } from "@/utils/api";
import { flushSync } from "react-dom";
import { load } from "langchain/load";

const font = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function Home() {
  const [user, setUser] = useState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [docContent, setDocContent] = useState("");
  const [chatWaiting, setChatWaiting] = useState(false);
  const [curTask, setCurTask] = useState<Task>();
  const messagesRef = useRef<HTMLUListElement>(null);
  const curMessageRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const fetchUser = useCallback(async function fetchUser() {
    try {
      const user = await apiFetch("auth");
      console.log("user", user);
      localStorage.setItem("gu", user.uid);
      setUser(user);
      if (user.curTask.description !== "N/A") {
        setCurTask(user.curTask);
      } else {
        setWelcomeMessage();
      }
      setMessages(user.curTask.chatHistory);
      setDocContent(user.doc.content);
    } catch (e) {
      console.error("Failed to fetch user", e);
    }
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      fetchUser();
    }
  }, [fetchUser]);

  function addMessage(
    from: ChatMessage["from"],
    message: ChatMessage["message"]
  ) {
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
    setChatWaiting(true);

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
              setChatWaiting(false);
            } else {
              reply.message += chunk;
              curMessageRef.current!.innerText += chunk;
              curMessageRef.current!.innerHTML = await marked.parse(
                reply.message as string
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
      setChatWaiting(false);
    }
  }

  async function genTask() {
    setCurTask(undefined);
    setMessages([]);
    setChatWaiting(true);

    try {
      const resp = await apiFetch<GenTaskResponse>("tasks", { method: "POST" });
      console.log("task", resp.task);
      setCurTask(resp.task);
    } catch (e) {
      console.error("Failed to send message", e);
      addMessage("error", "Failed to send message");
    } finally {
      setChatWaiting(false);
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

  function formatDocContentAsHTML(content: string) {
    return (
      content
        .replace(/^(#+\s.*)/gm, "<strong>$1</strong>")
        // .replace(/^\s+-(.*)$/gm, (match) => {
        //   return match.replace(/^\s+/, (spaces) =>
        //     spaces.replace(/\s/g, "&nbsp;")
        //   );
        // })
        .replace(/\n/g, "<br>")
    );
  }

  return (
    <>
      <Head>
        <title>Goals</title>
        <meta name="description" content="Goals v0" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`layout ${font.className}`}>
        <nav>
          <h1>Goals</h1>
        </nav>

        <main>
          <section className="doc">
            <div
              className="content"
              contentEditable={true}
              dangerouslySetInnerHTML={{
                __html: formatDocContentAsHTML(docContent),
              }}
            />
          </section>

          <section className="chat">
            <header>
              <button onClick={() => genTask()}>Generate task</button>
            </header>

            <ul ref={messagesRef}>
              {!!curTask && (
                <li key="task" className="task">
                  <div
                    className="markdown"
                    dangerouslySetInnerHTML={{
                      __html: `<strong>Task:</strong> ${curTask.description}`,
                    }}
                  />
                </li>
              )}
              {messages.map((msg, i) => (
                <li key={i} className={msg.from}>
                  <div
                    ref={i === messages.length - 1 ? curMessageRef : null}
                    className="markdown"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(msg.message),
                    }}
                  />
                </li>
              ))}
              {chatWaiting && (
                <li key="waiting" className="waiting">
                  <Loader className="animate-spin" />
                </li>
              )}
            </ul>

            <footer>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector("input");
                  if (!input?.value?.trim()) return;
                  sendMessage(input.value);
                  input.value = "";
                }}
              >
                <input
                  type="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        form.dispatchEvent(
                          new Event("submit", {
                            cancelable: true,
                            bubbles: true,
                          })
                        );
                      }
                    }
                  }}
                />
                <button>Send</button>
              </form>
            </footer>
          </section>
        </main>
      </div>
    </>
  );
}
