import { z } from "zod";
import { isParsableUrl } from "@/lib/url-format";
import { tStatic } from "@seliseblocks/genesis-os";

export interface Asset {
  id?: number;
  name: string;
  html_url: string;
  full_name: string;
}

export const CreateProjectResourcesFormDefaultValue: { assets: Asset[] } = {
  assets: [],
};

export const createCreateProjectResourcesFormSchema = () =>
  z.object({
    assets: z
      .array(
        z.object({
          id: z.number().optional(),
          name: z.string().min(1, tStatic("os.create-project", "UTILS.ASSET_NAME_IS_REQUIRED")),
          html_url: z
            .string()
            .refine(isParsableUrl, tStatic("os.create-project", "UTILS.LINK_MUST_BE_A_VALID")),
          full_name: z.string().optional(),
        }),
      )
      .optional(),
  });
