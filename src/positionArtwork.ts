const MAX_METADATA_BYTES = 512 * 1024;
const MAX_SVG_BYTES = 256 * 1024;
const SVG_DATA_PREFIX = "data:image/svg+xml;base64,";

const allowedTags = new Set([
  "svg",
  "rect",
  "g",
  "text",
  "defs",
  "pattern",
  "circle",
  "clipPath",
  "path",
]);

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function decodeBase64(value: string) {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    return undefined;
  }
  try {
    const bytes = Uint8Array.from(atob(value), (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function hasSafeSvgMarkup(svg: string) {
  if (!isSafeSvgText(svg)) return false;

  const tokens = svg.match(/<[^>]*>|[^<]+/g);
  return Boolean(tokens?.length && validateSvgTokens(tokens));
}

function validateSvgTokens(tokens: string[]) {
  const state = { stack: [] as string[], rootSeen: false };
  for (const token of tokens) {
    if (!validateSvgToken(token, state)) return false;
  }
  return state.rootSeen && state.stack.length === 0;
}

function validateSvgToken(
  token: string,
  state: { stack: string[]; rootSeen: boolean },
) {
  if (!token.startsWith("<")) return !/[<>]/.test(token);
  if (token.startsWith("</")) return closeSvgTag(token, state.stack);
  const match = token.match(/^<([A-Za-z][\w.-]*)([\s\S]*?)(\/?)>$/);
  if (!match) return false;
  const [, name, attributes, selfClosing] = match;
  if (!isSafeSvgOpeningTag(name, attributes)) return false;
  if (name === "svg") {
    if (!isValidSvgRoot(state.rootSeen, state.stack, attributes)) return false;
    state.rootSeen = true;
  } else if (!state.rootSeen) return false;
  if (!selfClosing) state.stack.push(name);
  return true;
}

function isSafeSvgText(svg: string) {
  return (
    byteLength(svg) <= MAX_SVG_BYTES &&
    !/<!DOCTYPE|<!ENTITY|<\?xml|<!--[\s\S]*?-->/i.test(svg) &&
    !/&(?:#\d+|#x[\da-f]+|[a-z][\w-]+);/i.test(svg)
  );
}

function closeSvgTag(token: string, stack: string[]) {
  const name = token.match(/^<\/([A-Za-z][\w.-]*)\s*>$/)?.[1];
  return Boolean(name && stack.pop() === name);
}

function isSafeSvgOpeningTag(name: string, attributes: string) {
  if (attributes.includes("\\")) return false;
  if (
    !allowedTags.has(name) ||
    /\bon[a-z]+\s*=|\b(?:href|xlink:href|style)\s*=/i.test(attributes)
  )
    return false;
  const urls = attributes.match(/url\(\s*([^)]*)\)/gi) ?? [];
  if (urls.some((url) => !/^url\(\s*#[\w.-]+\s*\)$/i.test(url))) return false;
  const withoutNamespace = attributes.replace(/xmlns\s*=\s*"[^"]*"/gi, "");
  return !/\b(?:https?|file|javascript|data):/i.test(withoutNamespace);
}

function isValidSvgRoot(
  rootSeen: boolean,
  stack: string[],
  attributes: string,
) {
  return (
    !rootSeen &&
    stack.length === 0 &&
    /\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(attributes)
  );
}

function decodeMetadata(metadata: string) {
  const prefix = "data:application/json;base64,";
  if (!metadata.startsWith(prefix)) return undefined;
  const decoded = decodeBase64(metadata.slice(prefix.length));
  if (!decoded) return undefined;
  try {
    return JSON.parse(decoded) as unknown;
  } catch {
    return undefined;
  }
}

export function extractPositionArtworkImage(
  metadata: string,
): string | undefined {
  if (typeof metadata !== "string" || byteLength(metadata) > MAX_METADATA_BYTES)
    return undefined;
  const parsed = decodeMetadata(metadata);
  if (!parsed || typeof parsed !== "object" || !("image" in parsed))
    return undefined;
  const image = (parsed as { image?: unknown }).image;
  if (typeof image !== "string" || !image.startsWith(SVG_DATA_PREFIX))
    return undefined;
  const svg = decodeBase64(image.slice(SVG_DATA_PREFIX.length));
  return svg && hasSafeSvgMarkup(svg) ? image : undefined;
}

export function isValidPositionArtworkSvg(svg: string) {
  return typeof svg === "string" && hasSafeSvgMarkup(svg);
}
