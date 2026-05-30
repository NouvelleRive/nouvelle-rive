// Script one-shot pour obtenir un GOOGLE_REFRESH_TOKEN_ACHATS pour la boîte
// nouvelleriveachats@gmail.com.
//
// Comment ça marche (côté humain) :
//   1. Tu lances le script :  npm run oauth:achats
//   2. Le terminal t'affiche une URL Google → tu cliques dessus
//   3. Une page Google s'ouvre : connecte-toi avec nouvelleriveachats@
//   4. Tu cliques le bouton "Autoriser"
//   5. Google te redirige vers une page locale → le script récupère le token
//   6. Le script affiche GOOGLE_REFRESH_TOKEN_ACHATS=xxx → tu colles ça dans
//      la config Firebase Functions (env vars).
//
// Prérequis côté Google Cloud :
//   - GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET déjà dans .env.local (OK, ils
//     servent déjà à checkGmailFactures pour nouvelleriveparis@)
//   - L'URI http://localhost:9876/oauth-callback doit être autorisée pour ce
//     client OAuth. Si erreur "redirect_uri_mismatch" :
//     → console.cloud.google.com/apis/credentials → click sur ton OAuth Client
//     → ajouter "http://localhost:9876/oauth-callback" dans "URI de redirection
//       autorisés" → Enregistrer → relancer le script.

import dotenv from 'dotenv'
import http from 'node:http'
import { spawn } from 'node:child_process'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const PORT = 9876
const REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('❌ GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquants dans .env.local')
  process.exit(1)
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
authUrl.searchParams.set('client_id', clientId)
authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('scope', SCOPE)
authUrl.searchParams.set('access_type', 'offline')
authUrl.searchParams.set('prompt', 'consent')
authUrl.searchParams.set('login_hint', 'nouvelleriveachats@gmail.com')

console.log('\n👉 Ouvre cette URL dans ton navigateur :\n')
console.log(authUrl.toString())
console.log('\nConnecte-toi avec nouvelleriveachats@gmail.com et clique "Autoriser".\n')
console.log(`En attente de la redirection sur ${REDIRECT_URI}…\n`)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname !== '/oauth-callback') {
    res.writeHead(404)
    res.end('not found')
    return
  }

  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<h1>Erreur : ${error}</h1><p>Tu peux fermer cette page.</p>`)
    console.error(`\n❌ Erreur Google : ${error}`)
    server.close()
    process.exit(1)
  }

  if (!code) {
    res.writeHead(400)
    res.end('missing code')
    return
  }

  // Échange du code contre le refresh_token
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    })
    const json = await tokenRes.json()

    if (!json.refresh_token) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<h1>Pas de refresh_token dans la réponse</h1><pre>${JSON.stringify(json, null, 2)}</pre>`)
      console.error('\n❌ Pas de refresh_token. Réponse Google :', JSON.stringify(json, null, 2))
      server.close()
      process.exit(1)
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <html><body style="font-family: sans-serif; padding: 2rem; text-align: center;">
        <h1>✅ C'est bon !</h1>
        <p>Tu peux fermer cette page et retourner au terminal.</p>
      </body></html>
    `)

    console.log('\n✅ Refresh token obtenu !\n')
    console.log('Copie cette ligne dans la config Firebase Functions (env vars) :\n')
    console.log(`GOOGLE_REFRESH_TOKEN_ACHATS=${json.refresh_token}\n`)
    server.close()
    process.exit(0)
  } catch (err) {
    res.writeHead(500)
    res.end('erreur exchange : ' + err.message)
    console.error('\n❌ Exception échange :', err)
    server.close()
    process.exit(1)
  }
})

server.listen(PORT, () => {
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' :
    'xdg-open'
  try {
    spawn(opener, [authUrl.toString()], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    // Si l'ouverture auto échoue, l'utilisateur peut cliquer le lien manuellement.
  }
})
