import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: { time?: string }) =>
    values?.time ? `${key} ${values.time}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", props, children),
}));

import { ReferenceDetailContent } from "@/components/reference-detail";
import type { ReferenceDetail } from "@/lib/reference-store";

const reference: ReferenceDetail = {
  reference: {
    kind: "technique",
    id: "fixture-technique",
    title: "<img src=x onerror=alert(1)>",
    description: "Original technique summary",
    provenance: "Original fixture",
    positionId: "closed-guard",
  },
  parent: {
    kind: "position",
    id: "closed-guard",
    title: "Closed guard",
    description: "Original position summary",
    provenance: "Original fixture",
    positionId: null,
  },
  techniques: [],
  techniquesHasMore: false,
  videos: [],
};

it("escapes shared text and refuses unsafe video URLs", async () => {
  const detail = {
    ...reference,
    videos: [
      {
        id: "unsafe",
        url: "javascript:alert(1)",
        startSeconds: 20,
        label: "Unavailable link",
        sourceName: "Source",
        sourceTitle: "Title",
        momentLabel: "Moment",
        provenance: "Fixture",
        reviewedOn: "2026-09-28",
      },
    ],
  };
  const html = renderToStaticMarkup(await ReferenceDetailContent({ detail }));
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(html).not.toContain("<img");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("videoUnavailable");
});

it("renders a reviewed timestamped video as a safe external link", async () => {
  const detail = {
    ...reference,
    videos: [
      {
        id: "reviewed",
        url: "https://www.youtube.com/watch?v=3B0w4zb51Mk",
        startSeconds: 150,
        label: "Opening example",
        sourceName: "Chewjitsu",
        sourceTitle: "Closed guard opening",
        momentLabel: "Standing opening",
        provenance: "Reviewed source",
        reviewedOn: "2026-09-28",
      },
    ],
  };
  const html = renderToStaticMarkup(await ReferenceDetailContent({ detail }));
  expect(html).toContain(
    "https://www.youtube.com/watch?v=3B0w4zb51Mk&amp;t=150s",
  );
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain("watchAt 2:30");
});
