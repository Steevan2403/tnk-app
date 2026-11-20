"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { useSubmittedValues } from "@/components/retained-form";
import { textValue } from "@/lib/form-values";

export function RichTextEditor({
  name,
  defaultValue,
  error,
}: {
  name: string;
  defaultValue: string;
  error?: string;
}) {
  const submitted = useSubmittedValues();
  const initial = String(textValue(submitted, name, defaultValue) ?? "");
  const [html, setHtml] = useState(initial);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        id: "case-description",
        "aria-labelledby": "case-description-label",
        class: "min-h-32 px-3 py-2 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
  });

  return (
    <div>
      <p id="case-description-label" className="mb-1 text-sm font-medium">
        Description
      </p>
      <div className="case-editor overflow-hidden rounded-lg border border-line bg-white shadow-sm focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/30">
        <div className="flex flex-wrap gap-1 border-b border-line p-2">
          <EditorButton label="Bold" pressed={editor?.isActive("bold") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} />
          <EditorButton label="Italic" pressed={editor?.isActive("italic") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} />
          <EditorButton label="Underline" pressed={editor?.isActive("underline") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
          <EditorButton label="Bullets" pressed={editor?.isActive("bulletList") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
          <EditorButton label="Numbered" pressed={editor?.isActive("orderedList") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
          <EditorButton label="Link" pressed={editor?.isActive("link") ?? false} disabled={!editor} onClick={() => setLink(editor)} />
        </div>
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={html} />
      {error ? (
        <p id="case-description-error" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EditorButton({
  label,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-sm font-medium disabled:opacity-50 ${pressed ? "bg-brand-navy text-white" : "text-ink hover:bg-page"}`}
    >
      {label}
    </button>
  );
}

function setLink(editor: Editor | null) {
  if (!editor) return;
  const previous = String(editor.getAttributes("link").href ?? "");
  const url = window.prompt("Link address", previous || "https://");
  if (url == null) return;
  if (!url.trim()) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
}
