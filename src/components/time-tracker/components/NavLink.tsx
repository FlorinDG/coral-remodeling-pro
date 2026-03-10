"use client";
import { Link, usePathname } from "@/i18n/routing";

import { forwardRef } from "react";
import { cn } from "@/components/time-tracker/lib/utils";

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, href, ...props }, ref) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    const isPending = false;

    // Support function className
    const computedClassName = typeof className === "function"
      ? className({ isActive, isPending })
      : cn(className, isActive && activeClassName, isPending && pendingClassName);

    return (
      <Link
        ref={ref}
        href={href}
        className={computedClassName}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
