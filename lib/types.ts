export interface Client {
  id: string;
  name: string;
}

export interface FinalReport {
  clientName: string;
  year: number;
  month: number;
  text: string;
  savedAt: string;
}

export type FinalReportKey = `final_${string}_${number}_${number}`;
