import { HardDriveIcon, MonitorIcon, type LucideIcon } from "lucide-react";
import {
  siDigitalocean,
  siFastapi,
  siLatex,
  siOpenapiinitiative,
  siPostgresql,
  siPython,
  siReact,
  siRedis,
  siSentry,
  siStorybook,
  siTraefikproxy,
  siVite,
  type SimpleIcon,
} from "simple-icons";

import { type LogoId } from "@/lib/infra-graph";

// Brand marks come from Simple Icons (24×24 paths). Garage and "a browser" have none, so they use lucide icons.
type Logo = { title: string } & ({ path: string } | { Icon: LucideIcon });

const brand = ({ title, path }: SimpleIcon): Logo => ({ title, path });

const logos: Record<LogoId, Logo> = {
  browser: { title: "Browser", Icon: MonitorIcon },
  digitalocean: brand(siDigitalocean),
  traefik: brand(siTraefikproxy),
  react: brand(siReact),
  vite: brand(siVite),
  storybook: brand(siStorybook),
  fastapi: brand(siFastapi),
  openapi: brand(siOpenapiinitiative),
  redis: brand(siRedis),
  python: brand(siPython),
  latex: brand(siLatex),
  postgres: brand(siPostgresql),
  storage: { title: "Object storage", Icon: HardDriveIcon },
  sentry: brand(siSentry),
};

type InfraLogoProps = {
  id: LogoId;
  x: number;
  y: number;
  size: number;
  className?: string;
};

/** A logo positioned inside the graph's SVG, coloured by `currentColor`. */
export const InfraLogo = ({ id, x, y, size, className }: InfraLogoProps) => {
  const logo = logos[id];
  if ("Icon" in logo) {
    const { Icon } = logo;
    return (
      <Icon
        x={x}
        y={y}
        width={size}
        height={size}
        strokeWidth={1.75}
        aria-hidden
        className={className}
      />
    );
  }
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
    >
      <path d={logo.path} fill="currentColor" />
    </svg>
  );
};
