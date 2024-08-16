import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { set } from "date-fns";

export default function Doc() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setContent(user.doc.content);
  }, [user]);

  useEffect(() => {
    if (isEditing) {
      editorRef.current?.focus();
    } else {
      editorRef.current?.blur();
    }
  }, [isEditing]);

  function save() {
    setIsEditing(false);
    setContent(editorRef.current!.innerText);
  }

  function cancel() {
    setIsEditing(false);
    editorRef.current!.innerHTML = formatDocContentAsHTML(content);
  }

  function edit() {
    setIsEditing(true);
  }

  function formatDocContentAsHTML(content: string) {
    return content
      .replace(/^(#+\s.*)/gm, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  return (
    <div className="px-6 py-8 h-full flex flex-col gap-4">
      <header className="border-b border-gray-300 pb-2 flex justify-start items-center gap-1">
        <h2 className="text-2xl mr-4">My goals</h2>

        {isEditing ? (
          <>
            <button className="small" onClick={() => save()}>
              Save
            </button>
            <button className="small" onClick={() => cancel()}>
              Cancel
            </button>
          </>
        ) : (
          <button className="small" onClick={() => edit()}>
            Edit
          </button>
        )}
      </header>
      <div
        className="p-2 h-full"
        ref={editorRef}
        contentEditable={isEditing}
        onClick={(e) => e.stopPropagation()}
        dangerouslySetInnerHTML={{
          __html: formatDocContentAsHTML(content),
        }}
      />
    </div>
  );
}
