import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';

interface StatusOption {
  value: string;
  label: string;
}

interface SearchFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusOptions?: StatusOption[];
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  onClear?: () => void;
  showClear?: boolean;
  children?: React.ReactNode;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  statusOptions,
  statusValue,
  onStatusChange,
  onClear,
  showClear = false,
  children,
}) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {statusOptions && onStatusChange && (
        <Select value={statusValue || ''} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {children}

      {showClear && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
};
