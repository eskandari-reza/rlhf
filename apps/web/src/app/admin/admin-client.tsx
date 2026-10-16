"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Item = {
  prompt: string;
  language?: string;
  responses: { text: string; source?: string }[];
};

type RaterRow = {
  email: string;
  voted: number;
  comparable: number;
  agreementRate: number | null;
  share: { a: number; b: number; tie: number };
};

type Agreement = {
  raters: number;
  items: number;
  skipped: number;
  kappa: number | null;
  level?: string;
  observedAgreement?: number;
  expectedAgreement?: number;
  categoryShare?: { a: number; b: number; tie: number };
  message?: string;
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AdminClient() {
  // آپلود
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState("");
  const [uploading, setUploading] = useState(false);

  // خروجی
  const [minVotes, setMinVotes] = useState(1);

  // توافق
  const [raters, setRaters] = useState(3);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [agreementError, setAgreementError] = useState("");
  const [raterRows, setRaterRows] = useState<RaterRow[] | null>(null);
  const [raterError, setRaterError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setItems([]);
    setErrors([]);
    setResult("");
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const ok: Item[] = [];
    const bad: string[] = [];

    lines.forEach((line, i) => {
      try {
        const obj = JSON.parse(line);
        if (
          typeof obj.prompt !== "string" ||
          !Array.isArray(obj.responses) ||
          obj.responses.length < 2 ||
          obj.responses.some((r: { text?: unknown }) => typeof r.text !== "string")
        ) {
          bad.push(`خط ${i + 1}: ساختار نادرست (prompt و حداقل دو responses با text لازم است)`);
        } else {
          ok.push(obj);
        }
      } catch {
        bad.push(`خط ${i + 1}: JSON معتبر نیست`);
      }
    });

    setItems(ok);
    setErrors(bad);
  }

  async function upload() {
    if (!items.length || uploading) return;
    setUploading(true);
    setResult("");
    try {
      const res = await fetch(`${API}/admin/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (res.status === 403) throw new Error("دسترسی ادمین ندارید");
      if (!res.ok) throw new Error(`خطای سرور (${res.status})`);
      const data = await res.json();
      setResult(`✅ ${data.prompts} پرسش و ${data.comparisons} مقایسه اضافه شد.`);
      setItems([]);
    } catch (e) {
      setResult(`❌ ${e instanceof Error ? e.message : "خطای ناشناخته"}`);
    } finally {
      setUploading(false);
    }
  }

  async function loadAgreement() {
    setAgreement(null);
    setAgreementError("");
    try {
      const res = await fetch(`${API}/admin/agreement?raters=${raters}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`خطای سرور (${res.status})`);
      setAgreement(await res.json());
    } catch (e) {
      setAgreementError(e instanceof Error ? e.message : "خطای ناشناخته");
    }
  }

  async function loadRaters() {
    setRaterRows(null);
    setRaterError("");
    try {
      const res = await fetch(`${API}/admin/raters?minVotes=${raters}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`خطای سرور (${res.status})`);
      const data = await res.json();
      setRaterRows(data.raters);
    } catch (e) {
      setRaterError(e instanceof Error ? e.message : "خطای ناشناخته");
    }
  }

  return (
    <main  dir="rtl"className="mx-auto max-w-4xl space-y-6 p-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">پنل ادمین</h1>
        <Button asChild variant="ghost">
          <Link href="/dashboard">بازگشت به داشبورد</Link>
        </Button>
      </div>

      {/* آپلود */}
      <Card>
        <CardHeader>
          <CardTitle>آپلود داده</CardTitle>
          <CardDescription>فایل JSONL بده؛ هر خط یک پرسش با پاسخ‌هایش.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".jsonl,.json,.txt" onChange={onFile} />

          {items.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {items.length} خط معتبر آماده‌ی آپلود است.
            </p>
          )}
          {errors.length > 0 && (
            <ul className="list-disc space-y-1 ps-5 text-sm text-destructive">
              {errors.slice(0, 10).map((m) => (
                <li key={m}>{m}</li>
              ))}
              {errors.length > 10 && <li>و {errors.length - 10} خطای دیگر...</li>}
            </ul>
          )}

          <Button onClick={upload} disabled={!items.length || uploading}>
            {uploading ? "در حال آپلود..." : "آپلود"}
          </Button>
          {result && <p className="text-sm">{result}</p>}
        </CardContent>
      </Card>

      {/* خروجی آموزش */}
      <Card>
        <CardHeader>
          <CardTitle>خروجی برای آموزش</CardTitle>
          <CardDescription>
            هر مقایسه یک خط با فیلدهای chosen و rejected؛ مقایسه‌های مساوی حذف می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="minVotes">حداقل رأی برای هر مقایسه</Label>
            <Input
              id="minVotes"
              type="number"
              min={1}
              value={minVotes}
              onChange={(e) => setMinVotes(Math.max(1, Number(e.target.value) || 1))}
              className="w-28"
            />
          </div>
          <Button asChild>
            <a href={`${API}/admin/export?minVotes=${minVotes}`}>دانلود JSONL</a>
          </Button>
        </CardContent>
      </Card>

      {/* توافق ارزیاب‌ها */}
      <Card>
        <CardHeader>
          <CardTitle>توافق ارزیاب‌ها</CardTitle>
          <CardDescription>
            Fleiss&apos; Kappa برای کل دیتاست، و توافق هر ارزیاب با بقیه. با داده‌ی کم، عددها قابل اعتماد نیستند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="raters">تعداد رأی برای هر مقایسه</Label>
              <Input
                id="raters"
                type="number"
                min={2}
                value={raters}
                onChange={(e) => setRaters(Math.max(2, Number(e.target.value) || 2))}
                className="w-28"
              />
            </div>
            <Button onClick={loadAgreement}>محاسبه‌ی کاپا</Button>
            <Button variant="outline" onClick={loadRaters}>
              تحلیل ارزیاب‌ها
            </Button>
          </div>

          {agreementError && <p className="text-sm text-destructive">{agreementError}</p>}
          {agreement && (
            <div className="rounded-lg border border-border bg-muted p-4">
              {agreement.kappa === null ? (
                <p className="text-sm">
                  {agreement.message ?? agreement.level ?? "کاپا قابل محاسبه نیست."}
                </p>
              ) : (
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">Kappa</div>
                    <div className="text-2xl font-bold" dir="ltr">
                      {agreement.kappa.toFixed(2)}
                    </div>
                    <div>{agreement.level}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">مقایسه‌ها</div>
                    <div className="text-2xl font-bold">{agreement.items}</div>
                    <div>{agreement.skipped} مقایسه رأی کم داشت</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">توافق مشاهده / شانسی</div>
                    <div className="text-2xl font-bold" dir="ltr">
                      {pct(agreement.observedAgreement ?? 0)} / {pct(agreement.expectedAgreement ?? 0)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {raterError && <p className="text-sm text-destructive">{raterError}</p>}
          {raterRows && (
            <div className="overflow-x-auto">
              <Table dir="ltr">
                <TableHeader>
                  <TableRow>
                    <TableHead>ارزیاب</TableHead>
                    <TableHead>رأی‌ها</TableHead>
                    <TableHead>قابل مقایسه</TableHead>
                    <TableHead>توافق</TableHead>
                    <TableHead>A</TableHead>
                    <TableHead>B</TableHead>
                    <TableHead>مساوی</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raterRows.map((r) => {
                    const low =
                      r.agreementRate !== null && r.comparable >= 10 && r.agreementRate < 0.6;
                    return (
                      <TableRow key={r.email} className={low ? "bg-destructive/10" : undefined}>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{r.voted}</TableCell>
                        <TableCell>{r.comparable}</TableCell>
                        <TableCell>
                          {r.agreementRate === null ? "—" : pct(r.agreementRate)}
                        </TableCell>
                        <TableCell>{pct(r.share.a)}</TableCell>
                        <TableCell>{pct(r.share.b)}</TableCell>
                        <TableCell>{pct(r.share.tie)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                ردیف قرمز: توافق زیر ۶۰٪ با حداقل ۱۰ مقایسه‌ی قابل مقایسه.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}