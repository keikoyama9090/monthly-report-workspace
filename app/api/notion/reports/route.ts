import { NextRequest, NextResponse } from "next/server";

function extractNotionId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.split("?")[0].replace(/-/g, "");
  const match = clean.match(/([0-9a-f]{32})$/i);
  return match?.[1];
}

const TOKEN = process.env.NOTION_TOKEN;
const REPORTS_DB_ID = extractNotionId(process.env.NOTION_REPORTS_DB_ID);
const NOTION_VERSION = "2022-06-28";

function notionHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// 報告文を保存
export async function POST(req: NextRequest) {
  if (!TOKEN || !REPORTS_DB_ID) {
    return NextResponse.json({ error: "Notion設定が未完了です。" }, { status: 500 });
  }

  try {
    const { clientName, clientNotionPageId, year, month, text, savedAt } = await req.json() as {
      clientName: string;
      clientNotionPageId?: string;
      year: number;
      month: number;
      text: string;
      savedAt: string;
    };

    // 同じクライアント・年月の既存レコードを探す
    const clientFilter = clientNotionPageId
      ? { property: "クライアントDB", relation: { contains: clientNotionPageId } }
      : { property: "クライアント名", select: { equals: clientName } };
    const queryRes = await fetch(
      `https://api.notion.com/v1/databases/${REPORTS_DB_ID}/query`,
      {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: {
            and: [
              clientFilter,
              { property: "年", number: { equals: year } },
              { property: "月", number: { equals: month } },
            ],
          },
        }),
      }
    );
    const queryData = await queryRes.json() as { results?: { id: string }[] };
    const existing = queryData.results ?? [];

    const title = `${clientName} ${year}年${month}月`;
    const properties: Record<string, unknown> = {
      名前: { title: [{ text: { content: title } }] },
      年: { number: year },
      月: { number: month },
      保存日時: { date: { start: savedAt } },
    };
    if (clientNotionPageId) {
      properties["クライアントDB"] = { relation: [{ id: clientNotionPageId }] };
    }
    const children = [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: text } }],
        },
      },
    ];

    let pageId: string;

    if (existing.length > 0) {
      pageId = existing[0].id;
      // プロパティ更新
      const patchRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ properties }),
      });
      if (!patchRes.ok) {
        const errData = await patchRes.json() as { message?: string };
        throw new Error(`Notionページ更新エラー: ${errData.message ?? patchRes.status}`);
      }
      // 既存ブロック削除
      const blocksRes = await fetch(
        `https://api.notion.com/v1/blocks/${pageId}/children`,
        { headers: notionHeaders() }
      );
      const blocksData = await blocksRes.json() as { results?: { id: string }[] };
      for (const block of blocksData.results ?? []) {
        await fetch(`https://api.notion.com/v1/blocks/${block.id}`, {
          method: "DELETE",
          headers: notionHeaders(),
        });
      }
    } else {
      // 新規作成
      const createRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: REPORTS_DB_ID },
          properties,
        }),
      });
      const createData = await createRes.json() as { id?: string; message?: string };
      if (!createRes.ok || !createData.id) {
        throw new Error(`Notionページ作成エラー: ${createData.message ?? createRes.status}`);
      }
      pageId = createData.id;
    }

    // 本文を書き込む
    const appendRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: notionHeaders(),
      body: JSON.stringify({ children }),
    });
    if (!appendRes.ok) {
      const errData = await appendRes.json() as { message?: string };
      throw new Error(`Notionブロック書き込みエラー: ${errData.message ?? appendRes.status}`);
    }

    return NextResponse.json({ ok: true, pageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 報告文を取得
export async function GET(req: NextRequest) {
  if (!TOKEN || !REPORTS_DB_ID) {
    return NextResponse.json({ error: "Notion設定が未完了です。" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const clientName = searchParams.get("clientName");
  const clientNotionPageId = searchParams.get("clientNotionPageId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!clientName && !clientNotionPageId) {
    return NextResponse.json({ error: "clientName または clientNotionPageId は必須です。" }, { status: 400 });
  }

  try {
    const clientFilter = clientNotionPageId
      ? { property: "クライアントDB", relation: { contains: clientNotionPageId } }
      : { property: "クライアント名", select: { equals: clientName } };

    const filter = year && month
      ? {
          and: [
            clientFilter,
            { property: "年", number: { equals: parseInt(year) } },
            { property: "月", number: { equals: parseInt(month) } },
          ],
        }
      : clientFilter;

    const queryRes = await fetch(
      `https://api.notion.com/v1/databases/${REPORTS_DB_ID}/query`,
      {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          filter,
          sorts: [
            { property: "年", direction: "descending" },
            { property: "月", direction: "descending" },
          ],
          page_size: 24,
        }),
      }
    );
    const queryData = await queryRes.json() as {
      results?: {
        id: string;
        properties: Record<string, {
          type: string;
          select?: { name?: string };
          number?: number;
          date?: { start?: string };
        }>;
      }[];
    };

    const reports = await Promise.all(
      (queryData.results ?? []).map(async (page) => {
        const yearVal = page.properties["年"]?.number ?? 0;
        const monthVal = page.properties["月"]?.number ?? 0;
        const savedAt = page.properties["保存日時"]?.date?.start ?? new Date().toISOString();

        // ページ本文を取得
        const blocksRes = await fetch(
          `https://api.notion.com/v1/blocks/${page.id}/children`,
          { headers: notionHeaders() }
        );
        const blocksData = await blocksRes.json() as {
          results?: { type: string; paragraph?: { rich_text: { plain_text: string }[] } }[];
        };
        const text = (blocksData.results ?? [])
          .filter((b) => b.type === "paragraph")
          .map((b) => b.paragraph?.rich_text.map((r) => r.plain_text).join("") ?? "")
          .join("\n");

        return { clientName, year: yearVal, month: monthVal, text, savedAt };
      })
    );

    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
