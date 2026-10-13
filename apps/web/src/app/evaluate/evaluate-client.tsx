"use client";

import { useCallback, useEffect, useState } from "react";

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

  const box: React.CSSProperties = {
    flex: 1,
    minWidth: 280,
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: 16,
    whiteSpace: "pre-wrap",
  };

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>ارزیابی پاسخ‌ها</h1>

      {loading && <p>در حال بارگذاری...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {done && <p>🎉 همه‌ی مقایسه‌ها را ارزیابی کرده‌ای. ممنون!</p>}

      {item && !loading && (
        <>
          <section style={{ ...box, flex: "none", background: "#f6f6f6", marginBottom: 16 }}>
  <         strong>پرسش:</strong>
            <div dir="auto">{item.prompt}</div>
          </section>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <section style={box}>
              <strong>پاسخ A</strong>
              <div dir="auto">{item.a.text}</div>
            </section>
            <section style={box}>
              <strong>پاسخ B</strong>
              <div dir="auto">{item.b.text}</div>
            </section>
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل انتخاب (اختیاری)"
            rows={3}
            dir="auto"
            style={{ width: "100%", marginTop: 16, padding: 8 }}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button disabled={submitting} onClick={() => submit("a")}>A بهتر است</button>
            <button disabled={submitting} onClick={() => submit("tie")}>مساوی</button>
            <button disabled={submitting} onClick={() => submit("b")}>B بهتر است</button>
          </div>
        </>
      )}
    </main>
  );
}