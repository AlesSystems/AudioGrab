export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-mark">
        <span className="pre">~/</span>
        <span>audiograb</span>
        <span className="caret" aria-hidden="true" />
      </div>
      <div className="nav-right">
        <span className="chip">
          <span className="dot" aria-hidden="true" />
          online
        </span>
        <a href="#" tabIndex={0}>~/github</a>
      </div>
    </header>
  );
}
