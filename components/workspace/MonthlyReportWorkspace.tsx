"use client";

import { useState, useCallback, useEffect } from "react";
import { Client } from "@/lib/types";
import { CLIENTS } from "@/lib/clients";
import { Pane1ClientList } from "./Pane1ClientList";
import { Pane2History } from "./Pane2History";
import { Pane3Generator } from "./Pane3Generator";
import { Pane4Preview } from "./Pane4Preview";
import { MousePointerClick } from "lucide-react";

export function MonthlyReportWorkspace() {
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [targetMonth, setTargetMonth] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [generationCount, setGenerationCount] = useState(0);

  // Notionからクライアント一覧を取得（失敗時はclients.tsのフォールバックを使用）
  useEffect(() => {
    fetch("/api/notion/clients")
      .then((r) => r.json())
      .then((data: { clients?: Client[]; error?: string }) => {
        if (data.clients && data.clients.length > 0) {
          setClients(data.clients);
        }
      })
      .catch(() => {
        // フォールバック: clients.ts をそのまま使う
      });
  }, []);

  const handleClientSelect = useCallback((client: Client) => {
    setSelectedClient(client);
  }, []);

  const handleGenerate = useCallback((text: string) => {
    setPreviewText(text);
    setGenerationCount((n) => n + 1);
  }, []);

  const handleSave = useCallback(
    async (text: string, year: number, month: number) => {
      if (!selectedClient) return;
      const res = await fetch("/api/notion/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: selectedClient.name,
          clientNotionPageId: selectedClient.notionPageId,
          year,
          month,
          text,
          savedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Notionへの保存に失敗しました");
      }
      setRefreshTrigger((n) => n + 1);
    },
    [selectedClient]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ペイン1: クライアント一覧 */}
      <div className="h-full w-[200px] shrink-0">
        <Pane1ClientList
          clients={clients}
          selectedClient={selectedClient}
          onSelect={handleClientSelect}
        />
      </div>

      {/* クライアント未選択時: 一元化したempty state */}
      {!selectedClient ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <MousePointerClick className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              クライアントを選択してください
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              左のリストからクライアントを選ぶと作業を開始できます
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ペイン2: 過去の履歴 */}
          <div className="h-full flex-[2] min-w-0">
            <Pane2History
              selectedClient={selectedClient}
              refreshTrigger={refreshTrigger}
              targetMonth={targetMonth}
            />
          </div>

          {/* ペイン3: ジェネレーター */}
          <div className="h-full flex-[3] min-w-0">
            <Pane3Generator
              selectedClient={selectedClient}
              onGenerate={handleGenerate}
              onTargetMonthChange={setTargetMonth}
              onPdfChange={setPdfBase64}
            />
          </div>

          {/* ペイン4: プレビュー・手直し・保存 */}
          <div className="h-full flex-[3] min-w-0">
            <Pane4Preview
              selectedClient={selectedClient}
              text={previewText}
              targetMonth={targetMonth}
              generationCount={generationCount}
              pdfBase64={pdfBase64}
              onTextChange={setPreviewText}
              onSave={handleSave}
            />
          </div>
        </>
      )}
    </div>
  );
}
