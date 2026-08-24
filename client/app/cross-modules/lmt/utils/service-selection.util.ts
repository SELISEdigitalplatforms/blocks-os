/**
 * The logs page keeps its service selection in a single `service` query param so a
 * filtered view stays shareable. One or more services are encoded as
 * "<serviceId>[::<component>[,<component>]][;<serviceId>...]" — a bare service id means
 * the whole service, an id with components means it is narrowed to those components.
 *
 * The service filter renders a checkbox tree whose option values live in a flat
 * namespace ("<serviceId>" for a parent, "<serviceId>::<component>" for a child), so the
 * helpers here translate between that namespace and the query param.
 */
export type ServiceSelection = {
  serviceId: string;
  components: string[];
};

const GROUP_SEPARATOR = ";";
const COMPONENT_SEPARATOR = ",";
const COMPONENT_PREFIX = "::";

export const parseServiceKey = (serviceKey: string): ServiceSelection[] => {
  if (!serviceKey) return [];
  const selections: ServiceSelection[] = [];
  for (const group of serviceKey.split(GROUP_SEPARATOR)) {
    const [serviceId, components] = group.split(COMPONENT_PREFIX);
    if (!serviceId) continue;
    const parsedComponents = components
      ? components.split(COMPONENT_SEPARATOR).filter(Boolean)
      : [];
    // A service repeated in the key (hand-edited URL) keeps one entry with both sets.
    const existing = selections.find((selection) => selection.serviceId === serviceId);
    if (existing) {
      existing.components = [...new Set([...existing.components, ...parsedComponents])];
      continue;
    }
    selections.push({ serviceId, components: parsedComponents });
  }
  return selections;
};

export const buildServiceKey = (selections: ServiceSelection[]): string =>
  selections
    .filter((selection) => !!selection.serviceId)
    .map(({ serviceId, components }) =>
      components.length
        ? `${serviceId}${COMPONENT_PREFIX}${components.join(COMPONENT_SEPARATOR)}`
        : serviceId,
    )
    .join(GROUP_SEPARATOR);

/** Query param → checkbox-tree option values. */
export const serviceKeyToTreeValues = (serviceKey: string): string[] =>
  parseServiceKey(serviceKey).flatMap(({ serviceId, components }) =>
    components.length
      ? components.map((component) => `${serviceId}${COMPONENT_PREFIX}${component}`)
      : [serviceId],
  );

/** Checkbox-tree option values → query param. */
export const treeValuesToServiceKey = (treeValues: string[]): string => {
  const selections: ServiceSelection[] = [];
  for (const treeValue of treeValues) {
    const [serviceId, component] = treeValue.split(COMPONENT_PREFIX);
    if (!serviceId) continue;
    let selection = selections.find((item) => item.serviceId === serviceId);
    if (!selection) {
      selection = { serviceId, components: [] };
      selections.push(selection);
    }
    if (component && !selection.components.includes(component)) {
      selection.components.push(component);
    }
  }
  return buildServiceKey(selections);
};
