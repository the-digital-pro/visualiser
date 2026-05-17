import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

/**
 * Renders markdown descriptions as a tightly-styled inline block.
 *
 * Security: `react-markdown` ignores raw HTML by default — we don't pass any
 * rehype-raw plugin. Anything in the source that looks like a `<script>` is
 * rendered as literal text. We intentionally support only the GFM subset
 * (headings, lists, links, code, tables) so descriptions stay scannable.
 *
 * Embedded mermaid blocks are not rendered yet (deferred for v2 polish).
 */
export function MarkdownDescription({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "markdown-body text-sm leading-relaxed",
        "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ol]:list-decimal",
        "[&_li]:ml-4",
        "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre>code]:bg-transparent [&_pre>code]:p-0",
        "[&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_table]:my-2 [&_table]:w-full [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:text-left [&_td]:border-b [&_td]:border-border/50 [&_td]:px-2",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
}
