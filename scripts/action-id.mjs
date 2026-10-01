// The hidden action field of the form on a saved page that contains <marker>:
//   cat page.html | node scripts/action-id.mjs - contactName   ->  $ACTION_ID_abc...
import fs from "node:fs";
const [file, marker] = process.argv.slice(2);
const html = fs.readFileSync(file === "-" ? 0 : file, "utf8");
const form = html.split("<form").slice(1).map((c) => c.split("</form>")[0]).find((c) => c.includes(marker));
console.log(/name="(\$ACTION_ID_[0-9a-f]+)"/.exec(form ?? "")?.[1] ?? "");
