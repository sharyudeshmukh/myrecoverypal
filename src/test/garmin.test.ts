import { describe, expect, it } from "vitest";
import { parseGarmin, mergeGarmin, fitnessInsights } from "@/lib/garmin";

describe("Garmin wellness", () => {
  it("reads monthly VO2 export with its extra column", () => {
    expect(parseGarmin('﻿VO₂ Max,\n,VO₂ Max\nDec 2025,VO₂ Max,43\nOct 2026,VO₂ Max,47').wellness).toEqual([{metric:"VO₂ max",period:"monthly",date:"2025-12-01",values:{"VO₂ Max":43}},{metric:"VO₂ max",period:"monthly",date:"2026-10-01",values:{"VO₂ Max":47}}]);
  });
  it("keeps weekly steps as weekly totals rather than daily averages", () => {
    const data = parseGarmin('﻿,Actual\n10/10/2026,42000');
    expect(data.wellness[0]).toMatchObject({period:"weekly",date:"2026-10-10",values:{Actual:42000}});
    expect(fitnessInsights([],data.wellness,"2026-10-16").weeklySteps).toBe(42000);
  });
  it("does not infer current readiness from stale daily battery", () => {
    const data = parseGarmin('﻿,Daily High,Daily Low\n10/01/2026,80,20');
    expect(fitnessInsights([],data.wellness,"2026-10-16").freshBattery).toBeNull();
  });
  it("deduplicates wellness rows across repeated files", () => {
    const data = parseGarmin('﻿,Stress\n10/10/2026,21');
    expect(mergeGarmin([data,data]).wellness).toHaveLength(1);
  });
  it("filters measurements older than one year", () => {
    const data = parseGarmin('﻿,Stress\n10/10/2025,21\n10/10/2026,25');
    expect(fitnessInsights([],data.wellness,"2026-10-16").stress).toEqual([{date:"2026-10-10",value:25}]);
  });
  it("reads intensity targets from the exported values", () => {
    const data = parseGarmin('Intensity Minutes\n,Actual,Value\n2026-10-05,160,150\n2026-10-12,100,150');
    expect(fitnessInsights([],data.wellness,"2026-10-16").notes[0]?.text).toContain('1 of 1');
  });
});