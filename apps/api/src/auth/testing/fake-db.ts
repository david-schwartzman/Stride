// In-memory stand-in for the handful of PrismaService calls the auth module
// (apps/api/src/auth/) makes, so its unit tests run without Postgres. session.db.test.ts covers the
// real database when TEST_DATABASE_URL is set.

import { Prisma } from "@prisma/client";

type Row = Record<string, unknown>;
type Range = { gt?: Date; gte?: Date; lt?: Date };
type Membership = { in?: unknown[]; notIn?: unknown[] };
type Where = Record<string, unknown>;

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([field, condition]) => {
    const value = row[field];
    if (condition instanceof Date)
      return (value as Date).getTime() === condition.getTime();
    if (
      condition &&
      typeof condition === "object" &&
      ("in" in condition || "notIn" in condition)
    ) {
      const { in: within, notIn } = condition as Membership;
      return (
        (!within || within.includes(value)) &&
        (!notIn || !notIn.includes(value))
      );
    }
    if (condition && typeof condition === "object") {
      const { gt, gte, lt } = condition as Range;
      const time = (value as Date).getTime();
      return (
        (!gt || time > gt.getTime()) &&
        (!gte || time >= gte.getTime()) &&
        (!lt || time < lt.getTime())
      );
    }
    return value === condition;
  });
}

function sortBy(rows: Row[], orderBy?: Record<string, "asc" | "desc">): Row[] {
  if (!orderBy) return rows;
  const [[field, direction]] = Object.entries(orderBy);
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      sign * ((a[field] as Date).getTime() - (b[field] as Date).getTime()),
  );
}

let nextId = 0;

export function createFakeDb() {
  const tables = {
    user: [] as Row[],
    session: [] as Row[],
    authAttempt: [] as Row[],
  };

  function model(
    name: keyof typeof tables,
    defaults: () => Row,
    unique: string[] = [],
  ) {
    const rows = () => tables[name];
    return {
      async create({ data }: { data: Row }) {
        const row = { ...defaults(), ...data };
        const clash = unique.find((field) =>
          rows().some((r) => r[field] === row[field]),
        );
        if (clash) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            { code: "P2002", clientVersion: "fake", meta: { target: [clash] } },
          );
        }
        tables[name].push(row);
        return { ...row };
      },
      async createMany({ data }: { data: Row[] }) {
        for (const item of data) tables[name].push({ ...defaults(), ...item });
        return { count: data.length };
      },
      async findUnique({
        where,
        include,
      }: {
        where: Where;
        include?: { user?: { select: Record<string, boolean> } };
      }) {
        const row = rows().find((r) => matches(r, where));
        if (!row) return null;
        if (!include?.user) return { ...row };
        const user = tables.user.find((u) => u.id === row.userId)!;
        const selected = Object.fromEntries(
          Object.keys(include.user.select).map((key) => [key, user[key]]),
        );
        return { ...row, user: selected };
      },
      async findMany({
        where,
        orderBy,
        take,
      }: {
        where?: Where;
        orderBy?: Record<string, "asc" | "desc">;
        take?: number;
      } = {}) {
        const found = sortBy(
          rows().filter((r) => matches(r, where)),
          orderBy,
        );
        return found.slice(0, take ?? found.length).map((r) => ({ ...r }));
      },
      async findFirst(args: {
        where?: Where;
        orderBy?: Record<string, "asc" | "desc">;
      }) {
        const [first] = await this.findMany({ ...args, take: 1 });
        return first ?? null;
      },
      async count({ where }: { where?: Where } = {}) {
        return rows().filter((r) => matches(r, where)).length;
      },
      async update({ where, data }: { where: Where; data: Row }) {
        const row = rows().find((r) => matches(r, where));
        if (!row) throw new Error(`fake-db: no ${name} to update`);
        Object.assign(row, data);
        return { ...row };
      },
      async updateMany({ where, data }: { where: Where; data: Row }) {
        const found = rows().filter((r) => matches(r, where));
        for (const row of found) Object.assign(row, data);
        return { count: found.length };
      },
      async deleteMany({ where }: { where?: Where } = {}) {
        const before = rows().length;
        tables[name] = rows().filter((r) => !matches(r, where));
        return { count: before - tables[name].length };
      },
    };
  }

  return {
    tables,
    user: model(
      "user",
      () => ({ id: `user_${++nextId}`, createdAt: new Date() }),
      ["email"],
    ),
    session: model("session", () => ({
      createdAt: new Date(),
      lastSeenAt: new Date(),
    })),
    authAttempt: model("authAttempt", () => ({
      id: `attempt_${++nextId}`,
      createdAt: new Date(),
    })),
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
