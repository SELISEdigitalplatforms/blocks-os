import { FilterToolbar } from "@/components/filter-toolbar";
import { useAIModelsQueryParams } from "@blocks-ai/hooks/use-aimodel";
import { useT } from "@seliseblocks/genesis-os";
export function AIModelsFilterToolbar() {
  const { t } = useT("os.ai");
  const { queryParams, setQueryParams } = useAIModelsQueryParams();
  const changeHandler = (key: string, value: unknown) => {
    setQueryParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };
  const resetHandler = () => setQueryParams(null);
  return (
    <FilterToolbar
      filters={[
        { key: "search", type: "SearchInput", label: "" },
        {
          key: "types",
          type: "MultiSelect",
          label: t("common:TYPE"),
          props: {
            options: [
              { label: t("AIMODEL_FILTER_TOOLBAR.OFFICIAL_API"), value: "official" },
              { label: t("AIMODEL_FILTER_TOOLBAR.OPEN_DEPLOYMENT"), value: "open" },
            ],
          },
        },
      ]}
      values={{
        search: queryParams.search,
        types: queryParams.types,
      }}
      defaultValues={{
        search: "",
        types: [],
      }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
