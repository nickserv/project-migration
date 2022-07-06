import { Octokit } from "octokit"
import { OctokitResponse } from "@octokit/types"

const octokit = new Octokit({
  auth: "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",
})

type Response = Promise<OctokitResponse<unknown>>
type ResponseData<T extends () => Response> = Awaited<ReturnType<T>>["data"]
type Project = ResponseData<typeof octokit.rest.projects.get>
type Repo = ResponseData<typeof octokit.rest.repos.get>

async function listForRepositories(
  owner: string,
  repos: Repo[],
): Promise<Project[]> {
  return (
    await Promise.all(
      repos
        .filter((repo) => repo.has_projects && !repo.archived)
        .map(
          async ({ name: repo }) =>
            (
              await octokit.rest.projects.listForRepo({ owner, repo })
            ).data,
        ),
    )
  ).flat()
}

async function listForUser(username: string): Promise<Project[]> {
  return [
    ...(await octokit.rest.projects.listForUser({ username })).data,
    ...(await listForRepositories(
      username,
      (
        await octokit.rest.repos.listForUser({ username })
      ).data as Repo[],
    )),
  ]
}

async function listForOrg(org: string): Promise<Project[]> {
  return [
    ...(await octokit.rest.projects.listForOrg({ org })).data,
    ...(await listForRepositories(
      org,
      (
        await octokit.rest.repos.listForOrg({ org })
      ).data as Repo[],
    )),
  ]
}

;(async () => {
  const { login } = (await octokit.rest.users.getAuthenticated()).data
  const projects = await listForUser(login)
  const orgs = (
    await Promise.all(
      (
        await octokit.rest.orgs.listForAuthenticatedUser()
      ).data.map((org) => listForOrg(org.login)),
    )
  ).flat()
  const allProjects = [...projects, ...orgs]
  console.log(allProjects)
})()
