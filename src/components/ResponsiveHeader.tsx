import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, User } from 'lucide-react';
import MarklyLogo from './MarklyLogo';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveHeaderProps {
  title: string;
  subtitle?: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({
  title,
  subtitle,
  user,
  onLogout,
  actions,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            <MarklyLogo size={isMobile ? "sm" : "md"} showText={!isMobile} />
            {!isMobile && (
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold gradient-markly bg-clip-text text-transparent">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-muted-foreground text-sm lg:text-base">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Desktop Actions */}
          {!isMobile && (
            <div className="flex items-center gap-3">
              {user && (
                <div className="text-right">
                  <p className="font-medium text-sm lg:text-base">{user.name}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">{user.email}</p>
                </div>
              )}
              {actions}
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="py-6">
                  {/* Mobile Title */}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold gradient-markly bg-clip-text text-transparent">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="text-muted-foreground text-sm mt-1">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {/* User Info */}
                  {user && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile Actions */}
                  <div className="space-y-3 mb-6">
                    {actions}
                  </div>

                  {/* Additional Content */}
                  {children}

                  {/* Logout Button */}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setIsOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveHeader;