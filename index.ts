import { Octokit } from "octokit"

const octokit = new Octokit({
  auth: "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",
})

type Project = Awaited<ReturnType<typeof octokit.rest.projects.get>>["data"]

async function getRepositoryProjects(owner: string): Promise<Project[]> {
  return (
    await Promise.all(
      (await octokit.rest.repos.listForOrg({ org: owner })).data
        .filter((repo) => repo.has_projects)
        .map(
          async ({ name: repo }) =>
            (
              await octokit.rest.projects.listForRepo({ owner, repo })
            ).data,
        ),
    )
  ).flat()
}

async function getProjects(org: string): Promise<Project[]> {
  return [
    ...(await octokit.rest.projects.listForOrg({ org })).data,
    ...(await getRepositoryProjects(org)),
  ]
}

;(async () => {
  const projects = await getProjects("testing-library")
  console.log(projects.map((project) => project.name))
})()
