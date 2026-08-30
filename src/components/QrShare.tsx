import { qrSvg } from "@/lib/qr";
import { Dialog } from "@/components/Dialog";
import { CopyButton } from "@/components/CopyButton";

/**
 * A "Show QR" button that opens a dialog with a scannable code for `value`
 * plus copy-link. Server component (renders the SVG at request time).
 */
export async function QrShare({
  value,
  title = "Scan to open",
  label = "QR code",
  caption,
  buttonClass,
}: {
  value: string;
  title?: string;
  label?: string;
  caption?: string;
  buttonClass?: string;
}) {
  const svg = await qrSvg(value, { size: 240 });
  return (
    <Dialog title={title} label={label} buttonClass={buttonClass}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--hairline)", background: "#fff" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {caption && (
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            {caption}
          </p>
        )}
        <code className="max-w-full overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{value}</code>
        <CopyButton value={value} />
      </div>
    </Dialog>
  );
}
