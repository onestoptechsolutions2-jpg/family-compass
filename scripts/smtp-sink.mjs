// A mail server that keeps what it is sent, for testing email without sending any.
//   node scripts/smtp-sink.mjs [port] [folder]     (defaults: 2526, .mail)
// Every message is written to <folder>/<n>.eml. Nothing leaves this machine.
import net from "node:net";
import fs from "node:fs";

const port = Number(process.argv[2] ?? 2526);
const dir = process.argv[3] ?? ".mail";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
let n = 0;

net
  .createServer((sock) => {
    let data = "";
    let inData = false;
    let buf = "";
    sock.write("220 sink ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buf.indexOf("\r\n.\r\n");
          if (end === -1) return;
          data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          fs.writeFileSync(`${dir}/${String(++n).padStart(4, "0")}.eml`, data);
          sock.write("250 OK queued\r\n");
          continue;
        }
        const i = buf.indexOf("\r\n");
        if (i === -1) return;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") sock.write("250-sink\r\n250 8BITMIME\r\n");
        else if (cmd === "HELO" || cmd === "MAIL" || cmd === "RCPT" || cmd === "RSET") sock.write("250 OK\r\n");
        else if (cmd === "DATA") {
          inData = true;
          sock.write("354 go ahead\r\n");
        } else if (cmd === "QUIT") {
          sock.write("221 bye\r\n");
          sock.end();
        } else sock.write("250 OK\r\n");
      }
    });
    sock.on("error", () => {});
  })
  .listen(port, "127.0.0.1", () => console.log(`mail sink on ${port}, writing to ${dir}`));
