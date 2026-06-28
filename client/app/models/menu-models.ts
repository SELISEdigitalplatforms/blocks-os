import { type LucideIcon } from "lucide-react";

export type Menu =
  | {
      type: "menu";
      id: string;
      name: string;
      path: string;
      icon?: LucideIcon;
      children?: Menu[];
      disabled?: boolean;
      badge?: "alpha" | "beta" | "new";
      desc?: string;
    }
  | {
      type: "separator";
      id: string;
    };
