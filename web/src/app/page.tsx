import Overlays from "@/components/Overlays";
import CustomCursor from "@/components/CustomCursor";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import Extractor from "@/components/Extractor";

export default function Home() {
  return (
    <>
      <Overlays />
      <CustomCursor />
      <Nav />
      <div className="page">
        <main className="shell">
          <Hero />
          <Extractor />
        </main>
        <Footer />
      </div>
    </>
  );
}
