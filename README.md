# Assis.ink · site, catálogo e agendamento

Site do tatuador Assis Neto (João Pessoa, PB): portfólio real, catálogo de artes disponíveis, máquina em 3D, formulário de agendamento com envio de referências, integração com a Google Agenda e painel do artista.

- **Front:** HTML, CSS e JavaScript próprios. GSAP 3.12.5 (animações) e Three.js 0.169.0 (máquina 3D) por CDN, com versão fixa.
- **Servidor:** `server.mjs` em Node 20.11+ sem dependências. Ele serve o site, a API de agendamento, o painel e a integração com o Google.
- **Dados:** arquivos JSON em `data/` (fora da pasta pública). Pedidos, referências enviadas pelos clientes, catálogo, portfólio e configurações ficam ali.

## Rodar no computador

```bash
cp .env.example .env
node tools/set-password.mjs "uma-senha-forte"
node server.mjs
```

Site em http://localhost:4330 e painel em http://localhost:4330/admin/.
Na primeira execução o servidor copia `data-seed/` para `data/`.

Testes: `node tools/functest.mjs http://localhost:4330` (20 verificações de API, segurança e cálculo de horários).

## Como funciona o agendamento

1. O cliente preenche o formulário em 4 etapas e pode anexar até 6 imagens. As imagens são reduzidas no navegador e o servidor confere se são JPG, PNG ou WebP de verdade.
2. **Com a Google Agenda conectada**, o formulário mostra só os horários livres. Eles são calculados a partir das regras do painel menos os intervalos ocupados da agenda (consulta *freeBusy*, que não lê nenhum detalhe dos eventos) e menos as pré-reservas pendentes.
   **Sem a agenda conectada**, o cliente indica datas de preferência e período.
3. Ao enviar, o servidor confere o horário de novo, registra o pedido com status **aguardando** e devolve um protocolo. Também gera a mensagem pronta para o WhatsApp.
4. No painel, o Assis clica em **Criar evento e confirmar**. O servidor checa conflito na agenda outra vez, cria o evento (com convite para o e-mail do cliente, se houver) e só então muda o status para **confirmado**. O painel oferece o link para avisar o cliente pelo WhatsApp.
5. Cancelar ou recusar uma sessão confirmada remove o evento da agenda.

O site nunca diz que uma sessão está confirmada antes de o evento existir na Google Agenda.
Pré-reservas feitas pelo site seguram o horário por 48 h (ajustável no painel).

## Conectar a Google Agenda (uma vez)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Google Calendar API**.
2. Em **APIs e serviços > Tela de consentimento OAuth**, configure como "Externo", adicione o e-mail do Assis como usuário de teste e inclua os escopos `calendar.events` e `calendar.freebusy`. Para não precisar renovar a conexão a cada 7 dias, publique o app ("Em produção").
3. Em **Credenciais**, crie um **ID do cliente OAuth** do tipo "Aplicativo da Web", com URI de redirecionamento `https://SEU-DOMINIO/oauth/google/callback` (e `http://localhost:4330/oauth/google/callback` para testes).
4. Preencha no `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` e, se for usar uma agenda específica, `GOOGLE_CALENDAR_ID`.
5. Reinicie o servidor. Depois, no painel, abra **Agenda > Conectar Google Agenda** e autorize com a conta do Assis.

O token fica só no servidor (`data/google-token.json`). Client secret e tokens nunca vão para o navegador.

## Painel (`/admin/`)

- **Pedidos:** lista por status, dados completos, referências (visíveis só com login), confirmar, recusar, cancelar, concluir e responder no WhatsApp.
- **Agenda:** conectar e desconectar o Google e ver os próximos 30 dias.
- **Catálogo:** status de cada arte (consultar, disponível, reservada, já tatuada), título, tamanho, categorias, ocultar e adicionar arte nova.
- **Portfólio:** adicionar trabalho com fotos (o navegador gera as versões 2000 px e 760 px), editar textos e o texto alternativo, destacar, ocultar e excluir.
- **Configurações:** WhatsApp, e-mail, endereço, dias e horários de atendimento, pausa, duração da sessão, intervalo entre sessões, antecedência mínima e folgas.

Segurança do painel:
- senha com scrypt e cookie de sessão assinado (HttpOnly, SameSite=Lax, Secure em HTTPS);
- limite de tentativas de login;
- cabeçalho anti-CSRF nas alterações.

## Publicar

O site precisa de **Node.js** no servidor (o agendamento, o painel e o Google dependem dele). Na Hostinger isso exige um plano com suporte a apps Node.js (Business/Cloud ou VPS).

1. Envie a pasta do projeto **sem** `data/`, `.env` e `referencias/`. O comando abaixo gera `release/assis-ink.zip` já sem esses itens:

   ```bash
   node tools/package.mjs
   ```

2. No servidor:
   - crie o `.env` com `PUBLIC_URL=https://SEU-DOMINIO`, a senha (`node tools/set-password.mjs`) e as credenciais do Google;
   - defina o arquivo de entrada `server.mjs`.
3. Confirme que a pasta `data/` é persistente entre deploys e entra no backup.

Se for publicado só como site estático, sem Node, a página continua funcionando com `content-fallback.json`. Nesse caso o formulário abre o WhatsApp com a mensagem pronta em vez de registrar o pedido, e não há painel nem agenda.

## Imagens

Todas as fotos são reais, do Instagram @assis.ink ou enviadas pelo cliente, só redimensionadas e comprimidas, sem filtro.

- Originais: `referencias/`
- Portfólio otimizado: `public/assets/portfolio/` (`node tools/portfolio-images.cjs`)
- Artes recortadas das folhas de flash: `public/assets/flash/` (`node tools/flash-crops.cjs`)
- Dados iniciais: `node tools/seed.mjs` (gera `data-seed/`, não mexe em `data/`)

## Pendências para confirmar com o Assis

- [ ] **WhatsApp:** (83) 8205-8633 tem 8 dígitos. Se o número certo tiver o 9, corrija em Configurações e marque como confirmado.
- [ ] **Domínio:** o site usa `https://www.assisink.com.br` provisoriamente em canonical, Open Graph, `sitemap.xml`, `robots.txt` e dados estruturados. Troque pelo domínio real antes de publicar.
- [ ] **Logo original:** o cabeçalho usa a palavra "assis.ink" em fonte manuscrita até chegar o arquivo da marca.
- [ ] **Artes em alta resolução:** os recortes vêm de prints dos stories (cerca de 200 a 500 px). Substitua pelos arquivos originais.
- [ ] **Disponibilidade de cada arte:** todas estão como "Consultar disponibilidade".
- [ ] **Folha do Coringa e Batman:** são personagens de terceiros. Decidir se ficam no catálogo.
- [ ] **Warrior II:** o modelo 3D é ilustrativo (máquina rotativa estilo pen). Com fotos da máquina dele, dá para ajustar proporções e detalhes.
- [ ] **Agenda:** regras de atendimento (dias, horários, duração), endereço do estúdio e foto do Assis para a seção "Sobre".
- [ ] **Textos sobre higiene e o FAQ:** revisar e aprovar.
