# Publicar na Hostinger (app Node.js importado do GitHub)

O site precisa rodar como **aplicativo Node.js**. O agendamento, o painel `/admin/` e a Google Agenda dependem do servidor `server.mjs`. Hospedagem só de HTML não serve: é preciso um plano com "Aplicativos Node.js" (Business ou Cloud) ou uma VPS.

O projeto não tem dependências para instalar e não precisa de etapa de build.

## 1. Criar o app

1. No hPanel, vá em **Sites > Adicionar site > Aplicativo Node.js** e escolha **Importar repositório Git**.
2. Conecte o GitHub e escolha o repositório `KaioTriani/SiteAssis.ink`, branch `main`.
3. Configurações de build:
   - **Framework:** Outro / Personalizado (não é Next nem Express)
   - **Versão do Node:** 20 ou 22
   - **Diretório raiz:** `/` (raiz do repositório)
   - **Comando de build:** deixe vazio. Se o campo for obrigatório, use `npm install`, que não instala nada porque não há dependências.
   - **Comando de início:** `npm start`. Se pedirem o arquivo de entrada, use `server.mjs`.
4. Em **Variáveis de ambiente**, cole as linhas do arquivo `CONFIG-HOSTINGER-PRIVADO.txt`. Esse arquivo fica só no computador e não está no GitHub. Antes de colar, troque:
   - `SEU-DOMINIO` pelo domínio real, por exemplo `https://www.assisink.com.br`;
   - `SEU-USUARIO` pelo usuário da hospedagem. Ele aparece no caminho do Gerenciador de Arquivos, como `/home/u123456789/`.
5. Faça o deploy e aponte o domínio para o app. Confirme que o SSL está ativo.

> **Por que `DATA_DIR` fora da pasta do app:** pedidos, referências enviadas pelos clientes, catálogo e portfólio editados no painel, e a conexão com o Google ficam nessa pasta. Fora da pasta do app, um novo deploy não apaga esses dados. Inclua essa pasta nos backups.

## 2. Testar depois do deploy

- [ ] `https://SEU-DOMINIO/` abre o site, com as fotos, o catálogo e a máquina 3D.
- [ ] Ver o código-fonte da página: o `<link rel="canonical">` já mostra o domínio real. O servidor troca o domínio provisório pelo `PUBLIC_URL`; o mesmo vale para `sitemap.xml` e `robots.txt`.
- [ ] `https://SEU-DOMINIO/admin/` pede senha e entra com a senha do arquivo privado.
- [ ] Um pedido de teste pelo formulário aparece em **Pedidos** no painel. Depois de testar, recuse-o.

## 3. Google Agenda (feito pelo Assis, com o e-mail dele)

No [Google Cloud Console](https://console.cloud.google.com/), no app "Assis.ink":

1. **Clientes > Site Assis.ink:** adicione o URI de redirecionamento `https://SEU-DOMINIO/oauth/google/callback`.
2. **Público:** adicione `assisneto404@gmail.com` como usuário de teste.
3. **Branding:** preencha:
   - página inicial: `https://SEU-DOMINIO/`
   - política de privacidade: `https://SEU-DOMINIO/privacidade.html`
   - domínio autorizado: o domínio do site

   Depois clique em **Publicar app**. Sem publicar, a conexão expira a cada 7 dias.
4. **Gere uma chave secreta nova** e atualize `GOOGLE_CLIENT_SECRET` na Hostinger. A atual foi usada só em teste.

Depois o Assis:

1. Entra em `https://SEU-DOMINIO/admin/` com a senha do painel.
2. Vai em **Agenda > Conectar Google Agenda** e entra com o Gmail dele.
3. Na tela "app não verificado", clica em **Avançado > Acessar Assis.ink** e autoriza.

A partir daí:
- o formulário mostra só horários livres;
- as sessões confirmadas no painel viram eventos na agenda dele.

Ninguém precisa da senha do Google do Assis: a autorização é feita por ele na tela do próprio Google.

## 4. Primeiros ajustes no painel

- **Configurações:**
  - confirmar o WhatsApp (o número atual tem 8 dígitos);
  - preencher o endereço do estúdio;
  - definir dias, horários, pausa e duração da sessão.
- **Catálogo:** marcar cada arte como disponível, reservada ou já tatuada.

## Trocar a senha do painel

No computador, rode:

```bash
node tools/set-password.mjs "nova-senha"
```

Copie o `ADMIN_PASSWORD_HASH` gerado no `.env` para a variável de mesmo nome na Hostinger e reinicie o app.
