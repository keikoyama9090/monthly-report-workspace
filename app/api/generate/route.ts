import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "APIキーが未設定です。.env.local を確認してください。" },
      { status: 500 }
    );
  }

  if (!/^[\x00-\x7F]+$/.test(ANTHROPIC_API_KEY)) {
    return NextResponse.json(
      { error: "APIキーに使用できない文字が含まれています。.env.local の ANTHROPIC_API_KEY を確認してください。" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: (data as { error?: { message?: string } }).error?.message || "Anthropic APIエラー" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
