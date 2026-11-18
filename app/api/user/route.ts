import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { updateProfileSchema } from "@/lib/validations/user";

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_payload",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const values: {
    name?: string;
    nickname?: string | null;
    allowModelFallbackOnFailure?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) {
    values.name = parsed.data.name;
  }

  if (parsed.data.nickname !== undefined) {
    values.nickname =
      parsed.data.nickname === "" ? null : parsed.data.nickname;
  }

  if (parsed.data.allowModelFallbackOnFailure !== undefined) {
    values.allowModelFallbackOnFailure = parsed.data.allowModelFallbackOnFailure;
  }

  try {
    const [updated] = await db
      .update(users)
      .set(values)
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        name: users.name,
        nickname: users.nickname,
        email: users.email,
        image: users.image,
        allowModelFallbackOnFailure: users.allowModelFallbackOnFailure,
      });

    if (!updated) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    return Response.json({ user: updated });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
