import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MarkdownComponentsMap } from "./markdown-components-map";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

const JsonCodeBlock = ({ content }: { content: string }) => {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <pre className="my-2 max-h-[400px] min-w-[250px] overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-900">
      {formatted}
    </pre>
  );
};

const JsonSkeletonBlock = ({ content }: { content: string }) => {
  const lineCount = content.split("\n").length;
  const height = Math.min(Math.max(lineCount * 20 + 16, 80), 400);

  return (
    <div
      className="my-2 w-full overflow-hidden rounded-md border border-gray-200 bg-[#F8F9FA] dark:border-gray-700 dark:bg-[#1E1E1E]"
      style={{ height: `${height}px` }}
    >
      <div className="relative h-full overflow-hidden p-2">
        <pre
          className="m-0 whitespace-pre-wrap text-gray-300 opacity-60 dark:text-gray-600"
          style={{
            fontSize: "13px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            lineHeight: "20px",
          }}
        >
          {content}
        </pre>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5"
          style={{
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite linear",
          }}
        />
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

const markdownClassName = cn(
  "prose prose-sm max-w-none dark:prose-invert",
  "prose-headings:my-2 prose-headings:font-semibold",
  "prose-p:my-3 prose-p:leading-relaxed",
  "prose-ol:list-decimal prose-ul:list-disc",
  "prose-pre:bg-transparent prose-pre:p-0",
  "[&>*:first-child]:mt-0",
);

export const MarkdownRenderer = ({ content, className = "" }: MarkdownRendererProps) => {
  const jsonBlockRegex = /:::(json|json-skeleton)\n([\s\S]*?)\n:::/g;

  if (!jsonBlockRegex.test(content)) {
    return (
      <div className={cn(markdownClassName, className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponentsMap}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  jsonBlockRegex.lastIndex = 0;

  while ((match = jsonBlockRegex.exec(content)) !== null) {
    const blockType = match[1];
    const blockContent = match[2];

    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push(
          <ReactMarkdown
            key={`text-${lastIndex}`}
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponentsMap}
          >
            {textBefore}
          </ReactMarkdown>,
        );
      }
    }

    if (blockType === "json-skeleton") {
      parts.push(<JsonSkeletonBlock key={`skeleton-${match.index}`} content={blockContent} />);
    } else {
      parts.push(<JsonCodeBlock key={`json-${match.index}`} content={blockContent} />);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const textAfter = content.slice(lastIndex);
    if (textAfter.trim()) {
      parts.push(
        <ReactMarkdown
          key={`text-${lastIndex}`}
          remarkPlugins={[remarkGfm]}
          components={MarkdownComponentsMap}
        >
          {textAfter}
        </ReactMarkdown>,
      );
    }
  }

  return <div className={cn(markdownClassName, className)}>{parts}</div>;
};
