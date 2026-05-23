"use client";

import { useState, useEffect } from "react";
import { Client, FinalReport } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Archive, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  selectedClient: Client | null;
  refreshTrigger: number;
  targetMonth?: string;
}

export function Pane4Final({ selectedClient, refreshTrigger, targetMonth }: Props) {
  const [history, setHistory] = useState<FinalReport[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClient) {
      setHistory([]);
      return;
    }
    setExpandedKey(null);

    const parsed = targetMonth?.match(/(\d{4})[年\/\-](\d{1,2})/);
    const base = parsed
      ? new Date(parseInt(parsed[1]), parseInt(parsed[2]) - 1, 1)
      : new Date();
    const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    const year = prev.getFullYear();
    const month = prev.getMonth() + 1;

    const idParam = selectedClient.notionPageId
      ? `clientNotionPageId=${encodeURIComponent(selectedClient.notionPageId)}`
      : `clientName=${encodeURIComponent(selectedClient.name)}`;

    fetch(`/api/notion/reports?${idParam}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data: { reports?: FinalReport[] }) => {
        if (data.reports) setHistory(data.reports);
      })
      .catch(() => setHistory([]));
  }, [selectedClient, refreshTrigger, targetMonth]);

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const buildKey = (r: FinalReport) => `${r.year}_${r.month}`;

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">過去の履歴</span>
        </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedClient?.name}
            {selectedClient && (() => {
              const parsed = targetMonth?.match(/(\d{4})[年\/\-](\d{1,2})/);
              const base = parsed
                ? new Date(parseInt(parsed[1]), parseInt(parsed[2]) - 1, 1)
                : new Date();
              const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
              return ` — ${prev.getFullYear()}年${prev.getMonth() + 1}月`;
            })()}
          </p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-4 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            前月の報告
          </p>
          {history.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {history.length}件
            </Badge>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Archive className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                前月の報告文はありません
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-0 flex-1">
            <div className="flex flex-col gap-1">
              {history.map((report) => {
                const key = buildKey(report);
                const isExpanded = expandedKey === key;
                const savedDate = new Date(report.savedAt).toLocaleDateString("ja-JP");

                return (
                  <div key={key} className="overflow-hidden rounded-md border border-border">
                    <button
                      onClick={() => toggleExpand(key)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium">
                        {report.year}年{report.month}月
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{savedDate}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <>
                        <Separator />
                        <div className="bg-muted/20 p-3">
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                            {report.text}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
