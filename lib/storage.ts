import { FinalReport } from "./types";

export function buildKey(clientName: string, year: number, month: number): string {
  return `final_${clientName}_${year}_${month}`;
}

export function saveFinalReport(report: FinalReport): void {
  const key = buildKey(report.clientName, report.year, report.month);
  localStorage.setItem(key, JSON.stringify(report));
}

export function loadFinalReport(
  clientName: string,
  year: number,
  month: number
): FinalReport | null {
  const key = buildKey(clientName, year, month);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FinalReport;
  } catch {
    return null;
  }
}

export function loadAllFinalReports(clientName: string): FinalReport[] {
  const prefix = `final_${clientName}_`;
  const results: FinalReport[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const report = JSON.parse(raw) as FinalReport;
      results.push(report);
    } catch {
      // 破損データはスキップ
    }
  }

  // 年月降順
  results.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return results;
}
