import { describe, expect, it } from "vitest";
import { hasGpu, isSoftwareRenderer } from "../../../src/lib/utils/gpu";

describe("isSoftwareRenderer", () => {
  it("spots the CPU rasterisers", () => {
    expect(isSoftwareRenderer("Google SwiftShader")).toBe(true);
    expect(isSoftwareRenderer("llvmpipe (LLVM 17.0.6, 256 bits)")).toBe(true);
    expect(isSoftwareRenderer("Microsoft Basic Render Driver")).toBe(true);
  });

  it("leaves real cards alone", () => {
    expect(isSoftwareRenderer("AMD Radeon RX 7900 XTX (radeonsi)")).toBe(false);
    expect(isSoftwareRenderer("NVIDIA GeForce RTX 4070/PCIe/SSE2")).toBe(false);
    expect(isSoftwareRenderer("Apple M2 Pro")).toBe(false);
  });

  it("says no GPU where there is no browser to ask", () => {
    expect(hasGpu()).toBe(false);
  });
});
