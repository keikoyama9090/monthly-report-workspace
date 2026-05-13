"use client";

import { useState, useEffect } from "react";
import { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save } from "lucide-react";

interface Props {
  selectedClient: Client | null;
  text: string;
  targetMonth: string;
  onTextChange: (text: string) => void;
  onSave: (text: string, year: number, month: number) => void;
}

function parseTargetMonth(str: string): { year: number; month: number } | null {
  const m = str.match(/(\d{4})[年\/\-](\d{1,2})/);
  return m ? { year: parseInt(m[1]), month: parseInt(m[2]) } : null;
}

export function Pane3Preview({ selectedClient, text, targetMonth, onTextChange, onSave }: Props) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [savedMessage, setSavedMessage] = useState("");

  // ペイン2の対象月が変わったら自動反映
  useEffect(() => {
    if (!targetMonth) return;
    const parsed = parseTargetMonth(targetMonth);
    if (parsed) {
      setYear(String(parsed.year));
      setMonth(String(parsed.month).padStart(2, "0"));
    }
  }, [targetMonth]);

  const handleSave = () => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!text.trim() || isNaN(y) || isNaN(m) || m < 1 || m > 12) return;
    onSave(text, y, m);
    setSavedMessage(`${y}年${m}月分を保存しました`);
    setTimeout(() => setSavedMessage(""), 3000);
  };

  const charCount = text.length;

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* ヘッダー */}
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">プレビュー・手直し</span>
        </div>
        {selectedClient ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{selectedClient.name} の報告文を編集</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">クライアントを選択してください</p>
        )}
      </div>

      {/* テキストエリア */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        {selectedClient ? (
          <>
            <Textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="ジェネレーターで生成した文章がここに表示されます。直接入力して手直しすることもできます。"
              className="min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed"
            />

            {/* 保存バー */}
            <div className="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{charCount.toLocaleString()} 文字</span>
                <div className="ml-auto flex items-center gap-1.5">
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
                  <Button onClick={handleSave} disabled={!text.trim()} size="sm">
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    保存
                  </Button>
                </div>
              </div>
              {savedMessage && (
                <p className="mt-1 text-xs font-medium text-green-600">{savedMessage}</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">クライアントを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
