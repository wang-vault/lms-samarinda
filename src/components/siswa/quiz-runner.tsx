"use client";

// Komponen pengerjaan ujian: timer hitung mundur, auto-save draft,
// auto-submit saat waktu habis, lalu skor otomatis (PG) & status essay.

import { useCallback, useEffect, useRef, useState } from "react";
import { saveQuizAnswersAction, submitQuizAction } from "@/actions/quizzes";
import type {
  AttemptReview,
  ReviewItem,
  StudentQuiz,
} from "@/lib/quiz-queries";

type AnswerMap = Record<string, string | number | null>;

/** Format detik ke "MM:SS" atau "HH:MM:SS". */
function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

export function QuizRunner({
  quiz,
  draft,
  attempts,
}: {
  quiz: StudentQuiz;
  draft: { answers: AnswerMap; startedAtMs: number } | null;
  attempts: AttemptReview[];
}) {
  // Waktu mulai: pakai waktu draft bila ada (melanjutkan), jika tidak buat baru.
  const [startedAtMs] = useState<number>(
    () => draft?.startedAtMs ?? Date.now()
  );
  const [answers, setAnswers] = useState<AnswerMap>(() => draft?.answers ?? {});
  const [locked, setLocked] = useState<boolean>(false);

  const answersRef = useRef<AnswerMap>(answers);
  answersRef.current = answers;
  const startedAtRef = useRef<number>(startedAtMs);
  startedAtRef.current = startedAtMs;

  const deadlineMs = startedAtMs + quiz.durationMinutes * 60_000;

  // ---- Submit (sekali saja; dipakai baik tombol Kumpulkan maupun auto) ----
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const doSubmit = useCallback(
    async (forced: boolean) => {
      if (locked || submitting) return;
      const ok =
        forced ||
        window.confirm(
          "Yakin ingin mengumpulkan ujian? Jawaban akan dikunci dan dinilai."
        );
      if (!ok) return;
      setSubmitting(true);
      try {
        const res = await submitQuizAction(
          quiz.id,
          answersRef.current,
          startedAtRef.current
        );
        if (res.error) {
          setSubmitError(res.error);
          return;
        }
        setLocked(true);
        setResult({
          score: res.score ?? 0,
          passed: Boolean(res.passed),
        });
        setRefreshKey((k) => k + 1);
      } finally {
        setSubmitting(false);
      }
    },
    [locked, submitting, quiz.id]
  );

  // ---- Timer hitung mundur + auto-submit saat habis ----
  const [remaining, setRemaining] = useState<number>(
    () => Math.floor((deadlineMs - Date.now()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      const rem = Math.floor((deadlineMs - Date.now()) / 1000);
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(id);
        // Waktu habis → submit paksa di sisi client.
        void doSubmit(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, doSubmit]);

  // ---- Auto-save draft setiap 30 detik saat ada perubahan ----
  const dirtyRef = useRef<boolean>(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    dirtyRef.current = true;
  }, [answers]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!dirtyRef.current || locked) return;
      dirtyRef.current = false;
      saveQuizAnswersAction(quiz.id, answersRef.current)
        .then((res) => {
          if (res.error) setSaveError(res.error);
          else {
            setSaveError(null);
            setSavedAt(Date.now());
          }
        })
        .catch(() => setSaveError("Gagal menyimpan jawaban."));
    }, 30_000);
    return () => clearInterval(id);
  }, [locked, quiz.id]);

  // ---- Beforeunload: ingatkan saat meninggalkan halaman saat mengerjakan ----
  useEffect(() => {
    if (locked) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [locked]);

  // ---- Handler jawaban ----
  function setPg(questionId: string, idx: number) {
    if (locked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: idx }));
  }

  function setEssay(questionId: string, text: string) {
    if (locked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  }

  // ---- Tampilan hasil setelah submit ----
  if (result || submitError) {
    return (
      <div className="space-y-6">
        {result && (
          <div className="card p-6 text-center">
            <div className="mb-2 text-4xl">
              {quiz.hasEssay ? "📋" : result.passed ? "🎉" : "📋"}
            </div>
            <h2 className="mb-1 text-lg font-bold">Ujian dikumpulkan!</h2>
            <p className="mb-4 text-sm text-muted">
              {quiz.hasEssay
                ? "Soal pilihan ganda sudah dinilai otomatis. Soal essay sedang menunggu penilaian instruktur."
                : "Seluruh soal sudah dinilai otomatis."}
            </p>
            <div className="inline-block rounded-xl bg-gray-50 px-6 py-4 dark:bg-gray-900">
              <p className="text-3xl font-bold">{result.score}</p>
              <p className="text-xs text-muted">
                Skor {quiz.hasEssay ? "sementara (pilihan ganda)" : "akhir"} •
                KKM {quiz.passingScore}
              </p>
            </div>
            {quiz.hasEssay && (
              <p className="mt-3 text-xs text-muted">
                Nilai akhir & status kelulusan akan muncul setelah instruktur
                menilai essay.
              </p>
            )}
            {!quiz.hasEssay && (
              <p
                className={
                  "mt-2 text-sm font-medium " +
                  (result.passed
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400")
                }
              >
                {result.passed
                  ? "Selamat, kamu LULUS ujian ini!"
                  : "Belum lulus. Kamu bisa mengulang ujian ini lagi."}
              </p>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="btn-secondary text-sm"
              >
                Muat ulang riwayat
              </button>
            </div>
          </div>
        )}
        {submitError && !result && (
          <div className="card p-6 text-center">
            <div className="mb-2 text-4xl">⚠️</div>
            <h2 className="mb-1 text-lg font-bold">Gagal mengumpulkan</h2>
            <p className="text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
            <p className="mt-2 text-xs text-muted">
              {submitError === "Waktu ujian sudah habis."
                ? "Waktu ujian telah berakhir dan jawabanmu tidak bisa dikumpulkan. Silakan mulai attempt baru."
                : "Silakan coba beberapa saat lagi."}
            </p>
          </div>
        )}

        <QuizHistory
          key={refreshKey}
          quiz={quiz}
          attempts={attempts}
          justSubmittedScore={result?.score ?? null}
          interactive
        />
      </div>
    );
  }

  // ---- Tampilan pengerjaan ----
  const answeredCount = quiz.questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && a !== "";
  }).length;
  const low = remaining <= 60;

  return (
    <div className="space-y-6">
      <div className="card sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-semibold">{quiz.title}</h2>
          <p className="text-xs text-muted">
            {answeredCount} dari {quiz.questions.length} soal terjawab
          </p>
        </div>
        <div
          className={
            "rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums " +
            (low
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300")
          }
          role="timer"
          aria-label="Sisa waktu ujian"
        >
          ⏱ {formatDuration(remaining)}
        </div>
        <button
          type="button"
          onClick={() => doSubmit(false)}
          disabled={submitting}
          className="btn-primary text-sm"
        >
          {submitting ? "Mengumpulkan…" : "Kumpulkan"}
        </button>
      </div>

      {(saveError || savedAt) && (
        <p className="text-xs text-muted">
          {saveError ? (
            <span className="text-amber-600 dark:text-amber-400">
              Gagal auto-save: {saveError}
            </span>
          ) : (
            <span>Jawaban tersimpan otomatis.</span>
          )}
        </p>
      )}

      <div className="space-y-4">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="card p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Soal {i + 1}
              </span>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">
                {q.type === "pilihan_ganda" ? "Pilihan Ganda" : "Essay"}
              </span>
              <span className="text-muted">{q.points} poin</span>
            </div>
            <p className="mb-4 whitespace-pre-wrap font-medium">{q.question}</p>

            {q.type === "pilihan_ganda" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, idx) => {
                  const selected = answers[q.id] === idx;
                  return (
                    <label
                      key={idx}
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors " +
                        (selected
                          ? "border-accent bg-accent-soft"
                          : "border-border hover:bg-gray-50 dark:hover:bg-gray-900")
                      }
                    >
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        checked={selected}
                        onChange={() => setPg(q.id, idx)}
                        disabled={locked}
                        className="size-4 shrink-0 accent-accent"
                      />
                      <span className="font-medium text-muted">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === "essay" && (
              <textarea
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setEssay(q.id, e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Tulis jawabanmu di sini..."
                disabled={locked}
                className="input-field resize-none"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => doSubmit(false)}
          disabled={submitting}
          className="btn-primary text-sm"
        >
          {submitting ? "Mengumpulkan…" : "Kumpulkan Ujian"}
        </button>
      </div>

      {/* Riwayat attempt tampil bersama form. Detail review disembunyikan
          (interactive=false) supaya kunci jawaban attempt sebelumnya tidak
          terbongkar saat sedang mengerjakan attempt baru. */}
      <QuizHistory
        key={"static-" + refreshKey}
        quiz={quiz}
        attempts={attempts}
        justSubmittedScore={null}
      />
    </div>
  );
}

/** Riwayat attempt (semua disimpan) + review jawaban per attempt. */
function QuizHistory({
  attempts,
  justSubmittedScore,
  interactive = false,
}: {
  quiz: StudentQuiz;
  attempts: AttemptReview[];
  justSubmittedScore: number | null;
  // true = sedang menampilkan hasil submit (boleh membuka detail review).
  // false = dipasang di samping form pengerjaan; detail review disembunyikan
  // agar kunci jawaban attempt sebelumnya tidak bocor saat mengerjakan.
  interactive?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (attempts.length === 0 && justSubmittedScore === null) {
    return null;
  }

  // Urutkan dari yang terbaru
  const sorted = attempts.slice().reverse();

  return (
    <div className="card p-6">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span>🕘</span> Riwayat Pengerjaan ({attempts.length})
      </h2>
      {attempts.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Attempt barumu sedang disimpan. Muat ulang halaman untuk melihat
          detail riwayat.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((a, revIdx) => {
            const attemptNo = attempts.length - revIdx;
            const open = interactive && openId === a.id;
            return (
              <div
                key={a.id}
                className="rounded-lg border border-border p-3"
              >
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : a.id)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm"
                    aria-expanded={open}
                  >
                    <AttemptSummary a={a} attemptNo={attemptNo} />
                    <span className="text-xs text-muted">
                      {new Date(a.submittedAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      {open ? "▲" : "▼"}
                    </span>
                  </button>
                ) : (
                  <div className="flex w-full items-center justify-between gap-2 text-sm">
                    <AttemptSummary a={a} attemptNo={attemptNo} />
                    <span className="text-xs text-muted">
                      {new Date(a.submittedAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
                {open && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {a.items.map((item, i) => (
                      <ReviewRow key={item.questionId} item={item} no={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Kamu bisa mengulang ujian ini sebanyak yang kamu mau; semua attempt
        tetap tersimpan.
      </p>
    </div>
  );
}

/** Ringkasan satu baris attempt: nomor, nilai, status kelulusan. */
function AttemptSummary({
  a,
  attemptNo,
}: {
  a: AttemptReview;
  attemptNo: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">Attempt {attemptNo}</span>
      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        Nilai: {a.score}
      </span>
      {a.graded ? (
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs " +
            (a.passed
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300")
          }
        >
          {a.passed ? "Lulus" : "Tidak Lulus"}
        </span>
      ) : (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Menunggu penilaian
        </span>
      )}
    </div>
  );
}

/** Satu baris review jawaban untuk satu soal. */
function ReviewRow({ item, no }: { item: ReviewItem; no: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Soal {no}
        </span>
        {item.type === "pilihan_ganda" ? (
          item.isCorrect ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300">
              Benar
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300">
              Salah
            </span>
          )
        ) : item.feedback ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
            Dinilai: {item.feedback.points}/{item.points} poin
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Menunggu penilaian
          </span>
        )}
      </div>
      <p className="mb-1 font-medium whitespace-pre-wrap">{item.question}</p>
      <p className="text-muted">
        Jawaban kamu:{" "}
        {item.userAnswerText ? (
          <span className="whitespace-pre-wrap text-foreground">
            {item.userAnswerText}
          </span>
        ) : (
          <span className="italic">(tidak dijawab)</span>
        )}
      </p>
      {item.type === "pilihan_ganda" &&
        item.correctIndex !== null &&
        !item.isCorrect &&
        item.options && (
          <p className="mt-1 text-green-700 dark:text-green-400">
            Jawaban benar: {String.fromCharCode(65 + item.correctIndex)}.{" "}
            {item.options[item.correctIndex]}
          </p>
        )}
      {item.type === "essay" && item.modelAnswer && (
        <p className="mt-1 text-muted">
          Jawaban model:{" "}
          <span className="whitespace-pre-wrap">{item.modelAnswer}</span>
        </p>
      )}
      {item.type === "essay" && item.feedback?.comment && (
        <p className="mt-1 text-muted">
          Komentar instruktur: {item.feedback.comment}
        </p>
      )}
    </div>
  );
}
