import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders an accessible button with its label", () => {
    render(<Button>Apóyanos</Button>);

    expect(screen.getByRole("button", { name: "Apóyanos" })).toBeInTheDocument();
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Apóyanos</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Apóyanos" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses the 44px touch target by default", () => {
    render(<Button>Apóyanos</Button>);

    expect(screen.getByRole("button")).toHaveClass("h-11");
  });
});
