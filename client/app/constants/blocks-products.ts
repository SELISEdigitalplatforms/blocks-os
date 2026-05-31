import { getRuntimeEnv } from "@/lib/runtime-env"

export interface BlocksProduct {
  name: string
  appName: string
  badge: string
  tagline: string
  descriptionTitle: string
  keywords: string[]
  shortDescription: string
  description: string
  featureChips: string[]
  url: string
  cta: string
}

export interface LoginCarouselStack {
  name: string
  available: boolean
  links: { label: string; to: string }[]
}

export interface LoginCarouselItem {
  badge: string
  title: string
  description: string
  features: string[]
  url: string
  cta: string
  stacks?: LoginCarouselStack[]
}

export const BLOCKS_PRODUCTS: BlocksProduct[] = [
  {
    name: "blocks-os",
    appName: "blocks OS Platform",
    badge: "Platform Core",
    tagline: "Enterprise platform for secure, scalable applications",
    descriptionTitle: "Backends that are",
    keywords: ["observable", "intelligent", "scalable", "resilient", "secure"],
    shortDescription:
      "A secure plane for your application environment, secrets, and sensitive configuration.",
    description:
      "Blocks OS is a modern platform for building and deploying secure, scalable applications with built-in observability, AI capabilities, and comprehensive identity management. Focus on your application logic while Blocks OS handles infrastructure, auth, and ops.",
    featureChips: [
      "Authentication",
      "Secrets Management",
      "Configuration",
      "API Console",
      "Usage",
      "Logs & Tracing",
    ],
    url: "",
    cta: "Visit blocks OS",
  },
]

export const OS_LOGIN_CAROUSEL: LoginCarouselItem[] = [
  {
    badge: "AI & Knowledge",
    title: "Blocks Agent Platform",
    description:
      "Integrate intelligent agents into any frontend with a single script. Advanced use cases with RAG pipelines, MCP, and custom LLM integrations.",
    features: ["RAG Pipelines", "MCP Support", "Custom LLM", "Knowledge Bases"],
    url: getRuntimeEnv("BLOCKS_AGENTS_BASE_URL"),
    cta: "Visit Agent Platform",
  },
  {
    badge: "Deployments",
    title: "Blocks Cloud Build",
    description:
      "Build, deploy, and scale your applications with automated CI/CD pipelines. Connect GitHub repositories and go live in minutes.",
    features: ["Auto CI/CD", "GitHub Integration", "Multi-env", "Build Logs"],
    url: getRuntimeEnv("BLOCKS_RELEASE_BASE_URL"),
    cta: "Visit Cloud Build",
  },
  {
    badge: "Databases",
    title: "Blocks Data Service",
    description:
      "Provision and manage databases with automatic scaling, backups, and real-time monitoring. Full control without the operational overhead.",
    features: ["Auto Backups", "Auto Scaling", "Query Console", "Monitoring"],
    url: getRuntimeEnv("BLOCKS_DATA_BASE_URL"),
    cta: "Visit Data Service",
  },
  {
    badge: "SDK & CLI",
    title: "Blocks Construct",
    description:
      "Open-source SDKs and CLI tools for React, .NET and more. Scaffold and integrate Blocks services into your projects in minutes.",
    features: ["React SDK", ".NET SDK", "CLI Tooling", "Starter Templates"],
    url: "https://construct.seliseblocks.com",
    cta: "Visit Construct",
    stacks: [
      {
        name: "React",
        available: true,
        links: [
          { label: "npm", to: "https://www.npmjs.com/package/@seliseblocks/cli" },
          {
            label: "GitHub",
            to: "https://github.com/SELISEdigitalplatforms/l3-react-blocks-construct",
          },
        ],
      },
      {
        name: ".NET",
        available: true,
        links: [
          { label: "NuGet", to: "https://www.nuget.org/profiles/SELISE" },
          {
            label: "GitHub",
            to: "https://github.com/SELISEdigitalplatforms/l0-net-blocks-construct",
          },
        ],
      },
      { name: "Angular", available: false, links: [] },
      { name: "Ruby", available: false, links: [] },
    ],
  },
]
