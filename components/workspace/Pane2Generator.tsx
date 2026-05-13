"use client";

import { useState, useRef, useCallback } from "react";
import { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Zap,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface Props {
  selectedClient: Client | null;
  onGenerate: (text: string) => void;
  onTargetMonthChange?: (month: string) => void;
}

// 将来：クライアント別スキル設定（報告方針・重点項目）をここに追加
// const clientSkill = useClientSkill(selectedClient?.id);

// 万円表示（小数第1位）
function toMan(yen: number) {
  return Math.floor((yen / 10000) * 10) / 10;
}

function parseTargetMonth(str: string): { year: number; month: number } | null {
  const m = str.match(/(\d{4})[年\/\-](\d{1,2})/);
  return m ? { year: parseInt(m[1]), month: parseInt(m[2]) } : null;
}

function getPaymentDate(
  targetYear: number,
  targetMonth: number,
  fiscalEndMonth: number,
  offsetMonths: number
) {
  const fiscalEndYear =
    targetMonth <= fiscalEndMonth ? targetYear : targetYear + 1;
  const baseYear = fiscalEndYear - 1;
  const baseMonth = fiscalEndMonth;
  const total = baseYear * 12 + baseMonth - 1 + offsetMonths;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function buildTaxMemo(
  targetMonthStr: string,
  fiscalEndMonth: number,
  corp: {
    preIncome: number;
    yearendExpense: number;
    yearendNote: string;
    carryover: number;
    rate: number;
    prepaidDone: number;
    prepaidFuture: number;
  },
  ct: {
    received: number;
    paid: number;
    prepaid1: number;
    prepaid2: number;
    prepaid3: number;
  }
): string {
  const corpHasInput =
    corp.preIncome !== 0 || corp.yearendExpense !== 0 || corp.carryover !== 0;
  const ctHasInput =
    ct.received !== 0 ||
    ct.paid !== 0 ||
    ct.prepaid1 + ct.prepaid2 + ct.prepaid3 !== 0;
  if (!corpHasInput && !ctHasInput) return "";

  const fmt = (yen: number) => toMan(yen).toLocaleString();
  const target = parseTargetMonth(targetMonthStr);
  const mLabel = (offset: number) => {
    if (!fiscalEndMonth || !target) return "";
    const d = getPaymentDate(target.year, target.month, fiscalEndMonth, offset);
    return `${d.year}年${d.month}月`;
  };

  const lines: string[] = [];

  if (corpHasInput) {
    const taxable = corp.preIncome - corp.yearendExpense - corp.carryover;
    const taxGross = taxable > 0 ? Math.floor((taxable * corp.rate) / 100) : 0;
    const taxFinal = taxGross - corp.prepaidDone - corp.prepaidFuture;
    const fm = mLabel(8);
    lines.push("【法人税等】");
    lines.push(`・税前利益：${fmt(corp.preIncome)}万円`);
    lines.push(
      `・期末計上予定経費：${fmt(corp.yearendExpense)}万円${corp.yearendNote ? "（" + corp.yearendNote + "）" : ""}`
    );
    lines.push(`・繰越欠損金：${fmt(corp.carryover)}万円`);
    lines.push(`・課税所得見込み：${fmt(taxable)}万円`);
    lines.push(`・実効税率：${corp.rate}%`);
    lines.push(`・法人税概算：${fmt(taxGross)}万円`);
    lines.push(`・予定納税（既納付）：${fmt(corp.prepaidDone)}万円`);
    lines.push(
      `・予定納税（将来納付${fm ? "（" + fm + "予定）" : ""}）：${fmt(corp.prepaidFuture)}万円`
    );
    lines.push(`・法人税 期末納付見込み：${fmt(taxFinal)}万円`);
  }

  if (ctHasInput) {
    const ctTotal = ct.prepaid1 + ct.prepaid2 + ct.prepaid3;
    const ctFinal = ct.received - ct.paid - ctTotal;
    if (lines.length > 0) lines.push("");
    lines.push("【消費税】");
    lines.push(`・仮受消費税：${fmt(ct.received)}万円`);
    lines.push(`・仮払消費税：${fmt(ct.paid)}万円`);
    const m1 = mLabel(5),
      m2 = mLabel(8),
      m3 = mLabel(11);
    if (ct.prepaid1)
      lines.push(
        `・中間納税 第1回${m1 ? "（" + m1 + "）" : ""}：${fmt(ct.prepaid1)}万円`
      );
    if (ct.prepaid2)
      lines.push(
        `・中間納税 第2回${m2 ? "（" + m2 + "）" : ""}：${fmt(ct.prepaid2)}万円`
      );
    if (ct.prepaid3)
      lines.push(
        `・中間納税 第3回${m3 ? "（" + m3 + "）" : ""}：${fmt(ct.prepaid3)}万円`
      );
    lines.push(`・消費税 期末納税見込み：${fmt(ctFinal)}万円`);
  }

  return lines.join("\n");
}

function buildPrompt(
  targetMonth: string,
  contextMemo: string,
  taxMemo: string
): string {
  return `以下のモニタリングデータと今月のトピック・サジェストをもとに、クライアント経営者へのChatwork報告文を作成してください。
なお、モニタリングシート（PDF）は別途添付されるため、文章中に数字を羅列する必要はありません。
「どの数字を・なぜ・どう判断すべきか」を伝えることに集中してください。

対象月：${targetMonth || "（未入力）"}

【今月のトピック・サジェスト】
${contextMemo || "（未入力）"}

【納税情報】
${taxMemo || "なし（セクション2を省略すること）"}

==========
■ セクション1：業績報告
==========

【段落構成】
必ず以下の3段落構成にする

① 最重要論点
　今月のシートで経営者が最も知るべき論点を1つ選び、そこから書き始める。
　※ 最重要論点の選び方と優先順位はスキル「monitoring-reading」の判断基準に従うこと
　　 （スキル未設定の場合は、本業利益の増減を最重要とする）

② 注意点
　以下の異常値チェック基準を超えた項目があれば1〜2項目に絞って言及する
　ない場合はこの段落を省略する
　※ 異常値の解釈・コメントの方向性はスキル「monitoring-reading」に従うこと

　【損益の異常値チェック（前期比）】
　・売上高：±10%以上
　・変動費率：±3%ポイント以上
　・固定費：±5%以上
　・本業利益率：±3%ポイント以上

　【資金の異常値チェック】
　・キャッシュ増減がマイナス → 必ず言及
　・キャッシュ残高が月商の1ヶ月分未満 → 必ず言及

③ サジェスト
　今月のトピックから具体的なアクションを1つ提案する（納税・税務計算以外のトピックを優先する）
　必ず「ご一緒に〜しましょう」など税理士からの提案として締める
　1〜2文に収める
　「トピックのご指定がないため」などの言い訳は絶対に入れない

【必ず含める項目】
キャッシュ増減・キャッシュ残高・有利子負債の3点は必ず数字付きで言及する

【フォーマット】
・冒頭に「📋 〇〇年〇月度 業績報告」を1行入れる
・以下の絵文字見出し＋1〜2文の文章構成にする

📊 損益
（1〜2文、「〜です」「〜ます」で締める）

💰 資金
（1〜2文、「〜です」「〜ます」で締める）

💡 トピック
（1〜2文）

==========
■ セクション2：納税予測
==========

【出力条件】
納税情報が入力されている場合のみ出力する。
ない場合はセクション2を丸ごと省略する。

【内容】
入力された納税情報をもとに、以下を箇条書きで簡潔にまとめる
・法人税の概算（計算過程を1行で示す）
・消費税の概算（計算過程を1行で示す）
・合計納税見込み額
・納税後のキャッシュ残高見込み（キャッシュ残高 − 合計納税見込み額）

==========
■ 全体の出力フォーマット
==========

📋 〇〇年〇月度 業績報告

📊 損益
（1〜2文）

💰 資金
（1〜2文）

💡 トピック
（1〜2文）

─────────────
🧾 納税予測（該当月のみ・納税情報がない場合はこのブロックごと省略）
・法人税：〇〇万円（計算式）
・消費税：〇〇万円（計算式）
・合計：〇〇万円
・納税後残高：〇〇万円

【共通ルール】
・数字は必ず万円・%単位で記載する（万円は小数不要、整数で丸める）
・前期比は「前期比+30.7%増」「前期比▲5%減」のように増減で表現する
・体言止め禁止、必ず文章で締める
・評価的な決めつけ表現（「財務体質は着実に強化されています」等）は使わない
・見出し間は1行空ける`;
}

export function Pane2Generator({ selectedClient, onGenerate, onTargetMonthChange }: Props) {
  const [contextMemo, setContextMemo] = useState(
    "・先月からの流れ：\n・今月の特記事項：\n・経営者の認識："
  );
  const [targetMonth, setTargetMonth] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 納税予測フォームの状態
  const [fiscalEndMonth, setFiscalEndMonth] = useState(0);
  const [taxPreIncome, setTaxPreIncome] = useState("");
  const [taxYearendExpense, setTaxYearendExpense] = useState("");
  const [taxYearendNote, setTaxYearendNote] = useState("");
  const [taxCarryover, setTaxCarryover] = useState("");
  const [taxRate, setTaxRate] = useState("30");
  const [taxPrepaidDone, setTaxPrepaidDone] = useState("");
  const [taxPrepaidFuture, setTaxPrepaidFuture] = useState("");
  const [ctReceived, setCtReceived] = useState("");
  const [ctPaid, setCtPaid] = useState("");
  const [ctPrepaid1, setCtPrepaid1] = useState("");
  const [ctPrepaid2, setCtPrepaid2] = useState("");
  const [ctPrepaid3, setCtPrepaid3] = useState("");

  const loadPDF = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPdfBase64(result.split(",")[1]);
      setPdfName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") loadPDF(file);
    },
    [loadPDF]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadPDF(file);
    },
    [loadPDF]
  );

  const removePDF = useCallback(() => {
    setPdfBase64(null);
    setPdfName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const n = (v: string) => parseFloat(v) || 0;

  const getTaxMemo = () =>
    buildTaxMemo(
      targetMonth,
      fiscalEndMonth,
      {
        preIncome: n(taxPreIncome),
        yearendExpense: n(taxYearendExpense),
        yearendNote: taxYearendNote,
        carryover: n(taxCarryover),
        rate: n(taxRate),
        prepaidDone: n(taxPrepaidDone),
        prepaidFuture: n(taxPrepaidFuture),
      },
      {
        received: n(ctReceived),
        paid: n(ctPaid),
        prepaid1: n(ctPrepaid1),
        prepaid2: n(ctPrepaid2),
        prepaid3: n(ctPrepaid3),
      }
    );

  // 法人税の概算表示
  const corpCalc = (() => {
    const pre = n(taxPreIncome);
    const exp = n(taxYearendExpense);
    const carry = n(taxCarryover);
    const rate = n(taxRate);
    const done = n(taxPrepaidDone);
    const future = n(taxPrepaidFuture);
    const taxable = pre - exp - carry;
    const taxGross = taxable > 0 ? Math.floor((taxable * rate) / 100) : 0;
    const taxFinal = taxGross - done - future;
    const hasInput = pre !== 0 || exp !== 0 || carry !== 0;
    return { taxable, taxGross, taxFinal, hasInput };
  })();

  const ctCalc = (() => {
    const rec = n(ctReceived);
    const paid = n(ctPaid);
    const total = n(ctPrepaid1) + n(ctPrepaid2) + n(ctPrepaid3);
    const ctFinal = rec - paid - total;
    const hasInput = rec !== 0 || paid !== 0 || total !== 0;
    return { ctFinal, hasInput };
  })();

  const handleGenerate = async () => {
    if (!pdfBase64) return;
    setIsLoading(true);
    setErrorMsg("");

    const taxMemo = getTaxMemo();
    const prompt = buildPrompt(targetMonth, contextMemo, taxMemo);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `【文脈メモ】\n${contextMemo}\n\n【モニタリングシート】`,
                },
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: pdfBase64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "APIエラーが発生しました");

      const text =
        (
          data as {
            content?: { type: string; text?: string }[];
          }
        ).content?.find((b) => b.type === "text")?.text || "";
      onGenerate(text);
    } catch (err) {
      setErrorMsg(
        `エラー：${err instanceof Error ? err.message : "不明なエラー"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const numInput = (
    value: string,
    onChange: (v: string) => void,
    placeholder = "0",
    className = ""
  ) => (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("text-right font-mono text-sm", className)}
    />
  );

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* ヘッダー */}
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            ジェネレーター
          </span>
        </div>
        {selectedClient ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedClient.name} の報告文を生成
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            クライアントを選択してください
          </p>
        )}
      </div>

      {!selectedClient ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            クライアントを選択してください
          </p>
        </div>
      ) : (
        <ScrollArea className="h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            {/* 文脈メモ */}
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                文脈メモ
              </p>
              <Textarea
                value={contextMemo}
                onChange={(e) => setContextMemo(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
              />
            </section>

            {/* PDFドロップ */}
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ① モニタリングシート（PDF）
              </p>
              {pdfBase64 ? (
                <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-sm font-medium text-primary">
                    {pdfName}
                  </span>
                  <button
                    onClick={removePDF}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed py-6 transition-colors",
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30 hover:border-primary/50"
                  )}
                >
                  <FileText className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    PDFをドロップ、またはクリック
                  </p>
                  <p className="text-xs text-muted-foreground">
                    BISAIDEのモニタリングシート
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </section>

            {/* 対象月 */}
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ② 対象月
              </p>
              <Input
                type="text"
                value={targetMonth}
                onChange={(e) => {
                  setTargetMonth(e.target.value);
                  onTargetMonthChange?.(e.target.value);
                }}
                placeholder="例：2026年4月"
                className="text-sm"
              />
            </section>

            {/* 納税予測（折りたたみ） */}
            <section>
              <button
                onClick={() => setShowTax(!showTax)}
                className="flex w-full items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
              >
                <span>③ 納税予測（任意）</span>
                {showTax ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showTax && (
                <div className="mt-2 flex flex-col gap-3 rounded-md border border-border p-3">
                  {/* 決算月 */}
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      ① 決算月
                    </label>
                    <select
                      value={fiscalEndMonth}
                      onChange={(e) =>
                        setFiscalEndMonth(parseInt(e.target.value))
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value={0}>― 選択 ―</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}月
                        </option>
                      ))}
                    </select>
                  </div>

                  <Separator />
                  <p className="text-xs font-semibold text-primary">法人税等</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ② 税前利益（円）
                      </label>
                      {numInput(taxPreIncome, setTaxPreIncome)}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ③ 期末計上予定経費（円）
                      </label>
                      {numInput(taxYearendExpense, setTaxYearendExpense)}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      経費メモ
                    </label>
                    <Input
                      value={taxYearendNote}
                      onChange={(e) => setTaxYearendNote(e.target.value)}
                      placeholder="例：減価償却費 640万円"
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ④ 繰越欠損金（円）
                      </label>
                      {numInput(taxCarryover, setTaxCarryover)}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        実効税率（%）
                      </label>
                      {numInput(taxRate, setTaxRate, "30")}
                    </div>
                  </div>

                  {corpCalc.hasInput && (
                    <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      課税所得見込み：{toMan(corpCalc.taxable).toLocaleString()}万円　
                      法人税概算：{toMan(corpCalc.taxGross).toLocaleString()}万円　
                      <span className="font-semibold text-primary">
                        期末納付見込み：{toMan(corpCalc.taxFinal).toLocaleString()}万円
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ⑥ 予定納税（既納付）（円）
                      </label>
                      {numInput(taxPrepaidDone, setTaxPrepaidDone)}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ⑦ 予定納税（将来納付）（円）
                      </label>
                      {numInput(taxPrepaidFuture, setTaxPrepaidFuture)}
                    </div>
                  </div>

                  <Separator />
                  <p className="text-xs font-semibold text-primary">消費税</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ① 仮受消費税（円）
                      </label>
                      {numInput(ctReceived, setCtReceived)}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        ② 仮払消費税（円）
                      </label>
                      {numInput(ctPaid, setCtPaid)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        中間 第1回（円）
                      </label>
                      {numInput(ctPrepaid1, setCtPrepaid1)}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        第2回（円）
                      </label>
                      {numInput(ctPrepaid2, setCtPrepaid2)}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        第3回（円）
                      </label>
                      {numInput(ctPrepaid3, setCtPrepaid3)}
                    </div>
                  </div>

                  {ctCalc.hasInput && (
                    <div className="rounded-md bg-muted/50 p-2 text-xs">
                      <span className="font-semibold text-primary">
                        消費税 期末納税見込み：
                        {toMan(ctCalc.ctFinal).toLocaleString()}万円
                      </span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* エラー */}
            {errorMsg && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </p>
            )}

            {/* 生成ボタン */}
            <Button
              onClick={handleGenerate}
              disabled={!pdfBase64 || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  報告文を生成する
                </>
              )}
            </Button>

            {!pdfBase64 && (
              <p className="text-center text-xs text-muted-foreground">
                PDFをアップロードすると生成できます
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
