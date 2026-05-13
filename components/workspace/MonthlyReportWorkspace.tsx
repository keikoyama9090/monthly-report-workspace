"use client";

import { useState, useCallback } from "react";
import { Client, FinalReport } from "@/lib/types";
import { saveFinalReport } from "@/lib/storage";
import { Pane1ClientList } from "./Pane1ClientList";
import { Pane2Generator } from "./Pane2Generator";
import { Pane3Preview } from "./Pane3Preview";
import { Pane4Final } from "./Pane4Final";

export function MonthlyReportWorkspace() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [targetMonth, setTargetMonth] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleClientSelect = useCallback((client: Client) => {
    setSelectedClient(client);
  }, []);

  const handleGenerate = useCallback((text: string) => {
    setPreviewText(text);
  }, []);

  const handleSave = useCallback(
    (text: string, year: number, month: number) => {
      if (!selectedClient) return;
      const report: FinalReport = {
        clientName: selectedClient.name,
        year,
        month,
        text,
        savedAt: new Date().toISOString(),
      };
      saveFinalReport(report);
      setRefreshTrigger((n) => n + 1);
    },
    [selectedClient]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ペイン1: クライアント一覧 */}
      <div className="h-full w-[200px] shrink-0">
        <Pane1ClientList
          selectedClient={selectedClient}
          onSelect={handleClientSelect}
        />
      </div>

      {/* ペイン2: ジェネレーター */}
      <div className="h-full flex-[3] min-w-0">
        <Pane2Generator
          selectedClient={selectedClient}
          onGenerate={handleGenerate}
          onTargetMonthChange={setTargetMonth}
        />
      </div>

      {/* ペイン3: プレビュー・手直し・保存 */}
      <div className="h-full flex-[3] min-w-0">
        <Pane3Preview
          selectedClient={selectedClient}
          text={previewText}
          targetMonth={targetMonth}
          onTextChange={setPreviewText}
          onSave={handleSave}
        />
      </div>

      {/* ペイン4: 過去履歴ビューア */}
      <div className="h-full flex-[2] min-w-0">
        <Pane4Final
          selectedClient={selectedClient}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  );
}
