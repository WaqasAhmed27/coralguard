import { z } from "zod";

const githubName = /^[A-Za-z0-9_.-]+$/;
const shellMeta = /[;&|`$<>(){}\[\]\n\r]/;

export const prInputSchema = z.object({
  prUrl: z.string().trim().min(1).optional(),
  owner: z.string().trim().regex(githubName).optional(),
  repo: z.string().trim().regex(githubName).optional(),
  pr: z.coerce.number().int().positive().optional(),
  mode: z.enum(["demo", "live"]).default("demo"),
  redaction: z.enum(["standard", "strict"]).default("standard"),
  missingSources: z.array(z.string()).default([])
});

export type PrInput = z.input<typeof prInputSchema>;

export type ParsedPr = {
  owner: string;
  repo: string;
  prNumber: number;
  prUrl: string;
};

export function parsePullRequestInput(input: PrInput): ParsedPr {
  const parsed = prInputSchema.parse(input);

  if (parsed.owner && parsed.repo && parsed.pr) {
    rejectShellMeta(parsed.owner, "owner");
    rejectShellMeta(parsed.repo, "repo");
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      prNumber: parsed.pr,
      prUrl: `https://github.com/${parsed.owner}/${parsed.repo}/pull/${parsed.pr}`
    };
  }

  if (!parsed.prUrl) {
    throw new Error("Enter a GitHub PR URL like https://github.com/demo/shop/pull/214.");
  }

  rejectShellMeta(parsed.prUrl, "PR input");

  const shorthand = parsed.prUrl.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([1-9][0-9]*)$/);
  if (shorthand) {
    const [, owner, repo, prText] = shorthand;
    return {
      owner,
      repo,
      prNumber: Number(prText),
      prUrl: `https://github.com/${owner}/${repo}/pull/${prText}`
    };
  }

  let url: URL;
  try {
    url = new URL(parsed.prUrl);
  } catch {
    throw new Error("PR input must be a GitHub pull request URL or owner/repo#number.");
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only github.com pull request URLs are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[2] !== "pull" || !/^[1-9][0-9]*$/.test(parts[3])) {
    throw new Error("Use a GitHub pull request URL in the form /owner/repo/pull/number.");
  }

  const [owner, repo, , prNumber] = parts;
  if (!githubName.test(owner) || !githubName.test(repo)) {
    throw new Error("GitHub owner and repository may only contain letters, numbers, dots, underscores, and hyphens.");
  }

  return {
    owner,
    repo,
    prNumber: Number(prNumber),
    prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`
  };
}

function rejectShellMeta(value: string, label: string) {
  if (shellMeta.test(value)) {
    throw new Error(`${label} contains unsupported shell metacharacters.`);
  }
}
