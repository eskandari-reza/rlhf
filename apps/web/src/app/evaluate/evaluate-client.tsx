"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Comparison = {
  comparisonId: string;
  prompt: string;
  a: { text: string };
  b: { text: string };
};
type Choice = "a" | "b" | "tie";

export default function EvaluateClient() {
  const [item, setItem] = useState<Comparison | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/comparisons/next`, { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error(`خطای سرور (${res.status})`);
      const data = await res.json();
      if (data.done) {
        setDone(true);
        setItem(null);
      } else {
        setItem(data);
      }
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  async function submit(choice: Choice) {
    if (!item || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/annotations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comparisonId: item.comparisonId,
          choice,
          reason: reason.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("ثبت انتخاب انجام نشد");
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main  dir="rtl" className="mx-auto max-w-5xl p-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">ارزیابی پاسخ‌ها</h1>

      {loading && <p className="text-muted-foreground">در حال بارگذاری...</p>}
      {error && <p className="mb-4 text-destructive">{error}</p>}

      {done && (
        <Card>
          <CardContent className="py-10 text-center">
            🎉 همه‌ی مقایسه‌ها را ارزیابی کرده‌ای. ممنون!
          </CardContent>
        </Card>
      )}

      {item && !loading && (
        <div className="space-y-4">
          <Card className="bg-muted">
            <CardHeader>
              <CardTitle>پرسش</CardTitle>
            </CardHeader>
            <CardContent>
              <div dir="auto" className="whitespace-pre-wrap">{item.prompt}</div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>پاسخ A</CardTitle>
              </CardHeader>
              <CardContent>
                <div dir="auto" className="whitespace-pre-wrap">{item.a.text}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>پاسخ B</CardTitle>
              </CardHeader>
              <CardContent>
                <div dir="auto" className="whitespace-pre-wrap">{item.b.text}</div>
              </CardContent>
            </Card>
          </div>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل انتخاب (اختیاری)"
            rows={3}
            dir="auto"
          />

          <div className="flex flex-wrap gap-3">
            <Button disabled={submitting} onClick={() => submit("a")}>
              A بهتر است
            </Button>
            <Button variant="outline" disabled={submitting} onClick={() => submit("tie")}>
              مساوی
            </Button>
            <Button disabled={submitting} onClick={() => submit("b")}>
              B بهتر است
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}