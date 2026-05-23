import { NextResponse } from "next/server";

function extractNotionId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.split("?")[0].replace(/-/g, "");
  const match = clean.match(/([0-9a-f]{32})$/i);
  return match?.[1];
}

const TOKEN = process.env.NOTION_TOKEN;
const CLIENT_DB_ID = extractNotionId(process.env.NOTION_CLIENT_DB_ID);

const NOTION_VERSION = "2022-06-28";

export async function GET() {
  if (!TOKEN || !CLIENT_DB_ID) {
    return NextResponse.json(
      { error: "Notion設定が未完了です。.env.local を確認してください。" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${CLIENT_DB_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100 }),
      }
    );

    const data = await res.json() as {
      object: string;
      results?: {
        id: string;
        properties: Record<string, {
          type: string;
          title?: { plain_text: string }[];
          rich_text?: { plain_text: string }[];
          select?: { name: string };
          number?: number;
        }>;
      }[];
      message?: string;
    };

    if (!res.ok || data.object !== "list") {
      return NextResponse.json({ error: data.message ?? "Notionエラー" }, { status: 500 });
    }

    // 「決算」カラムの値から月の数字を抽出（例：「3月」→3）
    function parseFiscalMonth(page: NonNullable<typeof data.results>[0]): number {
      const prop = page.properties["決算"];
      if (!prop) return 999;
      const raw =
        prop.select?.name ??
        prop.rich_text?.map((t) => t.plain_text).join("") ??
        "";
      const m = raw.match(/(\d+)/);
      return m ? parseInt(m[1]) : 999;
    }

    const clients = (data.results ?? [])
      .map((page) => {
        const titleProp = Object.values(page.properties).find((v) => v.type === "title");
        const name = titleProp?.title?.map((t) => t.plain_text).join("") ?? "";
        const fiscal = parseFiscalMonth(page);
        return { id: page.id, name, notionPageId: page.id, fiscalMonth: fiscal < 999 ? fiscal : undefined, _fiscal: fiscal };
      })
      .filter((c) => c.name.trim() !== "")
      .sort((a, b) => a._fiscal - b._fiscal)
      .map(({ _fiscal: _, ...c }) => c);

    return NextResponse.json({ clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
