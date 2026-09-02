import cfg from "../../tailwind.config";

describe("design tokens", () => {
  it("defines the redesign tokens", () => {
    const c = (cfg as any).theme.extend.colors;
    expect(c.primary?.DEFAULT || c.primary).toBeTruthy();

    const fontFamily = (cfg as any).theme.extend.fontFamily;
    expect(fontFamily.sans).toBeDefined();
    expect(Array.isArray(fontFamily.sans)).toBe(true);
  });
});
