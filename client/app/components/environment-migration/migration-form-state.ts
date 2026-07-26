import { create } from "zustand";
import {
  environmentServiceSelectionFormDefaultValue,
  reviewConfirmFormDefaultValue,
} from "@/components/environment-migration/migration-form-schema";

export type EnvironmentServiceSelectionFormValues =
  typeof environmentServiceSelectionFormDefaultValue;
export type ReviewConfirmFormValues = typeof reviewConfirmFormDefaultValue;

export type MigrationFormData = [EnvironmentServiceSelectionFormValues, ReviewConfirmFormValues];

type MigrationFormState = {
  formData: MigrationFormData;
  setFormData: {
    (index: 0, data: EnvironmentServiceSelectionFormValues): void;
    (index: 1, data: ReviewConfirmFormValues): void;
  };
  resetFormData: () => void;
};

export const useDataMigrationFormState = create<MigrationFormState>((set) => ({
  formData: [environmentServiceSelectionFormDefaultValue, reviewConfirmFormDefaultValue],
  setFormData: (index, data) => {
    set((state) => {
      if (index === 0) {
        return {
          formData: [data as EnvironmentServiceSelectionFormValues, state.formData[1]],
        };
      }
      return {
        formData: [state.formData[0], data as ReviewConfirmFormValues],
      };
    });
  },
  resetFormData: () => {
    set({
      formData: [environmentServiceSelectionFormDefaultValue, reviewConfirmFormDefaultValue],
    });
  },
}));
