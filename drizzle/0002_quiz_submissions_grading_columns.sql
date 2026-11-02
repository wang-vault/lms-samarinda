-- Tambah kolom penilaian essay pada quiz_submissions.
-- `graded` = essay sudah dinilai instruktur (atau quiz tidak punya soal essay).
-- `essay_feedback` = JSON penilaian essay: [{ questionId, points, comment }].
ALTER TABLE `quiz_submissions` ADD `graded` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_submissions` ADD `essay_feedback` text;
