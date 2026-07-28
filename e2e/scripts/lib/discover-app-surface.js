const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { nodeIdForRoute, repoRoot, toPosix } = require("./common");

const routerPath = path.join(repoRoot, "client/app/router.tsx");
const navigationMenusPath = path.join(repoRoot, "client/app/constants/navigation-menus.ts");

function sourceFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function textOf(node, sf) {
  return node ? node.getText(sf).replace(/^["'`]|["'`]$/g, "") : undefined;
}

function stringLiteralValue(node, sf) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  return textOf(node, sf);
}

function propertyName(prop, sf) {
  if (!prop.name) return undefined;
  if (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name)) return prop.name.text;
  return prop.name.getText(sf);
}

function objectProp(objectNode, name, sf) {
  return objectNode.properties.find(
    (prop) => ts.isPropertyAssignment(prop) && propertyName(prop, sf) === name,
  )?.initializer;
}

function boolProp(objectNode, name, sf) {
  const value = objectProp(objectNode, name, sf);
  return value?.kind === ts.SyntaxKind.TrueKeyword;
}

function normalizeRoute(route) {
  if (!route || route === "/") return "/";
  return route.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function joinRoute(parent, child) {
  if (!child) return normalizeRoute(parent || "/");
  if (child.startsWith("/")) return normalizeRoute(child);
  return normalizeRoute(`${parent || ""}/${child}`);
}

function resolveRedirect(fromRoute, to) {
  if (!to) return undefined;
  if (to.startsWith("/")) {
    const normalizedTo = normalizeRoute(to);
    const scopedMatch = normalizeRoute(fromRoute).match(/^\/app\/:itemId\/([^/]+)/);
    const targetMatch = normalizedTo.match(/^\/app\/([^/]+)(\/.*)?$/);
    if (scopedMatch && targetMatch && scopedMatch[1] === targetMatch[1]) {
      return normalizeRoute(`/app/:itemId/${targetMatch[1]}${targetMatch[2] || ""}`);
    }
    return normalizedTo;
  }
  const baseParts = normalizeRoute(fromRoute).split("/").filter(Boolean);
  const toParts = to.split("/");
  for (const part of toParts) {
    if (!part || part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }
  return normalizeRoute(`/${baseParts.join("/")}`);
}

function jsxTagName(node) {
  if (!node) return undefined;
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isParenthesizedExpression(node)) return jsxTagName(node.expression);
  return undefined;
}

function jsxAttributeValue(node, attrName) {
  const attrs = ts.isJsxSelfClosingElement(node)
    ? node.attributes.properties
    : ts.isJsxElement(node)
      ? node.openingElement.attributes.properties
      : [];
  for (const attr of attrs) {
    if (!ts.isJsxAttribute(attr) || attr.name.text !== attrName || !attr.initializer) continue;
    if (ts.isStringLiteralLike(attr.initializer)) return attr.initializer.text;
  }
  return undefined;
}

function discoverRouterNodes() {
  const sf = sourceFile(routerPath);
  const nodesByRoute = new Map();
  const redirects = [];

  function addNode(route, patch = {}) {
    const canonicalRoute = normalizeRoute(route);
    const existing = nodesByRoute.get(canonicalRoute) || {
      id: nodeIdForRoute(canonicalRoute),
      label: canonicalRoute,
      kind: "route",
      canonicalRoute,
      source: "router.tsx",
    };
    nodesByRoute.set(canonicalRoute, { ...existing, ...patch });
  }

  function visitRouteArray(arrayNode, parentRoute) {
    for (const element of arrayNode.elements) {
      if (!ts.isObjectLiteralExpression(element)) continue;
      const pathNode = objectProp(element, "path", sf);
      const routePath = stringLiteralValue(pathNode, sf);
      const isIndex = boolProp(element, "index", sf);
      const route = isIndex ? normalizeRoute(parentRoute) : joinRoute(parentRoute, routePath);
      const elementNode = objectProp(element, "element", sf);
      const tag = jsxTagName(elementNode);

      if (routePath || isIndex) {
        if (tag === "Navigate") {
          const target = resolveRedirect(route, jsxAttributeValue(elementNode, "to"));
          redirects.push({ route, target });
          addNode(route, {
            id: nodeIdForRoute(route),
            label: `${route} redirect`,
            kind: "redirect",
            canonicalRoute: route,
            redirectsToRoute: target,
          });
        } else {
          addNode(route);
        }
      }

      const children = objectProp(element, "children", sf);
      if (children && ts.isArrayLiteralExpression(children)) visitRouteArray(children, route);
    }
  }

  function walk(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sf) === "createBrowserRouter" &&
      node.arguments[0] &&
      ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      visitRouteArray(node.arguments[0], "");
    }
    ts.forEachChild(node, walk);
  }

  walk(sf);

  const routeToId = new Map([...nodesByRoute.values()].map((node) => [node.canonicalRoute, node.id]));
  for (const redirect of redirects) {
    const node = nodesByRoute.get(redirect.route);
    if (node && redirect.target) node.redirectsTo = routeToId.get(redirect.target) || nodeIdForRoute(redirect.target);
    delete node?.redirectsToRoute;
  }

  return [...nodesByRoute.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function discoverMenuMetadata() {
  const sf = sourceFile(navigationMenusPath);
  const menus = [];

  function readMenuObject(node) {
    if (!ts.isObjectLiteralExpression(node)) return;
    const type = stringLiteralValue(objectProp(node, "type", sf), sf);
    if (type && type !== "menu") return;
    const route = stringLiteralValue(objectProp(node, "path", sf), sf);
    const id = stringLiteralValue(objectProp(node, "id", sf), sf);
    const name = stringLiteralValue(objectProp(node, "name", sf), sf);
    const desc = stringLiteralValue(objectProp(node, "desc", sf), sf);
    if (route) menus.push({ menuId: id, menuPath: route, label: name || route, desc });
    const children = objectProp(node, "children", sf);
    if (children && ts.isArrayLiteralExpression(children)) {
      for (const child of children.elements) readMenuObject(child);
    }
  }

  function walk(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sf) === "navigationMenus" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const element of node.initializer.elements) readMenuObject(element);
    }
    ts.forEachChild(node, walk);
  }

  walk(sf);
  return menus;
}

function menuMatchesRoute(menuPath, canonicalRoute) {
  const scoped = canonicalRoute.replace(/^\/app\/:itemId/, "/app").replace(/^\/app\/project\/:tenantGroupId/, "/app/project");
  return scoped === menuPath || scoped.startsWith(`${menuPath}/`);
}

function discoverAppSurface() {
  const nodes = discoverRouterNodes();
  const menus = discoverMenuMetadata();
  for (const node of nodes) {
    const menu = menus.find((candidate) => menuMatchesRoute(candidate.menuPath, node.canonicalRoute));
    if (menu) {
      node.label = menu.label;
      node.menu = {
        id: menu.menuId,
        path: menu.menuPath,
        sidebarVisible: true,
      };
      if (menu.desc) node.description = menu.desc;
    }
  }

  return {
    generatedFrom: [toPosix(path.relative(repoRoot, routerPath)), toPosix(path.relative(repoRoot, navigationMenusPath))],
    nodes,
  };
}

module.exports = {
  discoverAppSurface,
  normalizeRoute,
  joinRoute,
  resolveRedirect,
};
