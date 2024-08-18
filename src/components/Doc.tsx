import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/utils/api";
import { GoalsDoc } from "@/types";
import { Loader } from "lucide-react";
import { marked } from "marked";

export default function Doc() {
  const { user, setUser } = useAuth();
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
    editorRef.current!.innerText = user!.doc.content;
    setIsEditing(true);
  }

  async function save() {
    if (!user || !editorRef.current) return;
    setIsSaving(true);
    try {
      const newDoc = await apiFetch<GoalsDoc>("docs", {
        method: "PUT",
        body: {
          uid: user.doc.uid,
          content: editorRef.current.innerText,
        },
      });
      editorRef.current!.innerHTML = formatDocContentAsHTML(newDoc.content);
      setUser({ ...user, doc: newDoc });
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
    return marked
      .parse(content, { async: false, gfm: true, breaks: true })
      .replace(/^( +)/gm, (match) => {
        return match.replace(/ /g, "\u00A0");
      });
  }

  async function genGoals() {
    setIsSaving(true);
    try {
      const response = await apiFetch<string>("docs", { method: "POST" });
      editorRef.current!.innerText = response.content;
      setIsEditing(true);
    } catch (e) {
      console.error(e);
      alert("Failed to generate goals. Please try again.");
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="p-3 md:px-6 md:py-8 h-full flex flex-col gap-4">
      <header className="border-b border-gray-300 pb-2 flex justify-start items-center">
        <h2 className="text-2xl mr-8 -mt-1.5">Goals</h2>

        <div
          className={`flex items-center gap-3 w-full ${
            isSaving ? "opacity-50" : ""
          }`}
        >
          {isEditing ? (
            <>
              <button
                className="small"
                onClick={() => save()}
                disabled={isSaving}
              >
                Save
              </button>
              <button
                className="small"
                onClick={() => cancel()}
                disabled={isSaving}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="small"
                onClick={() => edit()}
                disabled={isSaving}
              >
                Edit
              </button>
              <button
                className="small"
                onClick={() => genGoals()}
                disabled={isSaving}
              >
                Randomize my life
              </button>
              <div>
                {isSaving && (
                  <Loader className="animate-spin text-sm" size={20} />
                )}
              </div>
            </>
          )}
        </div>
      </header>
      <div
        className={`prose overflow-auto h-full ${
          isSaving ? "opacity-50" : ""
        } ${isEditing ? "border-gray-400 border p-2" : "p-0"}`}
        ref={editorRef}
        contentEditable={isEditing}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
