import { db } from "@/lib/db";
import { linkToken, slugify, randomToken } from "@/lib/slug";
import { normalizePhone, isValidPhone } from "@/lib/wa";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { createBarePerson } from "@/lib/person-write";
import { orderPair } from "@/lib/relationships";
import { NAME_SELECT } from "@/lib/person";

export const FRIEND_INVITE_DAYS = 30;

export async function createFriendInvite(input: {
  fromTreeId: string;
  fromPersonId: string;
  inviterUserId: string;
  name: string;
  phone?: string | null;
  roleHint?: string;
  originText?: string | null;
  originContext?: string | null;
  originViaPersonId?: string | null;
}): Promise<string> {
  const name = input.name.trim().slice(0, 120);
  if (name.length < 2) throw new Error("Enter the friend's name");
  const phone = input.phone && isValidPhone(input.phone) ? normalizePhone(input.phone) : null;

  const inv = await db.friendInvite.create({
    data: {
      token: linkToken(),
      fromTreeId: input.fromTreeId,
      fromPersonId: input.fromPersonId,
      inviterUserId: input.inviterUserId,
      inviteeName: name,
      inviteePhone: phone,
      roleHint: input.roleHint || "friend",
      originText: input.originText?.trim().slice(0, 2000) || null,
      originContext: input.originContext || null,
      originViaPersonId: input.originViaPersonId || null,
      expiresAt: new Date(Date.now() + FRIEND_INVITE_DAYS * 864e5),
    },
    select: { token: true },
  });
  return inv.token;
}

/**
 * Guarantee `userId` has a personal tree with a node for themselves, and
 * return it. Uses an already-claimed profile if there is one, else the first
 * owned tree's home person, else seeds a fresh one-node tree.
 */
export async function ensureSelfTree(
  userId: string,
  name: string,
  phone: string | null,
): Promise<{ treeId: string; personId: string }> {
  const claimed = await db.person.findFirst({
    where: { claimedByUserId: userId },
    select: { id: true, treeId: true },
  });
  if (claimed) return { treeId: claimed.treeId, personId: claimed.id };

  await ensurePersonalWorkspace(userId, name);
  const ws = await db.membership.findFirstOrThrow({
    where: { userId, role: "OWNER" },
    select: { workspaceId: true },
  });

  let tree = await db.tree.findFirst({
    where: { workspaceId: ws.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, homePersonId: true },
  });

  if (!tree) {
    const first = name.split(" ")[0] || name;
    const base = slugify(`${first}-family`) || "family";
    let slug = base;
    for (let i = 0; i < 5; i++) {
      const clash = await db.tree.findFirst({
        where: { workspaceId: ws.workspaceId, slug },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${base}-${randomToken(4)}`;
    }
    tree = await db.tree.create({
      data: { workspaceId: ws.workspaceId, name: `${first}'s family`, slug, adminUserId: userId },
      select: { id: true, homePersonId: true },
    });
  }

  if (tree.homePersonId) {
    const hp = await db.person.findUnique({
      where: { id: tree.homePersonId },
      select: { id: true, claimedByUserId: true },
    });
    if (hp && (!hp.claimedByUserId || hp.claimedByUserId === userId)) {
      await db.person.update({
        where: { id: hp.id },
        data: { claimedByUserId: userId, phone: phone ?? undefined },
      });
      return { treeId: tree.id, personId: hp.id };
    }
  }

  const [first, ...rest] = name.split(" ");
  const person = await createBarePerson(tree.id, {
    first: first || name,
    surname: rest.join(" ") || undefined,
    living: true,
  });
  await db.tree.update({ where: { id: tree.id }, data: { homePersonId: person.id } });
  await db.person.update({
    where: { id: person.id },
    data: { claimedByUserId: userId, phone: phone ?? undefined },
  });
  return { treeId: tree.id, personId: person.id };
}

export type AcceptFriendResult = {
  linkId: string;
  friendTreeId: string;
  friendPersonId: string;
  fromTreeId: string;
};

/** The friend (now signed in as `friendUserId`) accepts — seeds their tree if
 *  needed and creates the cross-tree link. */
export async function acceptFriendInvite(
  token: string,
  friendUserId: string,
): Promise<AcceptFriendResult> {
  const inv = await db.friendInvite.findUnique({
    where: { token },
    select: {
      id: true, status: true, expiresAt: true,
      fromTreeId: true, fromPersonId: true, inviterUserId: true,
      inviteeName: true, inviteePhone: true, roleHint: true,
      originText: true, originContext: true, originViaPersonId: true,
    },
  });
  if (!inv) throw new Error("This link is not valid");
  if (inv.status !== "PENDING") throw new Error("This link has already been used");
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) throw new Error("This link has expired");

  const me = await db.user.findUniqueOrThrow({
    where: { id: friendUserId },
    select: { name: true, phone: true },
  });
  const self = await ensureSelfTree(
    friendUserId,
    me.name ?? inv.inviteeName,
    me.phone ?? inv.inviteePhone,
  );
  if (self.personId === inv.fromPersonId) throw new Error("That's your own profile");

  const [aP, bP] = orderPair(inv.fromPersonId, self.personId);
  const aTree = aP === inv.fromPersonId ? inv.fromTreeId : self.treeId;
  const bTree = bP === inv.fromPersonId ? inv.fromTreeId : self.treeId;

  const link = await db.friendLink.upsert({
    where: { aPersonId_bPersonId: { aPersonId: aP, bPersonId: bP } },
    create: {
      aPersonId: aP, aTreeId: aTree, bPersonId: bP, bTreeId: bTree,
      roles: [inv.roleHint],
      originText: inv.originText,
      originContext: inv.originContext ?? "friend-of-friend",
      originViaPersonId: inv.originViaPersonId,
      invitedByUserId: inv.inviterUserId,
    },
    update: {},
    select: { id: true },
  });

  for (const byPersonId of [inv.fromPersonId, self.personId]) {
    await db.friendLinkAssertion.upsert({
      where: { linkId_byPersonId: { linkId: link.id, byPersonId } },
      create: { linkId: link.id, byPersonId, role: inv.roleHint },
      update: {},
    });
  }

  await db.friendInvite.update({
    where: { id: inv.id },
    data: { status: "ACCEPTED", acceptedPersonId: self.personId, linkId: link.id },
  });

  return {
    linkId: link.id,
    friendTreeId: self.treeId,
    friendPersonId: self.personId,
    fromTreeId: inv.fromTreeId,
  };
}

/** Friend links touching a person — the other side's name + which family. */
export async function friendLinksForPerson(personId: string) {
  const links = await db.friendLink.findMany({
    where: { OR: [{ aPersonId: personId }, { bPersonId: personId }] },
    orderBy: { score: "desc" },
    select: {
      id: true,
      roles: true,
      score: true,
      originText: true,
      originContext: true,
      createdAt: true,
      aPerson: { select: { id: true, gender: true, names: { select: NAME_SELECT }, tree: { select: { name: true } } } },
      bPerson: { select: { id: true, gender: true, names: { select: NAME_SELECT }, tree: { select: { name: true } } } },
      assertions: { select: { byPersonId: true } },
    },
  });

  return links.map((l) => {
    const other = l.aPerson.id === personId ? l.bPerson : l.aPerson;
    return {
      linkId: l.id,
      person: { id: other.id, gender: other.gender, names: other.names },
      familyName: other.tree.name,
      roles: l.roles,
      score: l.score,
      originText: l.originText,
      originContext: l.originContext,
      reciprocated: l.assertions.length >= 2,
    };
  });
}

export function pendingFriendInvites(treeId: string) {
  return db.friendInvite.findMany({
    where: { fromTreeId: treeId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, inviteeName: true, roleHint: true, fromPersonId: true, createdAt: true },
  });
}
