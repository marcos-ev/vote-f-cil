import { describe, it, expect } from "vitest";
import { bindSquadRoom, resolveSquadRoomId } from "@/lib/squad-room";

describe("squad-room mapping", () => {
  it("reusa a sala já vinculada para a mesma squad", () => {
    localStorage.clear();

    const squadId = "squad-1";
    const roomId = resolveSquadRoomId(squadId);
    const secondRead = resolveSquadRoomId(squadId);

    expect(secondRead).toBe(roomId);
  });

  it("permite sobrescrever vínculo de sala manualmente", () => {
    localStorage.clear();

    const squadId = "squad-2";
    bindSquadRoom(squadId, "abc123");

    expect(resolveSquadRoomId(squadId)).toBe("abc123");
  });
});
