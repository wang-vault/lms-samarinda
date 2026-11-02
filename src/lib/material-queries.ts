// Query helper materi: ambil materi + relasi kursus & pembuat
import { db } from "@/db";
import { materials, courses, users } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";

export async function getMaterialsWithRelations() {
  return db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      status: materials.status,
      rejectionReason: materials.rejectionReason,
      createdAt: materials.createdAt,
      approvedAt: materials.approvedAt,
      course: { id: courses.id, title: courses.title },
      creator: { id: users.id, name: users.name },
    })
    .from(materials)
    .leftJoin(courses, eq(materials.courseId, courses.id))
    .leftJoin(users, eq(materials.createdBy, users.id))
    .orderBy(desc(materials.createdAt));
}

export async function getMaterialsByCreator(creatorId: string) {
  return db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      status: materials.status,
      rejectionReason: materials.rejectionReason,
      createdAt: materials.createdAt,
      course: { id: courses.id, title: courses.title },
    })
    .from(materials)
    .leftJoin(courses, eq(materials.courseId, courses.id))
    .where(eq(materials.createdBy, creatorId))
    .orderBy(desc(materials.createdAt));
}

export async function getApprovedMaterials() {
  return db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      content: materials.content,
      filePath: materials.filePath,
      createdAt: materials.createdAt,
      course: { id: courses.id, title: courses.title },
      creator: { id: users.id, name: users.name },
    })
    .from(materials)
    .leftJoin(courses, eq(materials.courseId, courses.id))
    .leftJoin(users, eq(materials.createdBy, users.id))
    .where(eq(materials.status, "approved"))
    .orderBy(asc(materials.createdAt));
}
