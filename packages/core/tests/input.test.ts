import { describe, expect, it } from "vitest";
import { parsePullRequestInput } from "../src/schemas/input.js";
import { sqlString } from "../src/coral/query-registry.js";

describe("PR input parsing", () => {
  it("parses GitHub PR URLs", () => {
    expect(parsePullRequestInput({ prUrl: "https://github.com/demo/shop/pull/214" })).toEqual({
      owner: "demo",
      repo: "shop",
      prNumber: 214,
      prUrl: "https://github.com/demo/shop/pull/214"
    });
  });

  it("parses owner/repo shorthand", () => {
    expect(parsePullRequestInput({ prUrl: "demo/shop#7" }).prNumber).toBe(7);
  });

  it("rejects non-GitHub and issue URLs", () => {
    expect(() => parsePullRequestInput({ prUrl: "https://example.com/demo/shop/pull/1" })).toThrow(/github/);
    expect(() => parsePullRequestInput({ prUrl: "https://github.com/demo/shop/issues/1" })).toThrow(/pull request/);
  });

  it("rejects shell metacharacters", () => {
    expect(() => parsePullRequestInput({ prUrl: "demo/shop#7; rm -rf ." })).toThrow(/metacharacters/);
    expect(() => parsePullRequestInput({ owner: "demo && whoami", repo: "shop", pr: 1 })).toThrow();
  });

  it("rejects unsafe SQL parameters", () => {
    expect(() => sqlString("demo' OR 1=1 --")).toThrow(/Unsafe/);
  });
});
