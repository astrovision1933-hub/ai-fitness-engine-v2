import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * <CoachMarkdown /> — small, safe renderer for AI coach replies.
 *
 * The coach returns light Markdown (## headings, **bold**, - bullets,
 * 1. numbered steps, | tables |). Rendering it as plain text showed raw `###`
 * and `**` symbols, so this turns that output into real typography — without
 * `dangerouslySetInnerHTML` and without pulling in a heavy dependency.
 */

type InlineToken = { type: "text" | "bold" | "italic" | "code"; value: string };

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("**") || raw.startsWith("__")) {
      tokens.push({ type: "bold", value: raw.slice(2, -2) });
    } else if (raw.startsWith("`")) {
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: "italic", value: raw.slice(1, -1) });
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
  return tokens;
}

function renderInline(text: string): ReactNode {
  return parseInline(text).map((token, i) => {
    if (token.type === "bold") {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {token.value}
        </strong>
      );
    }
    if (token.type === "italic") {
      return <em key={i}>{token.value}</em>;
    }
    if (token.type === "code") {
      return (
        <code key={i} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.92em]">
          {token.value}
        </code>
      );
    }
    return <Fragment key={i}>{token.value}</Fragment>;
  });
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

export function CoachMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: { ordered: boolean; items: string[] } | null = null;
  let tableRows: string[][] | null = null;
  let paragraph: string[] = [];

  const flushList = () => {
    if (!listItems) return;
    const Tag = listItems.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l-${blocks.length}`}
        className={cn(
          "my-2 space-y-1 pl-5 text-[13px] leading-6 break-words",
          listItems.ordered ? "list-decimal" : "list-disc",
          "marker:text-[#4d7c0f]",
        )}
      >
        {listItems.items.map((item, i) => (
          <li key={i} className="break-words">
            {renderInline(item)}
          </li>
        ))}
      </Tag>,
    );
    listItems = null;
  };

  const flushTable = () => {
    if (!tableRows || tableRows.length === 0) return;
    const [header, ...body] = tableRows;
    blocks.push(
      <div key={`t-${blocks.length}`} className="my-3 w-full overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-border bg-background/60">
              {header.map((cell, i) => (
                <th key={i} className="px-2 py-1.5 font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="border-b border-border/60 last:border-0">
                {row.map((cell, c) => (
                  <td key={c} className="px-2 py-1.5 align-top">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableRows = null;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-1.5 text-[13px] leading-6 break-words">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    // Table rows — a separator row (|---|---|) is skipped.
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      flushList();
      const cells = splitRow(trimmed);
      if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
      tableRows = tableRows ?? [];
      tableRows.push(cells);
      continue;
    }
    flushTable();

    // Headings (# .. ######) — both Markdown and the coach's ALL-CAPS labels.
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const content = heading[2].replace(/[#*]+$/g, "").trim();
      const size =
        level <= 2 ? "text-[15px] font-bold tracking-tight" : "text-[13px] font-bold";
      blocks.push(
        <p key={`h-${blocks.length}`} className={cn("mb-1 mt-3 font-display uppercase tracking-[0.04em] text-foreground first:mt-0", size)}>
          {renderInline(content)}
        </p>,
      );
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-border/70" />);
      continue;
    }

    // Bullets.
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (listItems && listItems.ordered) flushList();
      listItems = listItems ?? { ordered: false, items: [] };
      listItems.items.push(bullet[1]);
      continue;
    }

    // Numbered list ("1. Warm-Up").
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flushParagraph();
      if (listItems && !listItems.ordered) flushList();
      listItems = listItems ?? { ordered: true, items: [] };
      listItems.items.push(numbered[2]);
      continue;
    }

    // Exercise lines like "Exercise 1: Lat Pulldown" get emphasis.
    const exercise = /^(Exercise\s*\d+\s*[:.-])\s*(.*)$/i.exec(trimmed);
    if (exercise) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={`e-${blocks.length}`} className="mt-2 text-[13px] font-semibold break-words">
          <span className="text-[#4d7c0f]">{exercise[1]}</span> {renderInline(exercise[2])}
        </p>,
      );
      continue;
    }

    // Label: value lines ("Sets: 3", "Rest: 90 seconds") stay tight.
    const labelLine = /^([^\s:][^:]{1,24}):\s*(.*)$/.exec(trimmed);
    if (labelLine) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={`kv-${blocks.length}`} className="my-0.5 pl-1 text-[13px] leading-6 break-words">
          <span className="font-medium text-muted-foreground">{labelLine[1]}:</span>{" "}
          {renderInline(labelLine[2])}
        </p>,
      );
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushTable();

  return (
    <div className={cn("w-full min-w-0 max-w-none break-words [overflow-wrap:anywhere]", className)}>
      {blocks}
    </div>
  );
}
