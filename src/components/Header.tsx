import { ReactNode } from "react";

interface HeaderProps {
  children?: ReactNode;
  actions?: ReactNode;
  title?: string;
  subtitle?: string;
}

const Header = ({ children, actions, title = "SentraIQ", subtitle = "Support operations" }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-[#26344a] bg-[#0b1220] px-3 py-1.5 text-white shadow-sm sm:px-4">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {children}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">{title}</h1>
            <p className="hidden truncate text-[10px] text-slate-400 sm:block">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};

export default Header;
