import React, { useState, ReactNode } from 'react';
import Sidebar from '../common/Sidebar';
import DebugToken from '../common/DebugToken';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar isOpen={sidebarIsOpen} onClose={() => setSidebarIsOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
      <DebugToken />
    </div>
  );
};

export default Layout;