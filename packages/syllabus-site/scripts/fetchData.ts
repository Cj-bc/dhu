import path from "path";
import { promises as fs } from "fs";
import { getSyllabus, withPage } from "@dhu/core";
import { sortData } from "./sortData";

(async () => {
  const data = await withPage(getSyllabus);
  await fs.writeFile(
    path.join(__dirname, "../data/syllabus.json"),
    JSON.stringify(sortData(data), null, 4),
    {
      encoding: "utf8",
    }
  );
})();
