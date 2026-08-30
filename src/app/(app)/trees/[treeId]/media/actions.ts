"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireTreeEdit } from "@/lib/rbac";
import { treeMediaUsage } from "@/lib/queries/media";
import { displayName } from "@/lib/person";
import {
  MAX_FILE_BYTES,
  TREE_QUOTA_BYTES,
  isAllowedType,
  makeThumbnail,
  humanBytes,
  fileExt,
  buildMediaName,
} from "@/lib/media";

/** Ensure the generated file name is unique within the tree. */
async function uniqueFileName(
  treeId: string,
  make: () => { fileName: string; title: string },
): Promise<{ fileName: string; title: string }> {
  for (let i = 0; i < 5; i++) {
    const cand = make();
    const clash = await db.mediaObject.findFirst({
      where: { treeId, fileName: cand.fileName },
      select: { id: true },
    });
    if (!clash) return cand;
  }
  return make();
}

import { toBytes } from "@/lib/bytes";

export async function uploadMedia(treeId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose at least one file");
  const occasion = String(formData.get("occasion") ?? "").trim().slice(0, 120) || null;

  let usage = await treeMediaUsage(treeId);
  let seq = await db.mediaObject.count({ where: { treeId } });

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" is ${humanBytes(file.size)} — the limit is ${humanBytes(MAX_FILE_BYTES)}`);
    }
    if (!isAllowedType(file.type)) {
      throw new Error(`"${file.name}" has an unsupported type (${file.type || "unknown"})`);
    }
    if (usage + file.size > TREE_QUOTA_BYTES) {
      throw new Error(
        `This tree's media storage is full (${humanBytes(TREE_QUOTA_BYTES)}). Delete some files first.`,
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const thumb = await makeThumbnail(buf, file.type);
    seq += 1;
    const named = await uniqueFileName(treeId, () =>
      buildMediaName({ owner: ctx.tree.name, occasion, seq, ext: fileExt(file.name, file.type) }),
    );

    await db.mediaObject.create({
      data: {
        treeId,
        fileName: named.fileName,
        title: named.title,
        mimeType: file.type || "application/octet-stream",
        byteSize: buf.length,
        bytes: toBytes(buf),
        thumbnail: thumb ? toBytes(thumb.data) : null,
        thumbMime: thumb?.mime ?? null,
        width: thumb?.width ?? null,
        height: thumb?.height ?? null,
        uploadedById: ctx.user.id,
      },
    });
    usage += buf.length;
  }

  revalidatePath(`/trees/${treeId}/media`);
}

export async function deleteMedia(treeId: string, mediaId: string) {
  await requireTreeEdit(treeId);
  const owned = await db.mediaObject.findFirst({ where: { id: mediaId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Media not found");
  await db.mediaObject.delete({ where: { id: mediaId } });
  revalidatePath(`/trees/${treeId}/media`);
}

export async function renameMedia(treeId: string, mediaId: string, formData: FormData) {
  await requireTreeEdit(treeId);
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const owned = await db.mediaObject.findFirst({ where: { id: mediaId, treeId }, select: { id: true } });
  if (!owned) throw new Error("Media not found");
  await db.mediaObject.update({ where: { id: mediaId }, data: { title: title || null } });
  revalidatePath(`/trees/${treeId}/media`);
}

/** Upload one file and attach it directly to a person. */
export async function uploadPersonPhoto(treeId: string, personId: string, formData: FormData) {
  const ctx = await requireTreeEdit(treeId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file");
  if (file.size > MAX_FILE_BYTES) throw new Error(`File exceeds ${humanBytes(MAX_FILE_BYTES)}`);
  if (!isAllowedType(file.type)) throw new Error("Unsupported file type");

  const person = await db.person.findFirst({
    where: { id: personId, treeId },
    select: {
      id: true,
      names: {
        select: {
          first: true, surname: true, surnamePrefix: true, suffix: true, nick: true,
          title: true, preferred: true, type: true, order: true,
        },
      },
    },
  });
  if (!person) throw new Error("Person not found");

  const usage = await treeMediaUsage(treeId);
  if (usage + file.size > TREE_QUOTA_BYTES) throw new Error("Tree media storage is full");

  const buf = Buffer.from(await file.arrayBuffer());
  const thumb = await makeThumbnail(buf, file.type);

  const count = await db.mediaRef.count({ where: { personId } });
  const occasion = String(formData.get("occasion") ?? "").trim().slice(0, 120) || null;
  const owner = displayName(person.names);
  const named = await uniqueFileName(treeId, () =>
    buildMediaName({ owner, occasion, seq: count + 1, ext: fileExt(file.name, file.type) }),
  );

  await db.mediaObject.create({
    data: {
      treeId,
      fileName: named.fileName,
      title: named.title,
      mimeType: file.type || "application/octet-stream",
      byteSize: buf.length,
      bytes: toBytes(buf),
      thumbnail: thumb ? toBytes(thumb.data) : null,
      thumbMime: thumb?.mime ?? null,
      width: thumb?.width ?? null,
      height: thumb?.height ?? null,
      uploadedById: ctx.user.id,
      refs: { create: { personId, order: count, caption: occasion } },
    },
  });
  revalidatePath(`/trees/${treeId}/people/${personId}`);
}

export async function detachPersonMedia(treeId: string, personId: string, mediaRefId: string) {
  await requireTreeEdit(treeId);
  const ref = await db.mediaRef.findFirst({
    where: { id: mediaRefId, personId, media: { treeId } },
    select: { id: true },
  });
  if (!ref) throw new Error("Attachment not found");
  await db.mediaRef.delete({ where: { id: mediaRefId } });
  revalidatePath(`/trees/${treeId}/people/${personId}`);
}
