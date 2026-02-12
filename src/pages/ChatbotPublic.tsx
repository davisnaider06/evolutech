import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotConfig {
  id: string;
  name: string;
  welcome_message: string;
  primary_color: string;
  logo_url: string | null;
  company: { name: string } | null;
}

const ChatbotPublic: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [chatbot, setChatbot] = useState<ChatbotConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChatbot();
  }, [slug]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchChatbot = async () => {
    if (!slug) return;

    try {
      const { data, error } = await supabase
        .from('company_chatbots')
        .select('id, name, welcome_message, primary_color, logo_url, company:companies(name)')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      setChatbot(data);
      
      // Add welcome message
      if (data.welcome_message) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: data.welcome_message,
        }]);
      }
    } catch (error) {
      console.error('Error fetching chatbot:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput || sending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('chatbot', {
        body: {
          slug,
          message: trimmedInput,
          sessionId,
          conversationId,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="p-8 text-center max-w-md">
          <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold mb-2">Chatbot não encontrado</h1>
          <p className="text-muted-foreground">
            Este chatbot não existe ou está desativado.
          </p>
        </Card>
      </div>
    );
  }

  const primaryColor = chatbot.primary_color || '#6366f1';

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
      }}
    >
      {/* Header */}
      <header 
        className="p-4 shadow-lg"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white/20">
            {chatbot.logo_url ? (
              <AvatarImage src={chatbot.logo_url} alt={chatbot.name} />
            ) : null}
            <AvatarFallback className="bg-white/20 text-white">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold text-white">{chatbot.name}</h1>
            {chatbot.company && (
              <p className="text-sm text-white/80">{chatbot.company.name}</p>
            )}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {chatbot.logo_url ? (
                    <AvatarImage src={chatbot.logo_url} alt={chatbot.name} />
                  ) : null}
                  <AvatarFallback style={{ backgroundColor: primaryColor }}>
                    <Bot className="h-4 w-4 text-white" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border shadow-sm'
                }`}
                style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>

              {message.role === 'user' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-muted">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback style={{ backgroundColor: primaryColor }}>
                  <Bot className="h-4 w-4 text-white" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-card border shadow-sm rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-background/80 backdrop-blur-sm border-t">
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={sending}
            className="flex-1"
            autoFocus
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || sending}
            style={{ backgroundColor: primaryColor }}
            className="hover:opacity-90"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatbotPublic;
