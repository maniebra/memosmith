const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  githubApiBase,
  githubItem,
  githubListPath,
  nextLink,
} from "../../../src/lib/utils/github";
import {
  gitlabEmbed,
  gitlabMenu,
  rowCard,
} from "../../../src/lib/utils/gitlab";

assert(githubApiBase("") === "https://api.github.com", "empty is github.com");
assert(
  githubApiBase("https://github.com/") === "https://api.github.com",
  "github.com maps to the api host",
);
assert(
  githubApiBase("https://git.corp") === "https://git.corp/api/v3",
  "enterprise uses /api/v3",
);
assert(githubListPath("o/r").startsWith("/repos/o/r/issues?"), "repo scope");
assert(githubListPath("acme").startsWith("/orgs/acme/issues?"), "org scope");
assert(githubListPath("").startsWith("/issues?"), "own scope");
assert(
  nextLink('<https://x/2>; rel="next", <https://x/9>; rel="last"') ===
    "https://x/2",
  "next page comes from the Link header",
);
assert(nextLink(null) === "", "no Link header ends paging");

const pull = githubItem({
  id: 7,
  number: 3,
  title: "Add thing",
  state: "closed",
  repository_url: "https://api.github.com/repos/o/r",
  labels: [{ name: "kind::feature", color: "a2eeef" }],
  pull_request: { merged_at: "2026-01-01T00:00:00Z" },
});
assert(pull.kind === "merge_requests", "pull requests are split out");
assert(pull.item.state === "merged", "merged pulls say so");
assert(pull.item.references?.full === "o/r#3", "reference is repo#number");
const label = pull.item.labels?.[0] as { color?: string };
assert(label.color === "#a2eeef", "label colours gain a hash");
const issue = githubItem({ id: 8, number: 4, state: "open" });
assert(
  issue.kind === "issues" && issue.item.state === "opened",
  "open issues share GitLab's state name",
);

const card = rowCard("github-abc", {
  id: "issues-8",
  tableId: "issues",
  position: 1,
  data: { title: "Bug", reference: "o/r#4" },
});
assert(card.provider === "github", "cards know their provider");
assert(gitlabEmbed(card).startsWith("```github\n"), "github fence language");
assert(
  gitlabMenu([card])[0]?.label === "GitHub",
  "the slash menu groups GitHub items under their own entry",
);
