"use client";

import { useEffect, useRef, useState } from "react";
import strings from "@/lib/strings";

/**
 * Square image cropper for instructor photos. The user drags to reposition and
 * uses a slider to zoom; the visible square is rendered to a canvas and handed
 * back as a JPEG File via `onChange`, so the framing the user chose is exactly
 * what gets uploaded (no server-side cropping, no schema/focal-point column).
 *
 * The math: the source image is fit to "cover" the frame at zoom 1, then scaled
 * by `zoom`. `offset` pans the image in frame pixels and is clamped so the frame
 * is always fully covered. On commit we map the frame back to source pixels and
 * draw that region into a fixed-size output canvas.
 */

const FRAME = 256; // displayed crop square (CSS px)
const OUTPUT = 512; // exported square (device px)

export default function ImageCropper({
  file,
  onChange,
}: {
  file: File;
  onChange: (cropped: File, previewUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastEmittedUrl = useRef("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null
  );

  // Load the picked file into an <img> we can read pixels from.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function coverScale(image: HTMLImageElement) {
    return Math.max(FRAME / image.naturalWidth, FRAME / image.naturalHeight);
  }

  function clampOffset(x: number, y: number, z: number) {
    if (!img) return { x: 0, y: 0 };
    const s = coverScale(img) * z;
    const maxX = Math.max(0, (img.naturalWidth * s - FRAME) / 2);
    const maxY = Math.max(0, (img.naturalHeight * s - FRAME) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  // Render the chosen square region to a canvas and emit it as a JPEG File.
  function emit(off: { x: number; y: number }, z: number) {
    if (!img) return;
    const s = coverScale(img) * z;
    const region = FRAME / s; // source px visible in the frame
    const cx = img.naturalWidth / 2 - off.x / s;
    const cy = img.naturalHeight / 2 - off.y / s;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      cx - region / 2,
      cy - region / 2,
      region,
      region,
      0,
      0,
      OUTPUT,
      OUTPUT
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (lastEmittedUrl.current) URL.revokeObjectURL(lastEmittedUrl.current);
        const cropped = new File([blob], "instructor.jpg", {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        lastEmittedUrl.current = url;
        onChange(cropped, url);
      },
      "image/jpeg",
      0.9
    );
  }

  // Emit the initial centered crop as soon as the image is ready.
  useEffect(() => {
    if (img) emit({ x: 0, y: 0 }, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset(
      clampOffset(
        drag.current.ox + (e.clientX - drag.current.x),
        drag.current.oy + (e.clientY - drag.current.y),
        zoom
      )
    );
  }
  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    emit(offset, zoom);
  }

  const dispW = img ? img.naturalWidth * coverScale(img) * zoom : 0;
  const dispH = img ? img.naturalHeight * coverScale(img) * zoom : 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="application"
        aria-label={strings.instructorImageCropFrame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative cursor-move overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        style={{ width: FRAME, height: FRAME, touchAction: "none" }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 select-none"
            style={{
              width: dispW,
              height: dispH,
              maxWidth: "none",
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="instructor-crop-zoom" className="text-xs text-slate-500">
          {strings.instructorImageZoom}
        </label>
        <input
          id="instructor-crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            const z = Number(e.target.value);
            setZoom(z);
            setOffset((o) => clampOffset(o.x, o.y, z));
          }}
          onPointerUp={() => emit(offset, zoom)}
          onKeyUp={() => emit(offset, zoom)}
          className="h-1 flex-1 accent-brand"
        />
      </div>

      <p className="text-xs text-slate-500">{strings.instructorImageCropHelp}</p>
    </div>
  );
}
