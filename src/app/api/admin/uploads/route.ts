// usage: const key = await uploadFileWithPresign(file, { folder: "videos" });
export async function uploadFileWithPresign(
  file: File,
  opts?: { folder?: string; timeoutMs?: number }
): Promise<{ key: string; urlPublic?: string }> {
  if (!file) throw new Error("file required");

  const folder = opts?.folder;
  const presignRes = await fetch("/api/admin/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
      // expiresInSeconds: 3600
    }),
  });

  if (!presignRes.ok) {
    const txt = await presignRes.text().catch(() => "");
    throw new Error(txt || `Presign failed: ${presignRes.status}`);
  }

  const presignJson = await presignRes.json();
  const { url: signedUrl, key, contentType, expiresIn } = presignJson;
  if (!signedUrl || !key) throw new Error("invalid presign response");

  // Upload using XMLHttpRequest to get progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    // must set same Content-Type as presign (or the one used to sign)
    xhr.setRequestHeader("Content-Type", contentType || file.type || "application/octet-stream");

    // Optional - set credentials if your presigned url expects no credentials
    xhr.withCredentials = false;

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        // you can dispatch this progress to your UI
        console.debug("upload progress", pct);
      }
    };

    xhr.onload = function () {
      // 200 and 201 are both common success responses
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`PUT to signed url failed: ${xhr.status} - ${xhr.statusText} - ${xhr.responseText}`));
      }
    };
    xhr.onerror = function () {
      reject(new Error("Network error during PUT to signed url"));
    };
    xhr.onabort = function () {
      reject(new Error("Upload aborted"));
    };

    xhr.send(file);
  });

  // Optionally return the public URL if you build it from account/bucket
  // e.g. https://<accountid>.r2.cloudflarestorage.com/<bucket>/<key>
  const publicUrl = `https://${process.env.NEXT_PUBLIC_R2_ACCOUNT_ID || ""}.r2.cloudflarestorage.com/${encodeURIComponent(key)}`; // may not be accurate if you host behind CDN
  return { key, urlPublic: publicUrl };
}
