import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
  showButton?: boolean;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  buttonLabel = 'Novo',
  onButtonClick,
  showButton = true,
  children,
}) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {showButton && onButtonClick && (
          <Button onClick={onButtonClick} className="gap-2">
            <Plus className="h-4 w-4" />
            {buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
