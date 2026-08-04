// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
 
 

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import dark from "react-syntax-highlighter/dist/esm/styles/prism/atom-dark";
import type { Components } from "react-markdown";

export const MarkdownComponentsMap: Partial<Components> = {
  p: (props) => (
    <p className="my-1 whitespace-pre-wrap break-words leading-relaxed">{props.children}</p>
  ),

  a: (props) => (
    <a className="text-primary" target="_blank" rel="noreferrer" {...props}>
      {props.children}
    </a>
  ),

  table: (props) => (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse border border-border">{props.children}</table>
    </div>
  ),

  th: (props) => (
    <th className="min-w-[150px] max-w-[350px] break-all border border-border p-2">
      {props.children}
    </th>
  ),
  td: (props) => (
    <td className="min-w-[150px] max-w-[350px] break-words border border-border p-2">
      {props.children}
    </td>
  ),

  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");

    if (!inline && match) {
      const language = match[1];
      return (
        <div className="relative max-w-full overflow-auto rounded-md bg-gray-900">
          <div className="absolute left-0 top-0 z-10 flex w-full items-center justify-between bg-gray-700 p-2.5 text-xs text-gray-300">
            <span className="text-sm uppercase">{language}</span>
          </div>
          <SyntaxHighlighter
            showLineNumbers
            style={dark}
            customStyle={{
              marginTop: "28px",
              scrollbarColor: "#424242 transparent",
              scrollMargin: "0",
            }}
            language={language}
            PreTag="div"
            {...props}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    );
  },
};
