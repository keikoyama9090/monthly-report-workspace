"use client";

import { useState, useEffect } from "react";
import { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Send, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selectedClient: Client | null;
  text: string;
  targetMonth: string;
  generationCount?: number;
  onTextChange: (text: string) => void;
  onSave: (text: string, year: number, month: number) => Promise<void> | void;

}

function parseTargetMonth(str: string): { year: number; month: number } | null {
  const m = str.match(/(\d{4})[年\/\-](\d{1,2})/);
  return m ? { year: parseInt(m[1]), month: parseInt(m[2]) } : null;
}

type SendState = "idle" | "confirming" | "sending" | "success" | "error";

export function Pane3Preview({ selectedClient, text, targetMonth, generationCount, onTextChange, onSave }: Props) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);

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
      await onSave(text, y, m);
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
          message: text,
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
