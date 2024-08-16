import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

export default function Doc() {
  const { user } = useAuth();
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!user) return;
    setContent(user.doc.content);
  }, [user]);

  function formatDocContentAsHTML(content: string) {
    return content
      .replace(/^(#+\s.*)/gm, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  return (
    <>
      <div
        className="px-6 py-8"
        contentEditable={true}
        dangerouslySetInnerHTML={{
          __html: formatDocContentAsHTML(content),
        }}
      />
    </>
  );
}
