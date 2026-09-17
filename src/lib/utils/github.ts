import type { GitlabItem, GitlabKind } from "./gitlab";

/** REST base: api.github.com for github.com, `/api/v3` on Enterprise Server. */
export function githubApiBase(url: string) {
  const base = url.trim().replace(/\/+$/, "");
  return !base || /^https?:\/\/(www\.)?github\.com$/i.test(base)
    ? "https://api.github.com"
    : `${base}/api/v3`;
}

/**
 * `owner/repo` lists one repository, a bare name lists an organization, and
 * empty lists what the token's user can see across their repositories.
 */
export function githubListPath(scope: string) {
  const target = scope.trim().replace(/^\/+|\/+$/g, "");
  const query = "?per_page=100&state=all&sort=updated&filter=all";
  if (target.includes("/")) {
    const [owner, repo] = target.split("/").map(encodeURIComponent);
    return `/repos/${owner}/${repo}/issues${query}`;
  }
  return target
    ? `/orgs/${encodeURIComponent(target)}/issues${query}`
    : `/issues${query}`;
}

/** The `rel="next"` target of a `Link` header, if there is one. */
export function nextLink(header: string | null) {
  return /<([^>]+)>;\s*rel="next"/.exec(header ?? "")?.[1] ?? "";
}

type GithubUser = { login?: string };
export type GithubIssue = {
  id: number;
  number: number;
  title?: string;
  body?: string | null;
  state?: string;
  user?: GithubUser;
  assignees?: GithubUser[];
  labels?: (string | { name?: string; color?: string })[];
  created_at?: string;
  updated_at?: string;
  html_url?: string;
  repository_url?: string;
  pull_request?: { merged_at?: string | null };
};

/** GitHub issues and pull requests in the shape the GitLab sync stores. */
export function githubItem(issue: GithubIssue): {
  kind: GitlabKind;
  item: GitlabItem;
} {
  const repo = (issue.repository_url ?? "").split("/repos/")[1] ?? "";
  const pull = issue.pull_request;
  const state = pull?.merged_at
    ? "merged"
    : issue.state === "open"
      ? "opened"
      : "closed";
  return {
    kind: pull ? "merge_requests" : "issues",
    item: {
      id: issue.id,
      title: issue.title,
      description: issue.body,
      state,
      references: { full: `${repo}#${issue.number}` },
      author: { username: issue.user?.login },
      assignees: (issue.assignees ?? []).map((user) => ({
        username: user.login,
      })),
      labels: (issue.labels ?? []).map((label) =>
        typeof label === "string"
          ? label
          : { name: label.name, color: label.color && `#${label.color}` },
      ),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      web_url: issue.html_url,
    },
  };
}
