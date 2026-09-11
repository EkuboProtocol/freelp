import { appendFile } from "node:fs/promises";
const { siteCid, commit, repository } = await Bun.file(
  "release/deployment.json",
).json();
if (!/^bafy[a-z2-7]{55}$/.test(siteCid) || !/^[a-f0-9]{40}$/.test(commit))
  throw new Error("Invalid deployment identity.");
if (
  commit !== process.env.GITHUB_SHA ||
  repository !== process.env.GITHUB_REPOSITORY
)
  throw new Error(
    "Deployment does not match this workflow's commit and repository.",
  );
const gateway = `https://ipfs.filebase.io/ipfs/${siteCid}/`;
const summary = `## FreeLP build preview\n\n[Open this build](${gateway})\n\n- Commit: \`${commit}\`\n- IPFS CID: \`${siteCid}\`\n- [IPFS URI](ipfs://${siteCid})\n\nPinned on the persistent FreeLP IPFS node. This URL always identifies this build.\n`;
await appendFile(process.env.GITHUB_STEP_SUMMARY!, summary);
const status = Bun.spawn(
  [
    "gh",
    "api",
    `repos/${repository}/statuses/${commit}`,
    "--method",
    "POST",
    "--input",
    "-",
  ],
  {
    stdin: new Response(
      JSON.stringify({
        state: "success",
        target_url: gateway,
        description: "Open the pinned IPFS build",
        context: "IPFS preview",
      }),
    ),
    stdout: "ignore",
    stderr: "inherit",
  },
);
if (await status.exited)
  throw new Error("Could not attach the IPFS preview to the commit.");
console.log(`IPFS preview: ${gateway}`);
