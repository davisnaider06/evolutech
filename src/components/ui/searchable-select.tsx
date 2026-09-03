import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  placeholder = 'Selecionar',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum item encontrado.',
  onValueChange,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value) || null;

  /**
   * Um texto unico por item, para a lista e para o React.
   *
   * Duas opcoes iguais — dois clientes de mesmo nome, dois servicos com o
   * mesmo rotulo — viravam a mesma entrada: chave repetida no React e, no
   * cmdk, dois itens tratados como um so. Clicar num marcava o outro. O
   * sufixo entra apenas onde ha repeticao, e como o texto da busca casa por
   * pedaco, ele nao atrapalha quem digita nome ou telefone.
   */
  const textos = React.useMemo(() => {
    const vistos = new Map<string, number>();
    return options.map((option, index) => {
      const base = `${option.label} ${option.value}`;
      const repeticoes = vistos.get(base) || 0;
      vistos.set(base, repeticoes + 1);
      return repeticoes === 0 ? base : `${base} #${index}`;
    });
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option, index) => (
                <CommandItem
                  key={textos[index]}
                  value={textos[index]}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected?.value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
