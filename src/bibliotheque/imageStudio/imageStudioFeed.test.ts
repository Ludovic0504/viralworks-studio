import { describe, expect, it } from "vitest";
import {
  collectFeedImageKeys,
  filterHistoryForVisibleFeedRows,
  getFeedRowVisibility,
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

describe("getFeedRowVisibility", () => {
  it("limits by image count and keeps the newest images", () => {
    const rows: ImageStudioFeedRow[] = [
      {
        id: "old",
        prompt: "old",
        images: [
          { url: "https://example.com/1.png", historyId: "1" },
          { url: "https://example.com/2.png", historyId: "2" },
          { url: "https://example.com/3.png", historyId: "3" },
        ],
      },
      {
        id: "new",
        prompt: "new",
        images: [
          { url: "https://example.com/4.png", historyId: "4" },
          { url: "https://example.com/5.png", historyId: "5" },
          { url: "https://example.com/6.png", historyId: "6" },
          { url: "https://example.com/7.png", historyId: "7" },
        ],
      },
    ];

    const { visibleRows, hiddenCount } = getFeedRowVisibility(rows, false, 6);
    expect(hiddenCount).toBe(1);
    expect(visibleRows).toHaveLength(2);
    expect(visibleRows[0].images.map((img) => img.historyId)).toEqual([
      "2",
      "3",
    ]);
    expect(visibleRows[1].images.map((img) => img.historyId)).toEqual([
      "4",
      "5",
      "6",
      "7",
    ]);
  });

  it("returns all rows when expanded", () => {
    const rows: ImageStudioFeedRow[] = [
      {
        id: "a",
        prompt: "a",
        images: [{ url: "https://example.com/1.png", historyId: "1" }],
      },
    ];
    expect(getFeedRowVisibility(rows, true, 1).visibleRows).toEqual(rows);
  });
});
