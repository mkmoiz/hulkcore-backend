import { describe, expect, it } from "vitest";

import {
  NAV_ITEM_TYPES,
  buildPublishedNavMenu,
  filterVisibleNavItems,
  normalizeNavMenuItems,
  normalizeNavMenuMeta,
} from "./navMenu.js";

describe("nav menu normalization", () => {
  it("normalizes positions across items, groups, and links", () => {
    const payload = [
      {
        label: "Offers",
        type: "LINK",
        href: "/offers",
        position: 8,
      },
      {
        label: "All Products",
        type: "DROPDOWN",
        position: 1,
        dropdownGroups: [
          {
            title: "Shop",
            position: 6,
            links: [
              { label: "Whey", href: "/products/whey", position: 3 },
              { label: "Creatine", href: "/products/creatine", position: 0 },
            ],
          },
        ],
      },
    ];

    const normalized = normalizeNavMenuItems(payload);
    expect(normalized.error).toBeUndefined();
    expect(normalized.value?.[0].label).toBe("All Products");
    expect(normalized.value?.[0].position).toBe(0);
    expect(normalized.value?.[1].label).toBe("Offers");
    expect(normalized.value?.[1].position).toBe(1);
    expect(normalized.value?.[0].dropdownGroups[0].position).toBe(0);
    expect(normalized.value?.[0].dropdownGroups[0].links[0].label).toBe("Creatine");
    expect(normalized.value?.[0].dropdownGroups[0].links[0].position).toBe(0);
  });

  it("rejects LINK items without href", () => {
    const normalized = normalizeNavMenuItems([
      {
        label: "Offers",
        type: NAV_ITEM_TYPES.LINK,
      },
    ]);

    expect(normalized.error).toMatch(/href is required/i);
  });

  it("rejects DROPDOWN items without group+link", () => {
    const normalized = normalizeNavMenuItems([
      {
        label: "All Products",
        type: NAV_ITEM_TYPES.DROPDOWN,
        dropdownGroups: [],
      },
    ]);

    expect(normalized.error).toMatch(/must have at least one group and one link/i);
  });

  it("filters hidden items for published payload", () => {
    const draftItems = [
      {
        id: "item_1",
        label: "Visible",
        type: NAV_ITEM_TYPES.LINK,
        href: "/visible",
        target: "_self",
        position: 0,
        isVisible: true,
        icon: "",
      },
      {
        id: "item_2",
        label: "Hidden",
        type: NAV_ITEM_TYPES.LINK,
        href: "/hidden",
        target: "_self",
        position: 1,
        isVisible: false,
        icon: "",
      },
    ];

    const visible = filterVisibleNavItems(draftItems);
    expect(visible).toHaveLength(1);
    expect(visible[0].label).toBe("Visible");

    const published = buildPublishedNavMenu(
      {
        id: "menu_1",
        key: "main_secondary",
        name: "Main Secondary",
        version: 3,
        isActive: true,
      },
      draftItems,
      new Date("2026-03-03T12:00:00.000Z").toISOString(),
    );

    expect(published.items).toHaveLength(1);
    expect(published.items[0].label).toBe("Visible");
    expect(published.version).toBe(3);
  });

  it("validates menu meta payload", () => {
    const valid = normalizeNavMenuMeta({ key: "main_secondary", name: "Main Secondary" });
    expect(valid.error).toBeUndefined();
    expect(valid.value?.key).toBe("main_secondary");

    const invalid = normalizeNavMenuMeta({ key: "INVALID KEY", name: "Bad" });
    expect(invalid.error).toMatch(/menu key/i);
  });
});
