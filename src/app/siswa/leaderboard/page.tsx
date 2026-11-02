// Halaman Leaderboard (Papan Peringkat Belajar Siswa)

import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getStudentLeaderboard } from "@/lib/support-queries";

export const metadata = {
  title: "Papan Peringkat · Siswa",
  description: "Lihat pencapaian belajar dan peringkat siswa teraktif di LMS.",
};

export default async function SiswaLeaderboardPage() {
  const currentUser = await requireRole("siswa");
  const leaderboard = await getStudentLeaderboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Papan Peringkat (Leaderboard)"
        description="Apresiasi konsistensi belajar siswa di Kota Samarinda. Kumpulkan poin dari sertifikat, nilai ujian, dan video yang selesai dipelajari!"
      />

      {/* Info Aturan Poin */}
      <div className="card p-4 bg-accent-soft/30 border-accent/30 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span className="font-semibold text-foreground">💡 Aturan Poin:</span>
        <span>🏆 Sertifikat Lulus = +100 Poin</span>
        <span>📊 Rata-rata Nilai Ujian = +Skor</span>
        <span>🎥 Video Selesai Ditonton = +10 Poin</span>
      </div>

      {leaderboard.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <span className="text-3xl block mb-2">🏅</span>
          <p className="text-sm font-semibold text-foreground">
            Belum ada data siswa di papan peringkat.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/10 text-xs font-semibold text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 text-center w-16">Peringkat</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3 text-center">Sertifikat</th>
                  <th className="px-4 py-3 text-center">Ujian Lulus</th>
                  <th className="px-4 py-3 text-center">Video</th>
                  <th className="px-4 py-3 text-center">Rata-rata Nilai</th>
                  <th className="px-4 py-3 text-right">Total Poin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard.map((item) => {
                  const isCurrent = item.userId === currentUser.id;
                  const rankBadge =
                    item.rank === 1
                      ? "🥇"
                      : item.rank === 2
                      ? "🥈"
                      : item.rank === 3
                      ? "🥉"
                      : `#${item.rank}`;

                  return (
                    <tr
                      key={item.userId}
                      className={`transition-colors ${
                        isCurrent
                          ? "bg-accent-soft/40 font-semibold"
                          : "hover:bg-muted/5"
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-base">
                        {rankBadge}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                            {item.userName.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-sm text-foreground">
                              {item.userName}
                              {isCurrent && (
                                <span className="ml-2 rounded bg-accent px-1.5 py-0.2 text-[10px] text-white">
                                  Kamu
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded bg-border px-2 py-0.5 text-xs font-semibold">
                          🏆 {item.totalCertificates}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {item.totalPassedQuizzes}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {item.totalWatchedVideos}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-medium">
                        {item.averageScore}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-accent text-base">
                        {item.totalPoints}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
