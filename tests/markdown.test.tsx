import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownDescription } from "@/components/common/MarkdownDescription";

describe("MarkdownDescription", () => {
  it("renders GFM markdown (bold, links, code, lists)", () => {
    const source = ["**bold** [link](https://example.com) `code`", "", "- one", "- two"].join("\n");
    const { container } = render(<MarkdownDescription source={source} />);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("strips raw HTML entirely (XSS guard via skipHtml)", () => {
    const { container } = render(
      <MarkdownDescription source={'<script>alert("xss")</script>'} />,
    );
    // With skipHtml the parser drops the whole element including its content
    // — preferable to rendering the script text and risking later mis-handling.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders an onerror'd img literal as nothing", () => {
    const { container } = render(
      <MarkdownDescription
        source={'<img src=x onerror="alert(1)">'}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders tables (GFM)", () => {
    const { container } = render(
      <MarkdownDescription source={"| a | b |\n| - | - |\n| 1 | 2 |"} />,
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll("td")).toHaveLength(2);
  });
});
