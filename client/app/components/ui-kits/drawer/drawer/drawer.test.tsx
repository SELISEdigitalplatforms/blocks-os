import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "./drawer";

describe("Drawer", () => {
  it("renders the header, footer, title and description inside an open drawer", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer title</DrawerTitle>
            <DrawerDescription>Drawer description</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <button>Footer action</button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );
    expect(screen.getByText("Drawer title")).toBeTruthy();
    expect(screen.getByText("Drawer description")).toBeTruthy();
    expect(screen.getByText("Footer action")).toBeTruthy();
  });

  it("merges custom class names onto the content", () => {
    render(
      <Drawer open>
        <DrawerContent className="custom-drawer">
          <DrawerTitle>Titled</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    expect(document.querySelector(".custom-drawer")).toBeTruthy();
  });
});
