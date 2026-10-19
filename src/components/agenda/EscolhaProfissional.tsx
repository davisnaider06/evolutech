import React from 'react';
import { Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { corDoProfissional, iniciais } from '@/lib/profissional';

export interface ProfissionalOpcao {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface Props {
  profissionais: ProfissionalOpcao[];
  valor: string;
  onChange: (id: string) => void;
  carregando?: boolean;
}

/**
 * Escolha do barbeiro em cards pequenos com a foto. O cliente reconhece o
 * barbeiro pelo rosto antes do nome; num <select> so aparecia o nome, e quem
 * nao lembrava como ele se chamava escolhia errado.
 */
const EscolhaProfissional: React.FC<Props> = ({ profissionais, valor, onChange, carregando }) => {
  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando profissionais...</p>;
  }
  if (profissionais.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum profissional disponível.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Profissional">
      {profissionais.map((profissional) => {
        const ativo = valor === profissional.id;
        return (
          <button
            key={profissional.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(profissional.id)}
            className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2 pt-3 text-center transition-colors ${
              ativo
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-input bg-background hover:border-primary'
            }`}
          >
            {ativo ? (
              <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            ) : null}
            <Avatar className="h-14 w-14">
              <AvatarImage
                src={profissional.avatar_url || undefined}
                alt={profissional.name}
                className="object-cover"
              />
              <AvatarFallback style={corDoProfissional(profissional.id)} className="font-semibold">
                {iniciais(profissional.name)}
              </AvatarFallback>
            </Avatar>
            <span className="line-clamp-2 text-xs font-medium leading-tight">{profissional.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default EscolhaProfissional;
