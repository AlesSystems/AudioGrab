export default function Hero() {
  return (
    <div className="hero">
      <h1 className="wordmark" aria-label="AudioGrab">
        <span className="audio">Audio</span>
        <span className="grab">Grab</span>
      </h1>
      <div className="eq" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <i key={i} />
        ))}
      </div>
      <p className="pitch">
        Paste a link or drop a video — get an <em>mp3</em>. No accounts, no tracking, files deleted after download.
      </p>
    </div>
  );
}
