import { Octokit } from "octokit"

const octokit = new Octokit({
  auth: "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",
})

type Project = Awaited<ReturnType<typeof octokit.rest.projects.get>>["data"]

async function getRepositoryProjects(owner: string): Promise<Project[]> {
  const repos = (await octokit.rest.repos.listForOrg({ org: owner })).data

  return (
    await Promise.all(
      repos
        .filter((repo) => repo.has_projects)
        .map(async ({ name: repo }) => {
          const { data } = await octokit.rest.projects.listForRepo({
            owner,
            repo,
          })
          return data
        }),
    )
  ).flat()
}

async function getProjects(org: string): Promise<Project[]> {
  const projects = (await octokit.rest.projects.listForOrg({ org })).data

  return [...projects, ...(await getRepositoryProjects(org))]
}

;(async () => {
  const projects = await getProjects("testing-library")
  console.log(projects.map((project) => project.name))
})()
