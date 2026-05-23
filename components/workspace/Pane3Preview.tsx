"use client";

import { useState, useEffect } from "react";
import { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Send, Loader2, Check, X, Star, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selectedClient: Client | null;
  text: string;
  targetMonth: string;
  generationCount?: number;
  pdfBase64?: string | null;
  onTextChange: (text: string) => void;
  onSave: (text: string, year: number, month: number) => Promise<void> | void;
}

interface GradeResult {
  scoreA: number;
  scoreB: number;
  goodPoints: string[];
  improvements: { point: string; suggestion: string }[];
  oneliner: string;
}

function parseTargetMonth(str: string): { year: number; month: number } | null {
  const m = str.match(/(\d{4})[年\/\-](\d{1,2})/);
  return m ? { year: parseInt(m[1]), month: parseInt(m[2]) } : null;
}

const FIXED_FOOTER = "※本業で稼いだお金vs借入金の返済等は、借入金の長短振替（会計上の形式的な処理）が含まれるため、返済額と調達額は相殺してご確認ください。";

type SendState = "idle" | "confirming" | "sending" | "success" | "error";

export function Pane3Preview({ selectedClient, text, targetMonth, generationCount, pdfBase64, onTextChange, onSave }: Props) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);

  // 採点関連
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [prevText, setPrevText] = useState<string | null>(null); // 元に戻す用

  // テキスト変更で採点結果をクリア
  useEffect(() => {
    if (gradeResult) setGradeResult(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // クライアント変更で採点結果をリセット
  useEffect(() => {
    setGradeResult(null);
    setGradeError("");
    setPrevText(null);
  }, [selectedClient]);

  // ペイン2の対象月が変わったら自動反映
  useEffect(() => {
    if (!targetMonth) return;
    const parsed = parseTargetMonth(targetMonth);
    if (parsed) {
      setYear(String(parsed.year));
      setMonth(String(parsed.month).padStart(2, "0"));
    }
  }, [targetMonth]);

  // クライアントが変わったら送信状態をリセット
  useEffect(() => {
    setSendState("idle");
    setSendError("");
  }, [selectedClient]);

  // 生成完了時にハイライトアニメーションを発火
  useEffect(() => {
    if (!generationCount) return;
    setIsHighlighted(true);
    const timer = setTimeout(() => setIsHighlighted(false), 1500);
    return () => clearTimeout(timer);
  }, [generationCount]);

  const handleSave = async () => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!text.trim() || isNaN(y) || isNaN(m) || m < 1 || m > 12) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const fullText = `${text}\n\n${FIXED_FOOTER}`;
      await onSave(fullText, y, m);
      setSavedMessage(`${y}年${m}月分を保存しました`);
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendConfirm = () => {
    setSendState("confirming");
  };

  const handleSendCancel = () => {
    setSendState("idle");
    setSendError("");
  };

  const handleSendExecute = async () => {
    if (!selectedClient?.chatworkRoomId || !text.trim()) return;
    setSendState("sending");
    setSendError("");
    try {
      const response = await fetch("/api/chatwork/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedClient.chatworkRoomId,
          message: `${text}\n\n${FIXED_FOOTER}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "送信に失敗しました");
      }
      setSendState("success");
      setTimeout(() => setSendState("idle"), 3000);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "不明なエラー");
      setSendState("error");
    }
  };

  const charCount = text.length;
  const canSend = !!selectedClient?.chatworkRoomId && !!text.trim();

  const handleGrade = async () => {
    if (!text.trim()) return;
    setIsGrading(true);
    setGradeError("");
    setGradeResult(null);

    const gradePrompt = `以下の報告文を採点してください。

【報告文】
${text}

【採点基準】
A：社長目線（/100）
- 構成のわかりやすさ（/25）
- 数字の読ませ方・なぜの補足（/25）
- 行動喚起の明確さ（/25）※問いかけより「こちらが動く宣言」で締める
- 安心感・信頼感（/25）

B：税理士品質（/100）
- 数字の正確さ（/25）
- 指摘の鋭さ（/25）
- リスク言及（/25）
- 将来への提言（/25）

【前提条件】
- 読む媒体：Chatwork
- 社長のタイプ：返信しない
- 目標：社長が読んで安心し、次のアクションがわかる報告

必ず以下のJSON形式のみで回答してください（前後に説明文を入れないこと）：
{
  "scoreA": <0-100の整数>,
  "scoreB": <0-100の整数>,
  "goodPoints": ["良かった点1", "良かった点2"],
  "improvements": [
    {"point": "改善点1", "suggestion": "具体的な修正案1"},
    {"point": "改善点2", "suggestion": "具体的な修正案2"}
  ],
  "oneliner": "95点にするための一言"
}`;

    const content = [{ type: "text", text: gradePrompt }];

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content }],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error((data as { error?: string }).error || "採点APIエラー");
      const raw = (data as { content?: { type: string; text?: string }[] }).content?.find((b) => b.type === "text")?.text || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("採点結果の解析に失敗しました");
      setGradeResult(JSON.parse(jsonMatch[0]) as GradeResult);
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setIsGrading(false);
    }
  };

  const handleApply = async () => {
    if (!gradeResult || !text.trim()) return;
    setIsApplying(true);
    setPrevText(text);

    const improvements = gradeResult.improvements.map((i, idx) => `${idx + 1}. ${i.point}：${i.suggestion}`).join("\n");
    const applyPrompt = `以下の報告文を、指摘された改善点を反映して修正してください。
報告文の構成・絵文字見出し・フォーマットは維持したまま内容を改善してください。修正後の報告文のみを返し、説明文は不要です。

【元の報告文】
${text}

【改善点】
${improvements}`;

    const content = [{ type: "text", text: applyPrompt }];

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          messages: [{ role: "user", content }],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error((data as { error?: string }).error || "適用APIエラー");
      const revised = (data as { content?: { type: string; text?: string }[] }).content?.find((b) => b.type === "text")?.text || "";
      if (revised) {
        onTextChange(revised);
        setGradeResult(null);
      }
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      setIsApplying(false);
    }
  };

  const renderSendArea = () => {
    if (!selectedClient?.chatworkRoomId) return null;

    if (sendState === "confirming") {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">このルームに送信しますか？</span>
          <Button
            onClick={handleSendExecute}
            size="sm"
            variant="destructive"
            className="h-7 px-2.5 text-xs"
          >
            <Send className="mr-1 h-3 w-3" />
            送信する
          </Button>
          <Button
            onClick={handleSendCancel}
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            キャンセル
          </Button>
        </div>
      );
    }

    if (sendState === "sending") {
      return (
        <Button size="sm" disabled className="h-7 px-2.5 text-xs">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          送信中...
        </Button>
      );
    }

    if (sendState === "success") {
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Check className="h-3.5 w-3.5" />
          Chatworkに送信しました
        </div>
      );
    }

    if (sendState === "error") {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-destructive">{sendError}</span>
          <Button
            onClick={handleSendCancel}
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        onClick={handleSendConfirm}
        disabled={!canSend}
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-xs"
      >
        <Send className="mr-1 h-3 w-3" />
        Chatworkへ送信
      </Button>
    );
  };

  return (
    <div className={cn(
      "flex h-full flex-col border-r border-border transition-colors duration-700",
      isHighlighted && "bg-primary/5"
    )}>
      {/* ヘッダー */}
      <div className={cn(
        "border-b border-border px-5 py-3 transition-colors duration-700",
        isHighlighted && "border-primary/40 bg-primary/10"
      )}>
        <div className="flex items-center gap-2">
          <FileText className={cn(
            "h-4 w-4 transition-colors duration-700",
            isHighlighted ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-sm font-semibold transition-colors duration-700",
            isHighlighted ? "text-primary" : "text-foreground"
          )}>プレビュー・手直し</span>
          {isHighlighted && (
            <span className="animate-pulse rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              生成完了
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{selectedClient?.name} の報告文を編集</p>
      </div>

      {/* テキストエリア */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <>
          <Textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="ジェネレーターで生成した文章がここに表示されます。直接入力して手直しすることもできます。"
              className="min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed"
            />

            {/* 固定フッター（常時表示・編集不可） */}
            {text.trim() && (
              <div className="shrink-0 rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs leading-relaxed text-muted-foreground">{FIXED_FOOTER}</p>
              </div>
            )}

            {/* 採点ボタン */}
            {text.trim() && (
              <Button
                onClick={handleGrade}
                disabled={isGrading || isApplying}
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                {isGrading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />採点中...</>
                ) : (
                  <><Star className="mr-2 h-4 w-4" />採点する</>
                )}
              </Button>
            )}

            {/* 採点エラー */}
            {gradeError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {gradeError}
              </p>
            )}

            {/* 採点結果 */}
            {gradeResult && (
              <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50/50 p-4 text-sm space-y-3">
                {/* スコア */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">A 社長目線</p>
                    <p className={cn("text-2xl font-bold", gradeResult.scoreA >= 80 ? "text-green-600" : gradeResult.scoreA >= 60 ? "text-amber-600" : "text-destructive")}>
                      {gradeResult.scoreA}
                    </p>
                  </div>
                  <div className="text-2xl text-muted-foreground/40">/</div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">B 税理士品質</p>
                    <p className={cn("text-2xl font-bold", gradeResult.scoreB >= 80 ? "text-green-600" : gradeResult.scoreB >= 60 ? "text-amber-600" : "text-destructive")}>
                      {gradeResult.scoreB}
                    </p>
                  </div>
                  <div className="ml-auto text-center">
                    <p className="text-xs text-muted-foreground">総合</p>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round((gradeResult.scoreA + gradeResult.scoreB) / 2)}
                    </p>
                  </div>
                </div>

                {/* 良かった点 */}
                <div>
                  <p className="mb-1 text-xs font-semibold text-green-700">✅ 良かった点</p>
                  <ul className="space-y-0.5">
                    {gradeResult.goodPoints.map((p, i) => (
                      <li key={i} className="text-xs text-foreground">・{p}</li>
                    ))}
                  </ul>
                </div>

                {/* 改善点 */}
                <div>
                  <p className="mb-1 text-xs font-semibold text-amber-700">⚠️ 改善点</p>
                  <ul className="space-y-1.5">
                    {gradeResult.improvements.map((imp, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium text-foreground">{imp.point}</span>
                        <span className="text-muted-foreground"> → {imp.suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 一言 */}
                <div className="rounded-md bg-primary/5 px-3 py-2">
                  <p className="text-xs text-primary">💡 {gradeResult.oneliner}</p>
                </div>

                {/* アクション */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={handleApply}
                    disabled={isApplying}
                    size="sm"
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {isApplying ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />適用中...</>
                    ) : (
                      <><Sparkles className="mr-1.5 h-3.5 w-3.5" />改善案を適用する</>
                    )}
                  </Button>
                  {prevText && (
                    <Button
                      onClick={() => { onTextChange(prevText); setPrevText(null); setGradeResult(null); }}
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />元に戻す
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 保存・送信バー */}
            <div className="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{charCount.toLocaleString()} 文字</span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {renderSendArea()}
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-[72px] text-sm"
                      min={2000}
                      max={2100}
                    />
                    <span className="text-sm text-muted-foreground">年</span>
                    <Input
                      type="number"
                      value={month}
                      onChange={(e) => setMonth(e.target.value.padStart(2, "0"))}
                      className="w-[52px] text-sm"
                      min={1}
                      max={12}
                    />
                    <span className="text-sm text-muted-foreground">月</span>
                    <Button onClick={handleSave} disabled={!text.trim() || isSaving} size="sm">
                      {isSaving ? (
                        <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />保存中...</>
                      ) : (
                        <><Save className="mr-1.5 h-3.5 w-3.5" />保存</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              {savedMessage && (
                <p className="mt-1 text-xs font-medium text-green-600">{savedMessage}</p>
              )}
              {saveError && (
                <p className="mt-1 text-xs font-medium text-destructive">{saveError}</p>
              )}
            </div>
          </>
      </div>
    </div>
  );
}
