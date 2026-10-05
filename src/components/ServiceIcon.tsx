/* eslint-disable @next/next/no-img-element */
export function ServiceIcon({ icon, name, size = 36 }: { icon: string | null; name: string; size?: number }) {
  const box = { width: size, height: size };
  if (icon && /^(https?:\/\/|\/api\/uploads\/)/.test(icon)) return <img src={icon} alt="" style={box} className="rounded-md object-contain" loading="lazy" referrerPolicy="no-referrer" />;
  if (icon && icon.length <= 4 && !/^[a-z]+:/.test(icon)) return <span style={{ ...box, fontSize: size * 0.6 }} className="grid place-items-center" aria-hidden>{icon}</span>;
  return <span style={box} className="grid place-items-center rounded-md bg-surface-2 text-sm font-semibold uppercase text-muted" aria-hidden>{name.slice(0, 2)}</span>;
}
