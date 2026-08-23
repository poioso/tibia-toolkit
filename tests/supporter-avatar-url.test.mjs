import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupporterAvatarUrl } from "../lib/supporters/avatar-url.js";

const avatarId = "3cfd5c8c-0950-4e24-8785-edb035b006d6";

test("uses the public API origin when development falls back from local supporters", () => {
  assert.equal(
    normalizeSupporterAvatarUrl({
      value: `/account-api/product/avatar/public?id=${avatarId}`,
      sourceUrl: "https://tibiatoolkit.com/api/supporters",
      fallbackBaseUrl: "http://127.0.0.1:3042"
    }),
    `https://tibiatoolkit.com/account-api/product/avatar/public?id=${avatarId}`
  );
});

test("keeps the local origin when the local supporters API answered", () => {
  assert.equal(
    normalizeSupporterAvatarUrl({
      value: `/account-api/product/avatar/public?id=${avatarId}`,
      sourceUrl: "http://127.0.0.1:3042/api/supporters",
      fallbackBaseUrl: "http://127.0.0.1:3042"
    }),
    `http://127.0.0.1:3042/account-api/product/avatar/public?id=${avatarId}`
  );
});

test("rejects an invalid account avatar id and lets the vocation fallback render", () => {
  assert.equal(
    normalizeSupporterAvatarUrl({
      value: "/account-api/product/avatar/public?id=not-a-uuid",
      sourceUrl: "https://tibiatoolkit.com/api/supporters",
      fallbackBaseUrl: "http://127.0.0.1:3042"
    }),
    ""
  );
});
