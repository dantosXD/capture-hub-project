import { constants } from "node:fs";
import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNodeEntry(relativeEntryPath, args = []) {
  return new Promise((resolve, reject) => {
    const entryPath = path.join(rootDir, relativeEntryPath);
    const child = spawn(process.execPath, [entryPath, ...args], {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed (${relativeEntryPath}) with exit code ${code}`));
    });
  });
}

function isTransientPrismaGenerateError(error) {
  const message = String(error?.message || "");
  return message.includes("EPERM") || message.includes("operation not permitted, rename");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPrismaGenerateWithRetry(maxAttempts = 4) {
  const prismaClientIndexPath = path.join(rootDir, "node_modules", ".prisma", "client", "index.js");

  // Fail fast on real schema issues before entering retry/fallback logic.
  await runNodeEntry("node_modules/prisma/build/index.js", ["validate"]);

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await runNodeEntry("node_modules/prisma/build/index.js", ["generate"]);
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        try {
          await access(prismaClientIndexPath, constants.F_OK);
          console.warn("[build] Prisma generate repeatedly failed. Continuing with existing generated client.");
          return;
        } catch {
          throw error;
        }
      }

      const delayMs = 750 * attempt;
      console.warn(
        `[build] Prisma generate failed with transient file lock (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }
}

async function copyDirectoryIfExists(sourcePath, destinationPath) {
  try {
    await access(sourcePath, constants.F_OK);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  await cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function build() {
  await runPrismaGenerateWithRetry();
  await runNodeEntry("node_modules/next/dist/bin/next", ["build"]);

  const standaloneRoot = path.join(rootDir, ".next", "standalone");
  const standaloneNextDir = path.join(standaloneRoot, ".next");

  await mkdir(standaloneNextDir, { recursive: true });

  await copyDirectoryIfExists(
    path.join(rootDir, ".next", "static"),
    path.join(standaloneNextDir, "static"),
  );

  await copyDirectoryIfExists(
    path.join(rootDir, "public"),
    path.join(standaloneRoot, "public"),
  );
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
