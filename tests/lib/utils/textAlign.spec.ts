import { describe, expect, it } from "vitest";
import { renderDocument } from "../../../src/lib/utils/markdown";
import {
  textAlignment,
  withTextAlign,
} from "../../../src/lib/utils/markdownInline";

describe("text alignment", () => {
  it("reads, swaps and drops the trailing marker", () => {
    expect(textAlignment("Hello {center}").align).toBe("center");
    expect(textAlignment("{center}").align).toBeNull();
    expect(withTextAlign("Hello {center}", "right")).toBe("Hello {right}");
    expect(withTextAlign("Hello {right}", null)).toBe("Hello");
  });

  it("aligns the rendered line and keeps the marker in the DOM text", () => {
    const html = renderDocument("# Title {center}");
    expect(html).toContain("text-align:center");
    expect(html).toContain('<span class="md-mark"> {center}</span>');
  });
});
