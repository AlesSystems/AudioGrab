export default function Overlays() {
  return (
    <>
      <div className="grain" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <filter id="n">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#n)" />
        </svg>
      </div>
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
