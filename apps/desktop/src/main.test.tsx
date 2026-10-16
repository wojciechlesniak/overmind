import { createRoot, type Root } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("react-dom/client", () => ({ createRoot: vi.fn() }));
beforeEach(() => {
  vi.resetModules();
  document.body.replaceChildren();
});
it("boots into the existing root element", async () => {
  const element = document.createElement("div");
  element.id = "root";
  document.body.append(element);
  const root = { render: vi.fn<Root["render"]>(), unmount: vi.fn<Root["unmount"]>() };
  vi.mocked(createRoot).mockReturnValue(root);
  await import("./main.tsx");
  expect(createRoot).toHaveBeenCalledWith(element);
  expect(root.render).toHaveBeenCalledOnce();
});
it("fails explicitly before mounting when the root element is missing", async () => {
  await expect(import("./main.tsx")).rejects.toThrow("Missing application root element");
  expect(createRoot).not.toHaveBeenCalled();
});
