import { App } from 'octokit';
import type { Octokit } from 'octokit';

export type { Octokit } from 'octokit';

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: number;
}

export async function createGitHubAppClient(
  config: GitHubAppConfig,
): Promise<Octokit> {
  const app = new App({ appId: config.appId, privateKey: config.privateKey });
  return app.getInstallationOctokit(config.installationId);
}
