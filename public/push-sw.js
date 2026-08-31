/**
 * Handlers de push, carregados dentro do service worker gerado pelo Workbox.
 *
 * Fica em public/ e sem build de proposito: o SW gerado importa este arquivo
 * por importScripts (ver vite.config.ts), entao ele precisa ser JS puro,
 * servido como esta. Nao use sintaxe que dependa de transpilacao.
 */

self.addEventListener('push', (event) => {
  // Push sem corpo acontece (alguns servicos mandam ping vazio). Melhor um
  // aviso generico do que uma excecao dentro do service worker.
  let dados = { title: 'Evolutech', body: 'Voce tem uma novidade.', url: '/', tag: 'evolutech' };
  try {
    if (event.data) dados = Object.assign(dados, event.data.json());
  } catch (_erro) {
    if (event.data) dados.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: dados.tag,
      // O iPhone so mostra o aviso com o app fechado; renotify garante que
      // um aviso novo com a mesma tag volte a chamar atencao.
      renotify: true,
      data: { url: dados.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // App ja aberto: navega a aba existente em vez de abrir outra. Abrir
      // uma segunda janela do PWA e o jeito mais rapido de confundir usuario.
      for (const janela of janelas) {
        if ('focus' in janela) {
          if ('navigate' in janela) janela.navigate(destino).catch(function () {});
          return janela.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
      return undefined;
    })
  );
});
