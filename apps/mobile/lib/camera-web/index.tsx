// Web replacement for `expo-camera`. Renders a neutral placeholder and, on
// takePictureAsync(), opens a native file picker (camera on mobile browsers).
// Bundled by Metro only on web; native never resolves this file.
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';

export type CameraPermission = {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted';
  expires: 'never';
};

const GRANTED: CameraPermission = {
  granted: true,
  canAskAgain: true,
  status: 'granted',
  expires: 'never',
};

// A file input needs no camera permission on web — always report granted.
export function useCameraPermissions(): [
  CameraPermission,
  () => Promise<CameraPermission>,
] {
  const request = useCallback(async () => GRANTED, []);
  return [GRANTED, request];
}

export type PictureResult = { uri: string; width: number; height: number };
export type CameraViewHandle = {
  takePictureAsync: (opts?: {
    quality?: number;
  }) => Promise<PictureResult | undefined>;
};

type CameraViewProps = { style?: unknown; facing?: string; [key: string]: unknown };

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  function CameraView(_props, ref) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const resolverRef = useRef<((r: PictureResult | undefined) => void) | null>(
      null,
    );

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!resolve) return;
      if (!file) return resolve(undefined);
      const uri = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () =>
        resolve({ uri, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ uri, width: 0, height: 0 });
      img.src = uri;
    }, []);

    useImperativeHandle(ref, () => ({
      takePictureAsync: () =>
        new Promise<PictureResult | undefined>((resolve) => {
          resolverRef.current = resolve;
          inputRef.current?.click();
        }),
    }));

    return (
      <div
        style={{
          flex: 1,
          minHeight: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e293b',
          color: '#94a3b8',
          fontSize: 13,
          borderRadius: 12,
          textAlign: 'center',
          padding: 16,
        }}
      >
        <span>Pulsa el botón para seleccionar o hacer una foto</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={onChange}
        />
      </div>
    );
  },
);

export default { CameraView, useCameraPermissions };
