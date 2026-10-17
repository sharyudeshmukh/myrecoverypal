import { describe, expect, it, vi } from "vitest";
import { garminPayloadSchema, handleGarminIngest } from "../lib/garmin-ingest";

const request = (body: unknown, token?: string) => new Request("http://localhost/api/public/ingest-garmin", {
  method: "POST", headers: token ? { "x-ingest-token": token } : {}, body: JSON.stringify(body),
});
describe("Garmin ingestion", () => {
  it.each([undefined, "wrong-token"])("rejects missing or incorrect tokens without writes: %s", async token => {
    const save = vi.fn();
    const response = await handleGarminIngest(request({ days: [], activities: [] }, token), "test-only-token", save);
    expect(response.status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });
  it("accepts the matching x-ingest-token and returns both counts", async () => {
    const payload = { days: [{ date: "2026-10-17", sleep_score: null }], activities: [{ activity_id: 123, avg_hr: 120 }] };
    const save = vi.fn().mockResolvedValue({ days: 1, activities: 1 });
    const response = await handleGarminIngest(request(payload, "test-only-token"), "test-only-token", save);
    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalledWith(payload);
    expect(await response.json()).toEqual({ days: 1, activities: 1 });
  });
  it("rejects invalid dates before writes", async () => {
    const save = vi.fn();
    const response = await handleGarminIngest(request({ days: [{ date: "2026-02-30" }], activities: [] }, "test-only-token"), "test-only-token", save);
    expect(response.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
  it("preserves nullable metrics and precise bigint IDs", () => {
    const payload = garminPayloadSchema.parse({ days: [{ date: "2026-10-17", hrv_last_night_avg: null }], activities: [{ activity_id: "9223372036854775807", raw: { original: true } }] });
    expect(payload.activities[0]?.activity_id).toBe("9223372036854775807");
    expect(payload.days[0]?.hrv_last_night_avg).toBeNull();
    expect(garminPayloadSchema.safeParse({ days: [], activities: [{ activity_id: 9007199254740992 }] }).success).toBe(false);
  });
  it("reports storage failures without leaking internal errors", async () => {
    const response = await handleGarminIngest(request({ days: [], activities: [] }, "test-only-token"), "test-only-token", async () => { throw new Error("private error"); });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private error");
  });
});