import dotenv from "dotenv-flow";
dotenv.config();

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs";
import * as db from "../utils/db";
import { Task } from "@/types";

yargs(hideBin(process.argv))
  .command("create", "Create the pgvector schema", {}, async () => {
    await db.createDatabase();
  })
  .command("backupkv", "Backup KV store", {}, async () => {
    const date = new Date();
    const formattedDate = date.toISOString().split("T")[0];
    const dirPath = "./local";
    const filename = `${dirPath}/kv_backup_${formattedDate}.json`;

    const data = await db.getKVData("*");
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFile(filename, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.error("Error writing to file:", err);
      } else {
        console.log(`KV store data has been backed up to ${filename}`);
      }
    });
  })
  .command(
    "mkvectors",
    "Make vectors from KV data and update in Postgres",
    {},
    async () => {
      const data = await db.getKVData("*");
      const userIds = Object.keys(data);
      for (const userId of userIds) {
        const tasks = data[userId].tasks
          .filter((t: Task) => t.description !== "N/A")
          .map((t: Task) => ({ userId, task: t }));
        await db.addTasks(tasks, true); // truncate
      }
    }
  )
  .command(
    "search <query>",
    "Test search query",
    {
      limit: {
        description: "Limit the number of results",
        alias: "l",
        type: "number",
        default: 5,
      },
    },
    async (argv) => {
      const { query, limit } = argv;
      console.log(`Search query: ${query}, Limit: ${limit}`);
      const tasks = await db.findSimilarTasks("all", query as string, limit);
      console.log(tasks);
    }
  )
  .demandCommand(1, "You need to specify at least one command")
  .help().argv;
