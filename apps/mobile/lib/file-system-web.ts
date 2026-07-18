// Web replacement for `expo-file-system/legacy`. Only readAsStringAsync(Base64),
// used to turn a local photo URI into base64 for upload.
export const EncodingType = { Base64: 'base64', UTF8: 'utf8' } as const;

export async function readAsStringAsync(
  uri: string,
  opts?: { encoding?: string },
): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  if (opts?.encoding === EncodingType.UTF8) {
    return blob.text();
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // Strip the `data:<mime>;base64,` prefix — callers expect raw base64.
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export default { readAsStringAsync, EncodingType };
