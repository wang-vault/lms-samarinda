"use client";

// Komponen formulir & thread interaktif Forum Diskusi

import { useState, useTransition } from "react";
import { createForumPostAction, deleteForumPostAction } from "@/actions/support";
import type { ForumPostWithAuthor } from "@/lib/support-queries";

export function ForumThreadList({
  courseId,
  currentUserId,
  currentUserRole,
  threads,
}: {
  courseId: string;
  currentUserId: string;
  currentUserRole: string;
  threads: ForumPostWithAuthor[];
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreatePost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("courseId", courseId);

    startTransition(async () => {
      const res = await createForumPostAction(null, formData);
      if (!res.ok) {
        setActionError(res.error || "Gagal mengirim diskusi.");
      } else {
        form.reset();
      }
    });
  };

  const handleCreateReply = (e: React.FormEvent<HTMLFormElement>, parentId: string) => {
    e.preventDefault();
    setActionError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("courseId", courseId);
    formData.append("parentId", parentId);

    startTransition(async () => {
      const res = await createForumPostAction(null, formData);
      if (!res.ok) {
        setActionError(res.error || "Gagal mengirim balasan.");
      } else {
        form.reset();
        setReplyingTo(null);
      }
    });
  };

  const handleDeletePost = (postId: string) => {
    if (!confirm("Hapus diskusi ini?")) return;
    startTransition(async () => {
      const res = await deleteForumPostAction(postId, courseId);
      if (!res.ok) {
        setActionError(res.error || "Gagal menghapus diskusi.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Form Buat Topik Utama */}
      <div className="card p-4 sm:p-5">
        <h3 className="text-base font-bold text-foreground mb-1">
          Mulai Diskusi Baru
        </h3>
        <p className="text-xs text-muted mb-3">
          Tanyakan materi kursus, bagikan ide bisnis, atau diskusikan studi kasus dengan peserta dan instruktur lain.
        </p>

        {actionError && (
          <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
            ⚠️ {actionError}
          </div>
        )}

        <form onSubmit={handleCreatePost} className="space-y-3">
          <textarea
            name="content"
            required
            rows={3}
            placeholder="Tuliskan pertanyaan atau topik diskusimu di sini..."
            className="input-field text-sm leading-relaxed"
            disabled={isPending}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <span>💬</span> {isPending ? "Mengirim..." : "Kirim Diskusi"}
            </button>
          </div>
        </form>
      </div>

      {/* Daftar Thread */}
      <div className="space-y-4">
        {threads.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <span className="text-3xl block mb-2">💬</span>
            <p className="text-sm font-semibold text-foreground">
              Belum ada diskusi untuk kursus ini.
            </p>
            <p className="text-xs mt-1">
              Jadilah orang pertama yang memulai percakapan dan bertukar ide!
            </p>
          </div>
        ) : (
          threads.map((thread) => (
            <div key={thread.id} className="card p-4 sm:p-5 space-y-3">
              {/* Header Post Utama */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {thread.userName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {thread.userName}
                      </p>
                      <span className="rounded bg-accent-soft px-1.5 py-0.2 text-[10px] font-semibold text-accent capitalize">
                        {thread.userRole}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(thread.createdAt))}
                    </p>
                  </div>
                </div>

                {/* Tombol Hapus jika milik user atau admin */}
                {(thread.userId === currentUserId || currentUserRole === "admin") && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(thread.id)}
                    disabled={isPending}
                    className="text-xs text-muted hover:text-red-500 transition-colors"
                    title="Hapus diskusi"
                  >
                    🗑️
                  </button>
                )}
              </div>

              {/* Konten Post Utama */}
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-10">
                {thread.content}
              </p>

              {/* Tombol Balas */}
              <div className="pl-10 flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setReplyingTo(replyingTo === thread.id ? null : thread.id)
                  }
                  className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>↩</span> {replyingTo === thread.id ? "Batal" : "Balas"}
                </button>
                <span className="text-[11px] text-muted">
                  {thread.replies?.length || 0} balasan
                </span>
              </div>

              {/* Form Balasan */}
              {replyingTo === thread.id && (
                <form
                  onSubmit={(e) => handleCreateReply(e, thread.id)}
                  className="pl-10 pt-2 space-y-2"
                >
                  <textarea
                    name="content"
                    required
                    rows={2}
                    placeholder={`Balas ${thread.userName}...`}
                    className="input-field text-xs"
                    disabled={isPending}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="btn-primary text-xs py-1 px-2.5"
                    >
                      Kirim Balasan
                    </button>
                  </div>
                </form>
              )}

              {/* Daftar Balasan */}
              {thread.replies && thread.replies.length > 0 && (
                <div className="mt-3 ml-6 sm:ml-10 border-l-2 border-border pl-3 sm:pl-4 space-y-3 pt-1">
                  {thread.replies.map((reply) => (
                    <div key={reply.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-border text-[10px] font-bold text-foreground">
                            {reply.userName.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {reply.userName}
                          </span>
                          <span className="rounded bg-border px-1 py-0.2 text-[9px] text-muted capitalize">
                            {reply.userRole}
                          </span>
                          <span className="text-[10px] text-muted">
                            {new Intl.DateTimeFormat("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(reply.createdAt))}
                          </span>
                        </div>

                        {(reply.userId === currentUserId ||
                          currentUserRole === "admin") && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(reply.id)}
                            disabled={isPending}
                            className="text-[11px] text-muted hover:text-red-500"
                            title="Hapus balasan"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed pl-8">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
