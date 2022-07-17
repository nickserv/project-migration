import { readFile, writeFile } from "fs/promises"
import { OAuthApp, Octokit } from "octokit"
import { OctokitResponse } from "@octokit/types"
import { inspect } from "util"

type Response = Promise<OctokitResponse<unknown>>
type ResponseData<T extends () => Response> = Awaited<ReturnType<T>>["data"]
type Project = ResponseData<Octokit["rest"]["projects"]["get"]>
type Repo = ResponseData<Octokit["rest"]["repos"]["get"]>

function logProjects(projects: Project[]) {
  for (const project of projects) console.log(project.html_url)
}

async function getAuthToken(): Promise<string> {
  try {
    return await readFile(".cache", { encoding: "utf8" })
  } catch (e) {
    if (e && e instanceof Error) {
      inspect(e.name)
    }

    // @ts-expect-error Device flow only requires clientId
    const app = new OAuthApp({ clientId: "6792d6c6c07b364a8221" })

    const authToken = new Promise<string>((resolve) => {
      app.on("token", async ({ token }) => resolve(token))
    })

    await app.createToken({
      scopes: ["read:project", "repo"],
      onVerification(verification) {
        console.log(
          `Your code is ${verification.user_code}. Enter it at ${verification.verification_uri}`,
        )
      },
    })

    await writeFile(".cache", await authToken)

    return authToken
  }
}

;(async () => {
  const octokit = new Octokit({ auth: await getAuthToken() })

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

  let username = process.argv[2]
  if (username !== undefined) {
    const user = (await octokit.rest.users.getByUsername({ username })).data
    const list = user.type === "User" ? listForUser : listForOrg
    logProjects(await list(username))
  } else {
    const authenticated = await octokit.rest.users.getAuthenticated()
    username = authenticated.data.login
    logProjects(await listForUser(username))
  }
})()
