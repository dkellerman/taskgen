import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/utils/api";
import { GoalsDoc } from "@/types";

export default function Doc() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    editorRef.current!.innerHTML = formatDocContentAsHTML(user.doc.content);
  }, [user]);

  useEffect(() => {
    if (isEditing) {
      editorRef.current?.focus();
    } else {
      editorRef.current?.blur();
    }
  }, [isEditing]);

  function edit() {
    setIsEditing(true);
  }

  async function save() {
    if (!user || !editorRef.current) return;
    setIsSaving(true);
    try {
      await apiFetch<GoalsDoc>("docs", {
        method: "PUT",
        body: {
          uid: user.doc.uid,
          content: editorRef.current.innerText,
        },
      });
    } catch (e) {
      console.error("Failed saving", e);
      alert("Something went wrong saving the document. Please try again.");
    } finally {
      setIsEditing(false);
      setIsSaving(false);
    }
  }

  function cancel() {
    setIsEditing(false);
    editorRef.current!.innerHTML = formatDocContentAsHTML(user!.doc.content);
  }

  function formatDocContentAsHTML(content: string) {
    return content
      .replace(/^(#+\s.*)/gm, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  return (
    <div className="p-3 md:px-6 md:py-8 h-full flex flex-col gap-4">
      <header className="border-b border-gray-300 pb-2 flex justify-start items-center gap-1">
        <h2 className="text-2xl mr-4 -mt-1">Goals</h2>

        {isEditing ? (
          <>
            <button
              className="small"
              onClick={() => save()}
              disabled={isSaving}
            >
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
        className={`overflow-auto p-2 h-full ${isSaving ? "opacity-50" : ""} ${
          isEditing ? "border-gray-400 border" : ""
        }`}
        ref={editorRef}
        contentEditable={isEditing}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
