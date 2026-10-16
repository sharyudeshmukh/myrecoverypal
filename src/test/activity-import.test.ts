import { describe, expect, it } from "vitest";
import { parseActivities, recoveryFor } from "@/lib/activity-import";

const csv = 'Activity Type,Date,Title,Time,Avg HR,Max HR,Calories,Distance\nRunning,2026-10-14 19:27:45,"Seattle, Running",00:07:10.7,135,150,66,0.52';
describe("Activity import", () => {
  it("preserves recorded fields and missing recovery details", () => {
    expect(parseActivities(csv)[0]).toMatchObject({date: "2026-10-14T19:27:45", type: "Running", title: "Seattle, Running", duration: "00:07:10.7", avg_hr: 135, max_hr: 150, calories: 66, distance: 0.52, muscles: [], intensity: null, sleep: null, soreness: null});
  });
  it("deduplicates identical source activities", () => {
    expect(parseActivities(csv + '\n' + csv.split('\n')[1])).toHaveLength(1);
  });
  it("does not treat missing recovery details as measured fatigue", () => {
    const row = parseActivities(csv)[0];
    if (!row) throw new Error("Expected a parsed activity");
    expect(recoveryFor("Quads", [{...row, id: "1", muscles: ["Quads"]}], new Date(row.date).getTime())).toBe(100);
  });
  it("rejects the wrong file format", () => {
    expect(() => parseActivities("Name,Value\nA,1")).toThrow();
  });
});