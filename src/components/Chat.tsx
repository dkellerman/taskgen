import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { marked } from 'marked';
import { Loader } from 'lucide-react';
import { ChatMessage, GenTaskResponse, MessageFrom, Task, TaskReplyType } from '@/types';
import { apiFetch, apiStream } from '@/utils/api';
import { useAuth } from './AuthProvider';
import clsx from 'clsx';

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [curTask, setCurTask] = useState<Task>();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLUListElement>(null);
  const curMessageRef = useRef<HTMLDivElement>(null);
  const replyCommentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    // TODO: this is a super-hack
    if (user.curTask.description !== 'N/A') {
      setCurTask(user.curTask);
      setMessages(user.curTask.chatHistory);
    } else {
      setWelcomeMessage();
    }
  }, [user]);

  function addMessage(from: MessageFrom, message: string) {
    const newMsg: ChatMessage = {
      from,
      message,
      sentAt: new Date().toISOString(),
    };
    flushSync(() => {
      setMessages(prev => [...prev, newMsg]);
    });
    scrollToBottom();
    return newMsg;
  }

  async function sendMessage(message: string) {
    addMessage('user', message);
    setIsWaiting(true);

    let reply: ChatMessage | undefined;
    try {
      await apiStream(
        'chat',
        {
          method: 'POST',
          body: { message },
        },
        {
          async onChunk(chunk: string) {
            if (!reply) {
              reply = addMessage('bot', chunk);
              setIsWaiting(false);
            } else {
              reply.message += chunk;
              curMessageRef.current!.innerText += chunk;
              curMessageRef.current!.innerHTML = await marked.parse(
                (reply.message as string) + '█',
              );
            }
            scrollToBottom();
          },
        },
      );
    } catch (e) {
      console.error('Failed to send message', e);
      addMessage('error', 'Failed to send message');
    } finally {
      curMessageRef.current!.innerHTML = curMessageRef.current!.innerHTML.replace('█', '');
      setIsWaiting(false);
    }
  }

  async function genTask() {
    setCurTask(undefined);
    setMessages([]);
    setIsWaiting(true);

    try {
      const resp = await apiFetch<GenTaskResponse>('tasks', { method: 'POST' });
      console.log('task', resp.task);
      setCurTask(resp.task);
    } catch (e) {
      console.error('Failed to send message', e);
      addMessage('error', 'Failed to send message');
    } finally {
      setIsWaiting(false);
    }
  }

  async function sendReply(type: TaskReplyType) {
    if (!curTask) return;
    setIsWaiting(true);
    try {
      const resp = await apiFetch('replies', {
        method: 'POST',
        body: {
          taskUid: curTask.uid,
          type,
          comment: replyCommentRef.current?.value?.trim(),
        },
      });
      setCurTask({ ...curTask, reply: resp });
    } catch (e) {
      console.error('Failed to send reply', e);
      alert('Failed to send reply');
    } finally {
      setIsWaiting(false);
    }
  }

  function scrollToBottom() {
    messagesRef.current?.scrollTo({
      top: messagesRef.current!.scrollHeight,
      behavior: 'smooth',
    });
  }

  function setWelcomeMessage() {
    setMessages([
      {
        from: 'welcome',
        message: `
          <strong>Welcome to Taskgen!</strong>
          Edit your goals on the left. Generate a task, and chat with me about
          it here. You can accept or reject the tasks, and leave comments so
          they will improve over time.
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
    inputRef.current!.value = '';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e as any);
    }
  }

  function makeTaskDescription(task: Task) {
    return (
      (task.goal ? '#### <u>Goal</u>: ' + task.goal.path.replaceAll('|', ' → ') + '\n\n' : '') +
      '**<u>Task</u>:** ' +
      task.description
    );
  }

  return (
    <div className="chat flex flex-col h-full">
      <header className="flex flex-row justify-center border-b border-gray-300 bg-gray-100 p-2 shadow-md">
        <button className="primary" onClick={() => genTask()} disabled={isWaiting}>
          Generate task
        </button>
      </header>

      <ul ref={messagesRef} className="flex-1 overflow-auto p-4 flex flex-col gap-2">
        {!!curTask && (
          <li key="task" className="task">
            <div
              className="prose"
              dangerouslySetInnerHTML={{
                __html: marked.parse(makeTaskDescription(curTask)),
              }}
            />

            <div
              className={clsx('flex flex-wrap justify-end gap-2 mt-3', {
                'opacity-50': isWaiting,
              })}
            >
              {curTask.reply ? (
                <div title={curTask.reply.comment} className="text-sm mr-6">
                  <strong>Replied:</strong> {curTask.reply.type}
                </div>
              ) : (
                <>
                  <textarea
                    ref={replyCommentRef}
                    className="w-full border border-gray-300 p-1"
                    placeholder="Add a comment..."
                  ></textarea>
                  <button
                    disabled={isWaiting}
                    className="small"
                    onClick={() => sendReply('accept')}
                  >
                    Accept
                  </button>
                  <button
                    disabled={isWaiting}
                    className="small"
                    onClick={() => sendReply('reject')}
                  >
                    Reject
                  </button>
                  <button disabled={isWaiting} className="small" onClick={() => sendReply('later')}>
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
              className="prose custom"
              dangerouslySetInnerHTML={{
                __html: marked.parse(msg.message),
              }}
            />
          </li>
        ))}
        {isWaiting && (
          <li key="waiting" className="waiting">
            <Loader className="animate-spin" />
          </li>
        )}
      </ul>

      <footer className="p-2">
        <form className="flex flex-row gap-0" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="flex-1 border-gray-300 border p-1 border-r-0"
            type="text"
            onKeyDown={handleKeyDown}
          />
          <button className="primary appended">Send</button>
        </form>
      </footer>
    </div>
  );
}
