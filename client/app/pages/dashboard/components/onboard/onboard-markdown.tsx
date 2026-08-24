import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./copy-button";

type GuideCodeBlockProps = {
  language: string;
  code: string;
};

const GuideCodeBlock = ({ language, code }: GuideCodeBlockProps) => (
  <div className="my-3 overflow-hidden rounded-md border border-border-default">
    <div className="flex items-center justify-between gap-2 border-b border-border-default bg-muted px-3 py-1">
      <span className="font-mono text-xs uppercase tracking-wide text-medium-emphasis">
        {language}
      </span>
      <CopyButton text={code} label={`Copy ${language} command`} />
    </div>
    <pre className="overflow-x-auto bg-surface-app p-3">
      <code className="font-mono text-[13px] leading-6 text-high-emphasis">{code}</code>
    </pre>
  </div>
);

/**
 * Markdown styling for the onboarding brief. The shared `MarkdownRenderer` leans
 * on `prose` utilities, but `@tailwindcss/typography` isn't installed here, so a
 * structured document needs its headings, lists and emphasis styled explicitly.
 */
const createGuideComponents = (): Components => ({
  h1: ({ children }) => (
    <h1 className="mb-3 mt-0 text-xl font-bold text-high-emphasis">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-7 border-b border-border-default pb-1.5 text-lg font-semibold text-high-emphasis">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-base font-semibold text-high-emphasis">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-high-emphasis">{children}</h4>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed text-medium-emphasis">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-medium-emphasis">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-medium-emphasis">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-high-emphasis">{children}</strong>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-border-default" />,
  // Fenced blocks arrive as <pre><code class="language-…">; unwrap the <pre> so
  // the block can render its own header row without nesting a div inside it.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const language = /language-(\w+)/.exec(className ?? "")?.[1];
    if (!language) {
      return (
        <code className="break-words rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-high-emphasis">
          {children}
        </code>
      );
    }
    return (
      <GuideCodeBlock language={language} code={String(children).replace(/\n$/, "")} />
    );
  },
});

type OnboardMarkdownProps = {
  markdown: string;
  className?: string;
};

export const OnboardMarkdown = ({ markdown, className }: OnboardMarkdownProps) => (
  <div className={cn("text-sm", className)}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={createGuideComponents()}>
      {markdown}
    </ReactMarkdown>
  </div>
);
