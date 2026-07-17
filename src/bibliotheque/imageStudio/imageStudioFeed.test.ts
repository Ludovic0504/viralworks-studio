import { describe, expect, it } from "vitest";
import {
  collectFeedImageKeys,
  filterHistoryForVisibleFeedRows,
  type ImageStudioFeedRow,
} from "./imageStudioFeed";
import type { ImageStudioHistoryItem } from "./imageStudioHistory";

function historyItem(
  id: string,
  batchId?: string,
): ImageStudioHistoryItem {
  return {
    id,
    input: "prompt",
    output: `https://example.com/${id}.png`,
    created_at: "2026-01-01T00:00:00Z",
    metadata: batchId ? { batchId } : null,
  };
}

describe("collectFeedImageKeys", () => {
  it("prefers historyId then url", () => {
    const rows: ImageStudioFeedRow[] = [
      {
        id: "batch-1",
        prompt: "a",
        images: [
          { url: "https://example.com/a.png", historyId: "h1" },
          { url: "https://example.com/b.png" },
        ],
      },
    ];
    expect(collectFeedImageKeys(rows)).toEqual([
      "h1",
      "https://example.com/b.png",
    ]);
  });
});

describe("filterHistoryForVisibleFeedRows", () => {
  it("keeps items that belong to visible rows by id or batchId", () => {
    const visibleRows: ImageStudioFeedRow[] = [
      {
        id: "batch-a",
        prompt: "a",
        images: [
          { url: "https://example.com/1.png", historyId: "img-1" },
          { url: "https://example.com/2.png", historyId: "img-2" },
        ],
      },
    ];
    const history = [
      historyItem("img-1", "batch-a"),
      historyItem("img-2", "batch-a"),
      historyItem("img-3", "batch-b"),
      historyItem("img-4"),
    ];

    const filtered = filterHistoryForVisibleFeedRows(history, visibleRows);
    expect(filtered.map((item) => item.id)).toEqual(["img-1", "img-2"]);
  });

  it("returns empty when no visible rows", () => {
    expect(
      filterHistoryForVisibleFeedRows([historyItem("img-1")], []),
    ).toEqual([]);
  });
});
