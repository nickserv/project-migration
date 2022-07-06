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
            await octokit.paginate(octokit.rest.projects.listForRepo, {
              owner,
              repo,
            }),
        ),
    )
  ).flat()
}

async function listForUser(username: string): Promise<Project[]> {
  return [
    ...(await octokit.paginate(octokit.rest.projects.listForUser, {
      username,
    })),
    ...(await listForRepositories(
      username,
      (await octokit.paginate(octokit.rest.repos.listForUser, {
        username,
      })) as Repo[],
    )),
  ]
}

async function listForOrg(org: string): Promise<Project[]> {
  return [
    ...(await octokit.paginate(octokit.rest.projects.listForOrg, {
      org,
    })),
    ...(await listForRepositories(
      org,
      (await octokit.paginate(octokit.rest.repos.listForOrg, {
        org,
      })) as Repo[],
    )),
  ]
}

;(async () => {
  const { login } = (await octokit.rest.users.getAuthenticated()).data
  const projects = await listForUser(login)
  const orgs = (
    await Promise.all(
      (
        await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser)
      ).map((org) => listForOrg(org.login)),
    )
  ).flat()
  for (const project of [...projects, ...orgs]) console.log(project.html_url)
})()
