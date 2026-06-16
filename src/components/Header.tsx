import equityLogo from "@/assets/equity-logo.png";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  children?: ReactNode;
  actions?: ReactNode;
}

const Header = ({ children, actions }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 border-b px-6 py-4 shadow-sm bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {children}
          <Link to="/" className="flex items-center gap-4">
            <img 
              src={equityLogo} 
              alt="Equity Bank Logo" 
              className="h-10 object-contain cursor-pointer hover:opacity-80 transition-opacity"
            />
            <h1 className="text-xl font-semibold text-[#b71c1c]">
              SentraIQ
            </h1>
          </Link>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
};

export default Header;
