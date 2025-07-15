"use server";
import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";
import { fetchMutation } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { inngest } from "@/lib/inngest";
import { auth } from "@/lib/auth";
import { Id } from "@/convex/_generated/dataModel";
import { Template } from "@/config";

export async function runAgentAction({
  sessionId,
  id,
  message,
  template,
  repository,
  token,
}: {
  sessionId: string;
  id: string;
  message: string;
  template?: Template;
  token: string;
  repository?: string;
}) {
  await inngest.send({
    name: "vibe0/run.agent",
    data: {
      sessionId,
      id,
      message,
      template,
      repository,
      token,
    },
  });
}

export async function createSessionAction({
  sessionId,
  message,
  repository,
  template,
}: {
  sessionId: string;
  message?: string;
  repository?: string;
  template?: Template;
}) {
  const session = await auth();
  await inngest.send({
    name: "vibe0/create.session",
    data: {
      sessionId,
      message,
      repository,
      token: session?.accessToken,
      template,
    },
  });
}

export async function deleteSessionAction(sessionId: string) {
  const config: VibeKitConfig = {
    agent: {
      type: "claude",
      model: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
    },
    environment: {
      northflank: {
        apiKey: process.env.NORTHFLANK_API_KEY!,
        projectId: process.env.NORTHFLANK_PROJECT_ID!,
      },
    },
    sessionId,
  };

  const vibekit = new VibeKit(config);

  await vibekit.setSession(sessionId);

  await vibekit.kill();
}

export const createPullRequestAction = async ({
  id,
  sessionId,
  repository,
}: {
  id: Id<"sessions">;
  sessionId: string;
  repository: string;
}) => {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("No GitHub token found. Please authenticate first.");
  }

  const config: VibeKitConfig = {
    agent: {
      type: "claude",
      model: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
    },
    environment: {
      northflank: {
        apiKey: process.env.NORTHFLANK_API_KEY!,
        projectId: process.env.NORTHFLANK_PROJECT_ID!,
      },
    },
    github: {
      token: session?.accessToken,
      repository,
    },
    sessionId,
  };

  const vibekit = new VibeKit(config);

  const pr = await vibekit.createPullRequest(
    {
      name: "🖖 vibe0",
      color: "42460b",
      description: "Pull request created by vibe0",
    },
    "vibe0"
  );

  await fetchMutation(api.sessions.update, {
    id,
    pullRequest: pr,
  });
};
