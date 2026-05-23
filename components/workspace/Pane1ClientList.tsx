"use client";

import { Client } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

interface Props {
  clients: Client[];
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
}

export function Pane1ClientList({ clients, selectedClient, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-muted/30">
      {/* ヘッダー */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">クライアント</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{clients.length}社</p>
      </div>

      {/* リスト */}
      <ScrollArea className="h-0 flex-1">
        <div className="p-2">
          {clients.map((client) => {
            const isSelected = selectedClient?.id === client.id;
            return (
              <button
                key={client.id}
                onClick={() => onSelect(client)}
                className={cn(
                  "w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {client.fiscalMonth !== undefined && (
                    <span className={cn(
                      "shrink-0 text-[10px] font-medium tabular-nums",
                      isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {client.fiscalMonth}月
                    </span>
                  )}
                  <span className="truncate">{client.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* フッター */}
      {selectedClient && (
        <div className="border-t border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">選択中</p>
          <p className="text-sm font-medium text-foreground">{selectedClient.name}</p>
        </div>
      )}
    </div>
  );
}
