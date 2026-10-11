import { create } from "zustand";
import { createProjectNamingFormDefaultValue } from "./form/create-project-naming-form/utils";
import { Asset } from "./form/create-project-resources-form/utils";
import type { Deployments, WizardSelection } from "./wizard-model";

export type CreateProjectNaming = typeof createProjectNamingFormDefaultValue;

export interface CreateProjectRepositories {
  assets: Asset[];
  /** repository key (see `repositoryKey`) → environments that deploy it. */
  deployments: Deployments;
}

interface ICreateProjectWizardState {
  naming: CreateProjectNaming;
  selection: WizardSelection;
  repositories: CreateProjectRepositories;
  /**
   * The project group, once Create has made it. Kept so a retried payment (declined card, closed
   * card form) reuses the same project instead of creating a second one.
   */
  createdTenantGroupId: string | null;
  setNaming: (naming: CreateProjectNaming) => void;
  setSelection: (selection: Partial<WizardSelection>) => void;
  setRepositories: (repositories: Partial<CreateProjectRepositories>) => void;
  setCreatedTenantGroupId: (tenantGroupId: string | null) => void;
  resetFormData: () => void;
}

const initial = () => ({
  naming: { ...createProjectNamingFormDefaultValue },
  selection: { environments: [], devTier: "free", topUps: {} } as WizardSelection,
  repositories: { assets: [], deployments: {} } as CreateProjectRepositories,
  createdTenantGroupId: null as string | null,
});

export const useCreateProjectFormState = create<ICreateProjectWizardState>((set) => ({
  ...initial(),
  setNaming: (naming) => set({ naming }),
  setSelection: (selection) =>
    set((state) => ({ selection: { ...state.selection, ...selection } })),
  setRepositories: (repositories) =>
    set((state) => ({ repositories: { ...state.repositories, ...repositories } })),
  setCreatedTenantGroupId: (createdTenantGroupId) => set({ createdTenantGroupId }),
  resetFormData: () => set(initial()),
}));

/** A stable key for a picked repository: its provider id, else its full name. */
export const repositoryKey = (asset: Pick<Asset, "id" | "full_name" | "name">) =>
  asset.id !== undefined && asset.id !== 0 ? String(asset.id) : asset.full_name || asset.name;

export const shortGuidGenerator = (length: number): string => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => letters[b % letters.length]).join("");
};
