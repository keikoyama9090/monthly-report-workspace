export interface Client {
  id: string;
  name: string;
  chatworkRoomId?: string;
  notionPageId?: string;
  fiscalMonth?: number;
}

export interface FinalReport {
  clientName: string;
  year: number;
  month: number;
  text: string;
  savedAt: string;
}

export type FinalReportKey = `final_${string}_${number}_${number}`;
