import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

const execAsync = promisify(exec);

interface WorkspaceContext {
  path: string;
  git?: GitContext;
  docker?: DockerContext;
  package?: PackageContext;
  env?: EnvContext;
}

interface GitContext {
  branch: string;
  status: {
    modified: string[];
    untracked: string[];
    staged: string[];
  };
  remotes: string[];
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
}

interface DockerContext {
  containers: {
    id: string;
    name: string;
    status: string;
    image: string;
  }[];
  images: {
    id: string;
    tag: string;
    size: string;
  }[];
  compose?: {
    version: string;
    services: string[];
  };
}

interface PackageContext {
  manager: 'npm' | 'yarn' | 'pnpm';
  dependencies: {
    [key: string]: string;
  };
  devDependencies: {
    [key: string]: string;
  };
  scripts: {
    [key: string]: string;
  };
}

interface EnvContext {
  variables: {
    [key: string]: string;
  };
  files: string[];
}

class WorkspaceContextService {
  private cache: Map<string, { context: WorkspaceContext; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  async getWorkspaceContext(workspacePath: string): Promise<WorkspaceContext> {
    const cached = this.cache.get(workspacePath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.context;
    }

    try {
      const [git, docker, pkg, env] = await Promise.all([
        this.getGitContext(workspacePath),
        this.getDockerContext(workspacePath),
        this.getPackageContext(workspacePath),
        this.getEnvContext(workspacePath),
      ]);

      const context: WorkspaceContext = {
        path: workspacePath,
        git,
        docker,
        package: pkg,
        env,
      };

      this.cache.set(workspacePath, {
        context,
        timestamp: Date.now(),
      });

      return context;
    } catch (error) {
      logger.error('Failed to get workspace context:', error);
      throw error;
    }
  }

  private async getGitContext(
    workspacePath: string
  ): Promise<GitContext | undefined> {
    try {
      const commands = {
        branch: 'git branch --show-current',
        status: 'git status --porcelain',
        remotes: 'git remote -v',
        lastCommit: 'git log -1 --format="%H%n%s%n%an%n%aI"',
      };

      const results = await Promise.all(
        Object.entries(commands).map(async ([key, cmd]) => {
          try {
            const { stdout } = await execAsync(cmd, { cwd: workspacePath });
            return [key, stdout.trim()];
          } catch {
            return [key, ''];
          }
        })
      );

      const [branch, status, remotes, lastCommit] = results.map(
        ([_, output]) => output
      );

      if (!branch) return undefined;

      const statusLines = status.split('\n').filter(Boolean);
      const modified = statusLines
        .filter(line => line.startsWith(' M') || line.startsWith('M '))
        .map(line => line.slice(3));
      const untracked = statusLines
        .filter(line => line.startsWith('??'))
        .map(line => line.slice(3));
      const staged = statusLines
        .filter(line => line.startsWith('A '))
        .map(line => line.slice(3));

      const [hash, message, author, date] = lastCommit.split('\n');

      return {
        branch,
        status: {
          modified,
          untracked,
          staged,
        },
        remotes: remotes
          .split('\n')
          .filter(Boolean)
          .map(line => line.split('\t')[0]),
        lastCommit: {
          hash,
          message,
          author,
          date: new Date(date),
        },
      };
    } catch (error) {
      logger.error('Failed to get git context:', error);
      return undefined;
    }
  }

  private async getDockerContext(
    workspacePath: string
  ): Promise<DockerContext | undefined> {
    try {
      const commands = {
        containers:
          'docker ps --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Image}}"',
        images: 'docker images --format "{{.ID}}\\t{{.Tag}}\\t{{.Size}}"',
      };

      const [containersOutput, imagesOutput] = await Promise.all(
        Object.values(commands).map(async cmd => {
          try {
            const { stdout } = await execAsync(cmd);
            return stdout.trim();
          } catch {
            return '';
          }
        })
      );

      const composeFile = path.join(workspacePath, 'docker-compose.yml');
      let compose;

      try {
        const composeContent = await fs.readFile(composeFile, 'utf8');
        const services =
          composeContent.match(/^  \w+:/gm)?.map(s => s.slice(2, -1)) || [];
        compose = {
          version: composeContent.match(/^version: ['"](.+)['"]$/m)?.[1] || '',
          services,
        };
      } catch {
        // Compose file not found or invalid
      }

      return {
        containers: containersOutput
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const [id, name, status, image] = line.split('\t');
            return { id, name, status, image };
          }),
        images: imagesOutput
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const [id, tag, size] = line.split('\t');
            return { id, tag, size };
          }),
        compose,
      };
    } catch (error) {
      logger.error('Failed to get docker context:', error);
      return undefined;
    }
  }

  private async getPackageContext(
    workspacePath: string
  ): Promise<PackageContext | undefined> {
    try {
      const packageFile = path.join(workspacePath, 'package.json');
      const content = await fs.readFile(packageFile, 'utf8');
      const pkg = JSON.parse(content);

      let manager: 'npm' | 'yarn' | 'pnpm' = 'npm';
      try {
        await fs.access(path.join(workspacePath, 'yarn.lock'));
        manager = 'yarn';
      } catch {
        try {
          await fs.access(path.join(workspacePath, 'pnpm-lock.yaml'));
          manager = 'pnpm';
        } catch {
          // Using npm
        }
      }

      return {
        manager,
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
        scripts: pkg.scripts || {},
      };
    } catch (error) {
      logger.error('Failed to get package context:', error);
      return undefined;
    }
  }

  private async getEnvContext(
    workspacePath: string
  ): Promise<EnvContext | undefined> {
    try {
      const envFiles = ['.env', '.env.local', '.env.development'];
      const foundFiles: string[] = [];
      const variables: { [key: string]: string } = {};

      for (const file of envFiles) {
        try {
          const content = await fs.readFile(
            path.join(workspacePath, file),
            'utf8'
          );
          foundFiles.push(file);

          content
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .forEach(line => {
              const [key, ...valueParts] = line.split('=');
              if (key) {
                variables[key.trim()] = valueParts.join('=').trim();
              }
            });
        } catch {
          // File doesn't exist
        }
      }

      return {
        variables,
        files: foundFiles,
      };
    } catch (error) {
      logger.error('Failed to get env context:', error);
      return undefined;
    }
  }

  async suggestActions(workspacePath: string): Promise<string[]> {
    try {
      const context = await this.getWorkspaceContext(workspacePath);
      const suggestions: string[] = [];

      // Git suggestions
      if (context.git) {
        if (context.git.status.modified.length > 0) {
          suggestions.push(
            'You have modified files. Consider committing your changes.'
          );
        }
        if (context.git.status.staged.length > 0) {
          suggestions.push('You have staged changes ready to be committed.');
        }
      }

      // Docker suggestions
      if (context.docker?.containers.length === 0 && context.docker?.compose) {
        suggestions.push(
          'Docker Compose configuration exists but no containers are running.'
        );
      }

      // Package suggestions
      if (context.package) {
        const packageLock = path.join(workspacePath, 'package-lock.json');
        try {
          await fs.access(packageLock);
        } catch {
          suggestions.push(
            'package-lock.json is missing. Run npm install to generate it.'
          );
        }
      }

      // Environment suggestions
      if (context.env?.files.length === 0) {
        suggestions.push(
          'No .env file found. Consider adding one for environment variables.'
        );
      }

      return suggestions;
    } catch (error) {
      logger.error('Failed to generate suggestions:', error);
      return [];
    }
  }

  async validateConfiguration(
    workspacePath: string
  ): Promise<{ [key: string]: boolean }> {
    try {
      const context = await this.getWorkspaceContext(workspacePath);
      const validation: { [key: string]: boolean } = {};

      // Git configuration
      if (context.git) {
        const { stdout: gitConfig } = await execAsync('git config --list', {
          cwd: workspacePath,
        });
        validation.gitUser =
          gitConfig.includes('user.name') && gitConfig.includes('user.email');
        validation.gitRemote = context.git.remotes.length > 0;
      }

      // Docker configuration
      if (context.docker?.compose) {
        const dockerfilePath = path.join(workspacePath, 'Dockerfile');
        try {
          await fs.access(dockerfilePath);
          validation.dockerfileExists = true;
        } catch {
          validation.dockerfileExists = false;
        }
      }

      // Package configuration
      if (context.package) {
        validation.hasValidPackageJson = true;
        validation.hasLockFile =
          context.package.manager === 'npm'
            ? await this.fileExists(workspacePath, 'package-lock.json')
            : await this.fileExists(workspacePath, 'yarn.lock');
      }

      // Environment configuration
      if (context.env) {
        validation.hasEnvFile = context.env.files.length > 0;
        const envExample = await this.fileExists(workspacePath, '.env.example');
        validation.hasEnvExample = envExample;
      }

      return validation;
    } catch (error) {
      logger.error('Failed to validate configuration:', error);
      return {};
    }
  }

  private async fileExists(
    workspacePath: string,
    file: string
  ): Promise<boolean> {
    try {
      await fs.access(path.join(workspacePath, file));
      return true;
    } catch {
      return false;
    }
  }
}

export default new WorkspaceContextService();
