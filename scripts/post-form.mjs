// Post a page's own server-action form, the way a browser without scripts does:
// copy the form's hidden fields (they carry the action), add the given fields, send.
//   node scripts/post-form.mjs <url> key=value ...   ->  prints the status and the Location header
const [url, ...pairs] = process.argv.slice(2);
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const page = await (await fetch(url, { headers: { "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.1.1` } })).text();
const form = new FormData();
for (const m of page.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  const name = /name="([^"]*)"/.exec(m[0])?.[1];
  const value = /value="([^"]*)"/.exec(m[0])?.[1] ?? "";
  if (name && name.startsWith("$ACTION")) form.append(decode(name), decode(value));
}
for (const kv of pairs) {
  const i = kv.indexOf("=");
  form.append(kv.slice(0, i), kv.slice(i + 1));
}
const res = await fetch(url, { method: "POST", body: form, redirect: "manual" });
console.log(res.status, res.headers.get("location") ?? "");
