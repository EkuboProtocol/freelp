import { expect, test } from "bun:test";
import { extractPositionArtworkImage, isValidPositionArtworkSvg } from "../../src/positionArtwork.ts";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#fff"/><defs><pattern id="ripples" width="640" height="640"><circle cx="245" cy="270" r="24"/></pattern><clipPath id="disc"><circle cx="320" cy="270" r="172"/></clipPath></defs><g clip-path="url(#disc)"><circle fill="#eff7fa" cx="320" cy="270" r="172"/></g></svg>`;
const metadata = `data:application/json;base64,${btoa(JSON.stringify({ name: "Liquidity Position #1", image: `data:image/svg+xml;base64,${btoa(svg)}` }))}`;

test("accepts pinned-format embedded position metadata", () => {
  expect(extractPositionArtworkImage(metadata)).toBe(JSON.parse(atob(metadata.split(",")[1])).image);
  expect(isValidPositionArtworkSvg(svg)).toBe(true);
});

test("rejects external images and scripts", () => {
  for (const malicious of [
    `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.svg"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://example.com/x)"/></svg>`,
  ]) {
    const value = `data:application/json;base64,${btoa(JSON.stringify({ image: `data:image/svg+xml;base64,${btoa(malicious)}` }))}`;
    expect(extractPositionArtworkImage(value)).toBeUndefined();
  }
});

test("rejects malformed, unsupported, and oversized metadata", () => {
  expect(extractPositionArtworkImage("not metadata")).toBeUndefined();
  expect(extractPositionArtworkImage(`data:application/json;base64,${btoa(JSON.stringify({ image: "https://example.com/nft.svg" }))}`)).toBeUndefined();
  expect(isValidPositionArtworkSvg(`<svg xmlns="http://www.w3.org/2000/svg"><circle></svg>`)).toBe(false);
  expect(extractPositionArtworkImage("x".repeat(512 * 1024 + 1))).toBeUndefined();
});
