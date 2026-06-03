import Image from "next/image";
import Link from "next/link";
import strings from "@/lib/strings";

type LogoProps = {
  homeHref: string;
};

export default function Logo({ homeHref }: LogoProps) {
  return (
    <Link
      href={homeHref}
      aria-label={strings.logoAriaLabel}
      className="inline-flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
    >
      <Image
        src="/MeskaLogo.png"
        alt={strings.logoAlt}
        width={160}
        height={28}
        priority
      />
    </Link>
  );
}
