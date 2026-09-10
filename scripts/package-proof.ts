import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { readLimited } from "../cli/files";
import {
  MAX_BYTES,
  verifyApplication,
  type ReleaseDescriptor,
} from "../cli/content";
import { releaseDag } from "../cli/release";
import { writeCar } from "./car";

const directory = process.argv[2] ?? "release";
const bundle = {
  "descriptor.json": await readLimited(
    join(directory, "descriptor.json"),
    1024 * 1024,
  ),
  "application.json": await readLimited(
    join(directory, "application.json"),
    MAX_BYTES,
  ),
  "provenance.json": await readLimited(
    join(directory, "provenance.json"),
    1024 * 1024,
  ),
};
const descriptor = JSON.parse(
  bundle["descriptor.json"].toString("utf8"),
) as ReleaseDescriptor;
const site = await verifyApplication(bundle["application.json"], descriptor);
const dag = await releaseDag(site, bundle);
await writeCar(join(directory, "release.car"), dag);
await writeFile(
  join(directory, "deployment.json"),
  JSON.stringify({
    repository: descriptor.repository,
    commit: descriptor.commit,
    siteCid: descriptor.siteCid,
    releaseCid: dag.root.toString(),
  }),
);
console.log(`Release CID: ${dag.root}\nSite CID: ${descriptor.siteCid}`);
