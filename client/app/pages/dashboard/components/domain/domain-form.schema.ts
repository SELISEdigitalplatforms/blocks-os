import { z } from "zod";

const domainRegex =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

export const domainFormSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .regex(domainRegex, "Please enter a valid domain (e.g. example.com)"),
  cookieDomain: z
    .string()
    .min(1, "Cookie domain is required")
    .regex(domainRegex, "Please enter a valid domain (e.g. example.com)"),
});

export type DomainFormSchema = z.infer<typeof domainFormSchema>;

export const domainFormDefaultValues: DomainFormSchema = {
  domain: "",
  cookieDomain: "",
};
