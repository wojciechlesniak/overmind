import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App.tsx";

it("renders the placeholder in the application main landmark", () => {
  render(<App />);
  expect(screen.getByRole("main")).toBe(screen.getByTestId("app-root"));
  expect(screen.getByRole("main")).toHaveTextContent("Overmind");
});
