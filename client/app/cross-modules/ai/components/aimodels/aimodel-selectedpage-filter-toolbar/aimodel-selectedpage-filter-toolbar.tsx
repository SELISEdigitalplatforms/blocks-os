import { FilterToolbar } from "@/components/filter-toolbar";
import { useAIModelsQueryParams } from "@blocks-ai/hooks/use-aimodel";
import { useT } from "@seliseblocks/genesis-os";
type ModelsFilter = {
  search: string;
};
export const AIModelsSelectedPageFilterToolbar = () => {
  const { t } = useT("os.ai");
  const {
    queryParams: { search },
    setQueryParams,
  } = useAIModelsQueryParams();
  const changeHandler = (key: string, value: string) => {
    setQueryParams((params) => ({ ...params, [key]: value }));
  };
  const resetHandler = () => {
    setQueryParams(null);
  };
  return (
    <FilterToolbar<ModelsFilter>
      filters={[{ key: "search", type: "SearchInput", label: t("common:SEARCH") }]}
      values={{ search }}
      defaultValues={{ search: "" }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
};
