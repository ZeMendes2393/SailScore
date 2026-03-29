"use client";

import Rule42Manager from "@/components/rule42/Rule42Manager";

export default function Rule42({ regattaId }: { regattaId: number }) {
  return <Rule42Manager regattaId={regattaId} />;
}
