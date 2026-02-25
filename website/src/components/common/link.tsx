import NextLink from "next/link";
import { cn } from "@/lib/utils";

interface StyledLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}

export function StyledLink({
  href,
  external = false,
  className,
  children,
  ...props
}: StyledLinkProps) {
  const baseStyles =
    "text-white/70 hover:text-white transition-colors duration-200";

  if (external || href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseStyles, className)}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} className={cn(baseStyles, className)} {...props}>
      {children}
    </NextLink>
  );
}
