import { redirect, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/_index";
import { authClient } from "~/utils/auth/client";
import { Button } from "@siemsiem/beerreact";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { Logo } from "~/components/Logo";
import { subjects } from "~/components/Icons";
import "./_index.css";

export async function clientLoader() {
  const { data } = await authClient.getSession();

  if (data?.user) {
    return redirect("/app");
  }

  return null;
}

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="home">
      <nav className="home-nav">
        <Logo className="home-nav-logo" />
        <div className="home-nav-actions">
          <Button variant="primary" onClick={() => window.open("https://github.com/librelearn-org/LibreLearn", "_blank", "noreferrer")}>
            <span className="home-nav-github-content">
              <SiGithub size={18} color="currentColor" />
              {t("home:nav.source")}
            </span>
          </Button>
          <Button variant="transparent" onClick={() => navigate("/auth/login")}>
            {t("auth:login")}
          </Button>
        </div>
      </nav>

      <header className="home-hero">
        <Logo className="home-hero-logo" />
        <div className="home-hero-copy">
          <h1 className="home-hero-title">{t("home:hero.title")}</h1>
          <p className="home-hero-subtitle no-margin">{t("home:hero.subtitle")}</p>
        </div>
        <Button size="large" onClick={() => navigate("/auth/login")}>
          {t("auth:signupMarketing")}
        </Button>
      </header>

      <section className="home-subjects">
        <div className="home-subjects-track">
          {Array.from({ length: 4 })
            .flatMap(() => subjects)
            .map((subject, i) => (
              <img key={`${subject.slug}-${i}`} src={subject.icon} alt={t(subject.name)} />
            ))}
        </div>
      </section>

      {/* todo: more content (maybe cards about librelearn) here */}

      <footer className="home-footer">
        <span>{t("home:footer.copyright", { year: new Date().getFullYear() })}</span>
      </footer>
    </div>
  );
}
