import { describe, expect, it } from "vitest";
import {
  OpenAIModelSchema,
  OpenAIModelDefaults,
  OfficialApiModelSchema,
  OpenDeploymentModelSchema,
  OpenDeploymentDefaults,
  transformToUniversal,
  resolveModelConfig,
} from "./aimodel-form.utils";
import { ServicePlatform } from "./aimodel-provider.utils";

describe("aimodel-form.utils", () => {
  describe("schemas", () => {
    it("OpenAIModelSchema requires model, url and apiKey", () => {
      expect(
        OpenAIModelSchema.safeParse({
          model: "gpt-4",
          url: "https://api.openai.com",
          apiKey: "sk-x",
        }).success,
      ).toBe(true);
      expect(OpenAIModelSchema.safeParse({ model: "", url: "bad", apiKey: "" }).success).toBe(
        false,
      );
    });

    it("OfficialApiModelSchema validates url format", () => {
      expect(
        OfficialApiModelSchema.safeParse({
          model: "m",
          url: "not-a-url",
          apiKey: "k",
        }).success,
      ).toBe(false);
    });

    it("OpenDeploymentModelSchema requires a deployment name", () => {
      const result = OpenDeploymentModelSchema.safeParse({
        model: "m",
        url: "https://x.com",
        deploymentName: "",
        apiKey: "k",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("defaults", () => {
    it("OpenAIModelDefaults seeds the given model with empty fields", () => {
      expect(OpenAIModelDefaults("gpt-4")).toEqual({
        model: "gpt-4",
        url: "",
        apiKey: "",
        organizationId: "",
        projectId: "",
      });
    });
    it("OpenDeploymentDefaults uses placeholder url and deployment name", () => {
      expect(OpenDeploymentDefaults("m")).toEqual({
        model: "m",
        url: "-",
        deploymentName: "-",
        apiKey: "",
      });
    });
  });

  describe("transformToUniversal", () => {
    it("maps form fields to the create-model payload and applies defaults", () => {
      const result = transformToUniversal("openai", "pk-1", {
        model: "gpt-4",
        apiKey: "sk",
        url: "https://api",
      });
      expect(result).toMatchObject({
        provider: "openai",
        service_platform: ServicePlatform.OFFICIAL_API,
        model_name: "gpt-4",
        api_key: "sk",
        base_url: "https://api",
        project_key: "pk-1",
        DefaultTemp: 0.3,
        MaxTokens: 10922,
        custom_parameters: {},
        custom_headers: {},
      });
    });

    it("respects explicitly provided temperature and tokens", () => {
      const result = transformToUniversal("anthropic", "pk", {
        DefaultTemp: 0.9,
        MaxTokens: 500,
      });
      expect(result.DefaultTemp).toBe(0.9);
      expect(result.MaxTokens).toBe(500);
    });
  });

  describe("resolveModelConfig", () => {
    const options = [{ model: "gpt-4", goodName: "GPT-4" }];

    it("returns the OpenAI config for the openai provider", () => {
      const config = resolveModelConfig("openai", ServicePlatform.OFFICIAL_API, options);
      expect(config.schema).toBe(OpenAIModelSchema);
      expect(config.fields).toContain("organizationId");
      expect(config.defaultValues.model).toBe("gpt-4");
    });

    it("returns the open-deployment config for open platforms", () => {
      const config = resolveModelConfig("azure", ServicePlatform.OPEN_DEPLOYMENT, options);
      expect(config.schema).toBe(OpenDeploymentModelSchema);
      expect(config.fields).toContain("deploymentName");
    });

    it("returns the official-api config as the default", () => {
      const config = resolveModelConfig("anthropic", ServicePlatform.OFFICIAL_API, options);
      expect(config.schema).toBe(OfficialApiModelSchema);
      expect(config.fields).toEqual(["model", "url", "apiKey"]);
    });

    it("uses a placeholder model when there are no options", () => {
      const config = resolveModelConfig("anthropic", ServicePlatform.OFFICIAL_API, []);
      expect(config.defaultValues.model).toBe("--");
    });
  });
});
