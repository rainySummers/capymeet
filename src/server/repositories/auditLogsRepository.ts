export async function writeAuditLog(
  db: D1Database,
  input: {
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  },
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      input.actorType,
      input.actorId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata),
      input.createdAt,
    )
    .run();
}
