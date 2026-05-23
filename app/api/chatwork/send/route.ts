import { NextRequest, NextResponse } from "next/server";

const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;

export async function POST(req: NextRequest) {
  if (!CHATWORK_API_TOKEN) {
    return NextResponse.json(
      { error: "ChatworkのAPIトークンが未設定です。.env.local の CHATWORK_API_TOKEN を確認してください。" },
      { status: 500 }
    );
  }

  let body: { roomId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { roomId, message } = body;

  if (!roomId || !message?.trim()) {
    return NextResponse.json({ error: "roomId と message は必須です。" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ body: message });
    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: "POST",
        headers: {
          "x-chatworktoken": CHATWORK_API_TOKEN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg =
        (data as { errors?: string[] }).errors?.join(", ") ||
        `Chatwork APIエラー (${response.status})`;
      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    return NextResponse.json({ ok: true, messageId: (data as { message_id?: string }).message_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
